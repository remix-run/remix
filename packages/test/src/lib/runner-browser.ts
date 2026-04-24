import type { Browser, Page, Request } from 'playwright'
import { routes } from '../app/client/routes.ts'
import { colors } from './colors.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
  type PlaywrightUseOpts,
} from './playwright.ts'
import type { Reporter } from './reporters/index.ts'
import type { TestResults } from './reporters/results.ts'

export interface TestRunOptions {
  baseUrl: string
  console?: boolean
  open?: boolean
  playwrightUseOpts?: PlaywrightUseOpts
  projectName?: string
  reporter: Reporter
}

export async function runBrowserTests(options: TestRunOptions): Promise<{
  results: TestResults
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

  try {
    browser = await getBrowserLauncher(options.playwrightUseOpts).launch(
      getPlaywrightLaunchOptions(options.playwrightUseOpts),
    )
    page = await browser.newPage(getPlaywrightPageOptions(options.playwrightUseOpts))

    if (options.console) {
      page.on('console', (msg) => console.log(`${colors.dim('[browser console]')} ${msg.text()}`))
    }

    let totalPassed = 0
    let totalFailed = 0
    let testFileUrls = new Set<string>()

    await page.route('**/file-results', async (route) => {
      let results = route.request().postDataJSON() as TestResults
      options.reporter.onResult(results, envLabel)
      totalPassed += results.passed
      totalFailed += results.failed
      for (let test of results.tests) {
        if (test.filePath) testFileUrls.add(test.filePath)
      }
      await route.fulfill({ status: 200 })
    })

    // Fail the tests if any of our harness scripts or test modules fail to load
    let errorPromise = new Promise((_, reject) => {
      let isTestHarnessRequest = (request: Request) => {
        let url = new URL(request.url())
        let match = routes.scripts.match(url)
        return (
          match && (match.params.path?.startsWith('app/') || match.params.path?.startsWith('test/'))
        )
      }
      page!.on('response', (response) => {
        if (!response.ok() && isTestHarnessRequest(response.request())) {
          reject(new Error(`Failed to load script: ${response.request().url()}`))
        }
      })
      page!.on('requestfailed', (request) => {
        if (isTestHarnessRequest(request)) {
          reject(new Error(`Failed to load script: ${request.url()}`))
        }
      })
    })

    // Prevent unhandled rejection if we fail before setting up the listener
    errorPromise.catch(() => {})

    await page.goto(options.baseUrl)
    await Promise.race([page.waitForFunction('window.__testsDone'), errorPromise])

    results = {
      passed: totalPassed,
      failed: totalFailed,
      skipped: 0,
      todo: 0,
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
      close,
      disconnected: new Promise((r) => browser!.on('disconnected', () => r())),
    }
  } else {
    await close()
    return {
      results,
      close,
      disconnected: Promise.resolve(),
    }
  }
}
