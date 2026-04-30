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
    // Cap how long we'll wait for a browser-test file to signal completion.
    // Playwright's default is 30s; bumping to 60s buys headroom for slower
    // suites without letting a hung test hide forever. Plumb this through
    // config later if anyone needs to tune it.
    page.setDefaultTimeout(60_000)
    page.setDefaultNavigationTimeout(60_000)

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
          reject(new Error(`Failed to load script: ${request.url()}`))
        }
      })
    })

    // Prevent unhandled rejection if we fail before setting up the listener
    errorPromise.catch(() => {})

    await page.goto(options.baseUrl)
    await Promise.race([page.waitForFunction('window.__testsDone'), errorPromise])

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
