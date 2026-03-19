import { chromium, type Browser } from 'playwright'
import type { CoverageEntry } from './coverage.ts'

export interface TestRunOptions {
  baseUrl: string
  debug?: boolean
  devtools?: boolean
  ui?: boolean
  coverage?: boolean
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

export async function runBrowserTests(options: TestRunOptions): Promise<{
  results: TestResults
  close: () => Promise<void>
  disconnected: Promise<void>
  coverage?: CoverageEntry[]
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

    if (options.coverage) {
      await page.coverage.startJSCoverage()
    }

    await page.goto(options.baseUrl)
    await page.waitForFunction('window.__testResults', { timeout: 60000 })
    let results = (await page.evaluate('window.__testResults')) as TestResults

    let coverage: CoverageEntry[] | undefined
    if (options.coverage) {
      coverage = await page.coverage.stopJSCoverage()
    }

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
      return { results, close: async () => {}, disconnected: Promise.resolve(), coverage }
    }

    return { results, close, disconnected, coverage }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
