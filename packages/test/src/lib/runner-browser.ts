import { chromium, type Browser } from 'playwright'
import { displayResults, type TestResults } from './executor.ts'

export interface TestRunOptions {
  baseUrl: string
  debug?: boolean
  devtools?: boolean
  ui?: boolean
}

export async function runBrowserTests(options: TestRunOptions): Promise<{
  results: TestResults
  close: () => Promise<void>
  disconnected: Promise<void>
}> {
  let browser: Browser | undefined

  try {
    browser = await chromium.launch({
      headless: !options.ui,
      devtools: options.devtools,
    })

    let page = await browser.newPage()

    if (options.debug) {
      page.on('console', (msg) => console.log(`  [Browser] ${msg.text()}`))
    }

    let totalPassed = 0
    let totalFailed = 0

    await page.route('**/file-results', async (route) => {
      let results = route.request().postDataJSON() as TestResults
      displayResults(results, 'browser')
      totalPassed += results.passed
      totalFailed += results.failed
      await route.fulfill({ status: 200 })
    })

    await page.goto(options.baseUrl)
    await page.waitForFunction('window.__testsDone', { timeout: 60000 })

    let allResults: TestResults = { passed: totalPassed, failed: totalFailed, tests: [] }

    if (!options.ui) {
      await page.close()
    }

    let close = async () => {
      await browser?.close()
      browser = undefined
    }

    let disconnected = new Promise<void>((resolve) => browser!.on('disconnected', () => resolve()))

    if (!options.ui) {
      await close()
      return { results: allResults, close: async () => {}, disconnected: Promise.resolve() }
    }

    return { results: allResults, close, disconnected }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
