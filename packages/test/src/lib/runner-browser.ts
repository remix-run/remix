import * as path from 'node:path'
import type { Browser, Page, Request, Response } from 'playwright'
import { colors } from './colors.ts'
import { getBrowserTestRootDir } from './config.ts'
import {
  collectCoverageMapFromPlaywright,
  type CoverageMap,
  type V8CoverageEntry,
} from './coverage.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
  type PlaywrightUseOpts,
} from './playwright.ts'
import type { Reporter } from './reporters/index.ts'
import type { TestResults } from './reporters/results.ts'

const BROWSER_TEST_FILE_TIMEOUT_MS = 90_000

// The harness reports each test result with `filePath` set to the
// `/scripts/<rel>` URL the iframe loaded. Reporters expect a real filesystem
// path so they can compute `path.relative(cwd, ...)` cleanly; otherwise they
// produce noisy `../../../scripts/...` strings.
function urlPathToFilePath(urlPath: string, rootDir: string): string {
  if (!urlPath.startsWith('/scripts/')) return urlPath
  return path.resolve(rootDir, urlPath.slice('/scripts/'.length))
}

export interface TestRunOptions {
  baseUrl: string
  console?: boolean
  coverage?: boolean
  open?: boolean
  playwrightUseOpts?: PlaywrightUseOpts
  projectName?: string
  reporter: Reporter
  // Test file paths so coverage collection can skip them when mapping V8
  // entries back to filesystem files.
  testFiles?: string[]
}

export async function runBrowserTests(options: TestRunOptions): Promise<{
  results: TestResults
  coverageMap: CoverageMap | null
  close: () => Promise<void>
  disconnected: Promise<void>
}> {
  let envLabel = options.projectName ? `browser:${options.projectName}` : 'browser'
  let browser: Browser | undefined
  let page: Page | undefined
  let executionPage: Page | undefined
  let close = async () => {
    await executionPage?.close()
    await page?.close()
    await browser?.close()
    browser = undefined
    page = undefined
    executionPage = undefined
  }
  let results: TestResults
  let coverageMap: CoverageMap | null = null

  try {
    browser = await getBrowserLauncher(options.playwrightUseOpts).launch(
      getPlaywrightLaunchOptions(options.playwrightUseOpts),
    )
    let pageOptions = getPlaywrightPageOptions(options.playwrightUseOpts)
    if (browser.browserType().name() === 'webkit') {
      // WebKit charges iframe history updates to the top-level document. Reuse one page,
      // navigating it between files to reset that budget while preserving browser storage.
      let context = await browser.newContext(pageOptions)
      page = await context.newPage()
      executionPage = await context.newPage()
    } else {
      page = await browser.newPage(pageOptions)
    }
    // Cap individual browser operations, then separately watch for per-file
    // progress so large suites can run longer than this without hiding hangs.
    for (let browserPage of executionPage ? [page, executionPage] : [page]) {
      browserPage.setDefaultTimeout(BROWSER_TEST_FILE_TIMEOUT_MS)
      browserPage.setDefaultNavigationTimeout(BROWSER_TEST_FILE_TIMEOUT_MS)
      if (options.console) {
        browserPage.on('console', (msg) =>
          console.log(`${colors.dim('[browser console]')} ${msg.text()}`),
        )
      }
    }

    // Playwright's JS coverage is Chromium-only. Start before navigation so
    // the harness scripts and test modules are instrumented from first parse.
    let coverageEnabled = options.coverage && browser.browserType().name() === 'chromium'
    if (coverageEnabled) {
      await page.coverage.startJSCoverage({ resetOnNavigation: false })
    }

    let totalPassed = 0
    let totalFailed = 0
    let totalSkipped = 0
    let totalTodo = 0
    let rootDir = getBrowserTestRootDir()
    let completedFiles = 0
    let totalFiles = options.testFiles?.length ?? 0
    let watchingProgress = true
    let progressTimeoutId: ReturnType<typeof setTimeout> | undefined
    let rejectProgressTimeout: (error: Error) => void = () => {}
    let progressTimeoutPromise = new Promise<never>((_, reject) => {
      rejectProgressTimeout = reject
    })

    function clearProgressTimeout() {
      if (progressTimeoutId !== undefined) {
        clearTimeout(progressTimeoutId)
        progressTimeoutId = undefined
      }
    }

    function resetProgressTimeout() {
      clearProgressTimeout()
      if (!watchingProgress) return
      progressTimeoutId = setTimeout(() => {
        let progress = totalFiles > 0 ? ` (${completedFiles}/${totalFiles} files completed)` : ''
        rejectProgressTimeout(
          new Error(
            `Timed out waiting ${BROWSER_TEST_FILE_TIMEOUT_MS}ms for browser test progress${progress}`,
          ),
        )
      }, BROWSER_TEST_FILE_TIMEOUT_MS)
    }

    let runnerUrl = new URL(options.baseUrl)
    if (executionPage) {
      runnerUrl.searchParams.set('runFiles', '1')
      await executionPage.route('**/history-quota?*', async (route) => {
        let params = new URL(route.request().url()).searchParams
        let file = params.get('file')
        if (!file?.startsWith('/scripts/')) {
          await route.fulfill({ status: 400 })
          return
        }
        let fileName = path.relative(process.cwd(), urlPathToFilePath(file, rootDir))
        let testName = params.get('test')
        let label = testName ? `${fileName} (${testName})` : fileName
        console.warn(
          `Warning: WebKit's history update limit was reached in ${label}. Waiting 11 seconds for the budget to reset. Split history-heavy tests across smaller files or reduce history updates to avoid repeated waits.`,
        )
        resetProgressTimeout()
        await route.fulfill({ status: 200 })
      })
    }

    function reportFileResults(results: TestResults) {
      options.reporter.onResult(
        {
          ...results,
          tests: results.tests.map((test) => ({
            ...test,
            filePath: test.filePath ? urlPathToFilePath(test.filePath, rootDir) : undefined,
          })),
        },
        envLabel,
      )
      totalPassed += results.passed
      totalFailed += results.failed
      totalSkipped += results.skipped
      totalTodo += results.todo
      completedFiles++
      resetProgressTimeout()
    }

    let executionResults: TestResults | undefined
    await page.context().route('**/file-results', async (route) => {
      let results = route.request().postDataJSON() as TestResults
      if (route.request().frame().page() === executionPage) {
        executionResults = results
      } else {
        reportFileResults(results)
      }
      await route.fulfill({ status: 200 })
    })

    if (executionPage) {
      let activeExecutionPage = executionPage
      let dashboardNavigation = 0
      page.on('request', (request) => {
        if (request.isNavigationRequest() && request.frame() === page?.mainFrame()) {
          dashboardNavigation++
        }
      })
      await page.route('**/run-file?*', async (route) => {
        let navigation = dashboardNavigation
        let testFile = new URL(route.request().url()).searchParams.get('file')
        if (!testFile?.startsWith('/scripts/')) {
          await route.fulfill({ status: 404, body: 'Unknown test file' })
          return
        }
        let fileResults: TestResults
        executionResults = undefined
        try {
          let fileUrl = new URL(options.baseUrl)
          fileUrl.searchParams.set('file', testFile)
          fileUrl.searchParams.set('historyBackoff', '1')
          await waitForBrowserTests(activeExecutionPage, fileUrl.href)
          if (!executionResults) throw new Error('Missing browser test results')
          fileResults = executionResults
        } catch (error) {
          fileResults = {
            passed: 0,
            failed: 1,
            skipped: 0,
            todo: 0,
            tests: [
              {
                name: '',
                suiteName: testFile,
                filePath: testFile,
                status: 'failed',
                error: {
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
                },
                duration: 0,
              },
            ],
          }
        }
        // Refreshing the dashboard invalidates a request still waiting on the execution page.
        if (navigation !== dashboardNavigation) {
          await route.abort()
          return
        }
        reportFileResults(fileResults)
        await route.fulfill({ json: fileResults })
      })
    }

    // Prevent unhandled rejection if we fail before starting the run.
    progressTimeoutPromise.catch(() => {})

    resetProgressTimeout()
    try {
      await Promise.race([waitForBrowserTests(page, runnerUrl.href), progressTimeoutPromise])
    } finally {
      watchingProgress = false
      clearProgressTimeout()
    }

    if (coverageEnabled) {
      let entries = (await page.coverage.stopJSCoverage()) as unknown as V8CoverageEntry[]
      if (entries.length > 0) {
        coverageMap = await collectCoverageMapFromPlaywright(
          entries,
          getBrowserTestRootDir(),
          new Set(options.testFiles ?? []),
          async (urlPath) =>
            urlPath.startsWith('/scripts/') ? urlPath.slice('/scripts/'.length) : null,
        )
      }
    }

    results = {
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      todo: totalTodo,
      tests: [],
    }
  } catch (error) {
    console.error('Browser tests failed to run:', error)
    results = {
      passed: 0,
      failed: 1,
      skipped: 0,
      todo: 0,
      tests: [],
    }
  }

  if (options.open) {
    return {
      results,
      coverageMap,
      close,
      disconnected: new Promise((r) => browser!.on('disconnected', () => r())),
    }
  } else {
    await close()
    return {
      results,
      coverageMap,
      close,
      disconnected: Promise.resolve(),
    }
  }
}

async function waitForBrowserTests(page: Page, url: string): Promise<void> {
  // Navigation can cancel script requests left over from the previous document.
  let requests = new WeakSet<Request>()
  let rejectScriptError: (error: Error) => void = () => {}
  let errorPromise = new Promise<never>((_, reject) => {
    rejectScriptError = reject
  })
  let isScriptRequest = (request: Request) =>
    new URL(request.url()).pathname.startsWith('/scripts/')
  function onRequest(request: Request) {
    requests.add(request)
  }
  function onResponse(response: Response) {
    if (requests.has(response.request()) && !response.ok() && isScriptRequest(response.request())) {
      rejectScriptError(new Error(`Failed to load script: ${response.request().url()}`))
    }
  }
  function onRequestFailed(request: Request) {
    if (!requests.has(request) || !isScriptRequest(request)) return
    let failureText = request.failure()?.errorText
    if (failureText === 'net::ERR_ABORTED') return
    let reason = failureText ? ` (${failureText})` : ''
    rejectScriptError(new Error(`Failed to load script: ${request.url()}${reason}`))
  }
  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfailed', onRequestFailed)
  try {
    await Promise.race([
      page.goto(url).then((response) => {
        if (response && !response.ok()) {
          throw new Error(`Failed to load test page: ${url} (${response.status()})`)
        }
        return page.waitForFunction('window.__testsDone', undefined, { timeout: 0 })
      }),
      errorPromise,
    ])
  } finally {
    page.off('request', onRequest)
    page.off('response', onResponse)
    page.off('requestfailed', onRequestFailed)
  }
}
