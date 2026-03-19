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

    await page.goto(options.baseUrl)
    await page.waitForFunction('window.__testResults', { timeout: 60000 })
    let results = (await page.evaluate('window.__testResults')) as TestResults

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
      return { results, close: async () => {}, disconnected: Promise.resolve() }
    }

    displayResults(results)

    return { results, close, disconnected }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
