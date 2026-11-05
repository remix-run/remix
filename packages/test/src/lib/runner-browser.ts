import * as path from 'node:path'
import type { Browser, Page, Request } from 'playwright'
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
  let close = async () => {
    await page?.close()
    await browser?.close()
    browser = undefined
    page = undefined
  }
  let results: TestResults
  let coverageMap: CoverageMap | null = null

  try {
    browser = await getBrowserLauncher(options.playwrightUseOpts).launch(
      getPlaywrightLaunchOptions(options.playwrightUseOpts),
    )
    page = await browser.newPage(getPlaywrightPageOptions(options.playwrightUseOpts))
    // Cap individual browser operations, then separately watch for per-file
    // progress so large suites can run longer than this without hiding hangs.
    page.setDefaultTimeout(BROWSER_TEST_FILE_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(BROWSER_TEST_FILE_TIMEOUT_MS)

    if (options.console) {
      page.on('console', (msg) => console.log(`${colors.dim('[browser console]')} ${msg.text()}`))
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
      progressTimeoutId = setTimeout(() => {
        let progress = totalFiles > 0 ? ` (${completedFiles}/${totalFiles} files completed)` : ''
        rejectProgressTimeout(
          new Error(
            `Timed out waiting ${BROWSER_TEST_FILE_TIMEOUT_MS}ms for browser test progress${progress}`,
          ),
        )
      }, BROWSER_TEST_FILE_TIMEOUT_MS)
    }

    await page.route('**/file-results', async (route) => {
      let results = route.request().postDataJSON() as TestResults
      for (let test of results.tests) {
        if (test.filePath) test.filePath = urlPathToFilePath(test.filePath, rootDir)
      }
      options.reporter.onResult(results, envLabel)
      totalPassed += results.passed
      totalFailed += results.failed
      totalSkipped += results.skipped
      totalTodo += results.todo
      completedFiles++
      resetProgressTimeout()
      await route.fulfill({ status: 200 })
    })

    // Fail the tests if any /scripts/ request fails (harness scripts, test
    // modules, or their transitive imports — all served via the same prefix).
    let errorPromise = new Promise((_, reject) => {
      let isScriptRequest = (request: Request) =>
        new URL(request.url()).pathname.startsWith('/scripts/')
      page!.on('response', (response) => {
        if (!response.ok() && isScriptRequest(response.request())) {
          reject(new Error(`Failed to load script: ${response.request().url()}`))
        }
      })
      page!.on('requestfailed', (request) => {
        if (isScriptRequest(request)) {
          let failureText = request.failure()?.errorText
          if (failureText === 'net::ERR_ABORTED') return

          let reason = failureText ? ` (${failureText})` : ''
          reject(new Error(`Failed to load script: ${request.url()}${reason}`))
        }
      })
    })

    // Prevent unhandled rejection if we fail before setting up the listener
    errorPromise.catch(() => {})
    progressTimeoutPromise.catch(() => {})

    resetProgressTimeout()
    try {
      await page.goto(options.baseUrl)
      await Promise.race([
        page.waitForFunction('window.__testsDone', undefined, { timeout: 0 }),
        errorPromise,
        progressTimeoutPromise,
      ])
    } finally {
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
