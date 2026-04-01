import type { Browser } from 'playwright'
import type { TestResults } from './executor.ts'
import type { Reporter } from './reporters/index.ts'
import { colors } from './utils.ts'
import {
  getBrowserLauncher,
  getPlaywrightLaunchOptions,
  getPlaywrightPageOptions,
  type PlaywrightUseOpts,
} from './playwright.ts'

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

  try {
    browser = await getBrowserLauncher(options.playwrightUseOpts).launch(
      getPlaywrightLaunchOptions(options.playwrightUseOpts),
    )
    let page = await browser.newPage(getPlaywrightPageOptions(options.playwrightUseOpts))

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

    await page.goto(options.baseUrl)
    await page.waitForFunction('window.__testsDone', { timeout: 60000 }).catch(async (reason) => {
      console.log(await page.content())
      throw reason
    })

    let results: TestResults = {
      passed: totalPassed,
      failed: totalFailed,
      skipped: 0,
      todo: 0,
      tests: [],
    }

    if (options.open) {
      let close = async () => {
        await browser?.close()
        browser = undefined
      }
      let disconnected = new Promise<void>((resolve) =>
        browser!.on('disconnected', () => resolve()),
      )
      return { results, close, disconnected }
    }

    await page.close()
    await browser.close()
    browser = undefined
    return { results, close: async () => {}, disconnected: Promise.resolve() }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
