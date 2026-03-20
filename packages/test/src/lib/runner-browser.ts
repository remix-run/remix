import { chromium, type Browser } from 'playwright'
import { displayResults, type TestResults } from './executor.ts'
import { colors } from './utils.ts'

export interface TestRunOptions {
  baseUrl: string
  console?: boolean
  devtools?: boolean
  open?: boolean
}

export async function runBrowserTests(options: TestRunOptions): Promise<{
  results: TestResults
  close: () => Promise<void>
  disconnected: Promise<void>
}> {
  let browser: Browser | undefined

  try {
    browser = await chromium.launch({
      headless: !options.open,
      devtools: options.devtools,
    })

    let page = await browser.newPage()

    if (options.console) {
      page.on('console', (msg) => console.log(`${colors.dim('[browser console]')} ${msg.text()}`))
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

    if (!options.open) {
      await page.close()
    }

    let close = async () => {
      await browser?.close()
      browser = undefined
    }

    let disconnected = new Promise<void>((resolve) => browser!.on('disconnected', () => resolve()))

    if (!options.open) {
      await close()
      return { results: allResults, close: async () => {}, disconnected: Promise.resolve() }
    }

    return { results: allResults, close, disconnected }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
