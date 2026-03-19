import { chromium, type Browser } from 'playwright'

export interface TestRunOptions {
  baseUrl: string
  debug?: boolean
  devtools?: boolean
  ui?: boolean
}

export interface TestResults {
  passed: number
  failed: number
  tests: Array<{
    name: string
    suiteName?: string
    filePath?: string
    status: 'passed' | 'failed'
    error?: {
      message: string
      stack?: string
    }
    duration: number
  }>
}

export async function runBrowserTests(
  options: TestRunOptions,
): Promise<{ results: TestResults; close: () => Promise<void> }> {
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

    if (!options.ui) {
      await close()
      return { results, close: async () => {} }
    }

    return { results, close }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
