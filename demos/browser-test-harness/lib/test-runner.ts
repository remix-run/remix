import { chromium, type Browser } from 'playwright'

export interface TestRunOptions {
  baseUrl: string
  headless?: boolean
  debug?: boolean
  devtools?: boolean
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

export async function runTests(files: string[], options: TestRunOptions): Promise<TestResults> {
  let browser: Browser | undefined

  try {
    browser = await chromium.launch({
      headless: options.headless,
      devtools: options.devtools,
    })

    let aggregatedResults: TestResults = {
      passed: 0,
      failed: 0,
      tests: [],
    }

    for (let file of files) {
      let page = await browser.newPage()

      if (options.debug) {
        page.on('console', (msg) => console.log(`  [Browser] ${msg.text()}`))
      }

      let testPath = encodeURIComponent(file)
      await page.goto(`${options.baseUrl}/_test/${testPath}`)

      await page.waitForFunction('window.__testResults', { timeout: 30000 })
      let results = (await page.evaluate('window.__testResults')) as TestResults

      aggregatedResults.passed += results.passed
      aggregatedResults.failed += results.failed
      let testsWithFile = results.tests.map((test) => ({ ...test, filePath: file }))
      aggregatedResults.tests.push(...testsWithFile)

      await page.close()
    }

    return aggregatedResults
  } finally {
    await browser?.close()
  }
}
