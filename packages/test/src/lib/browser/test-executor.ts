interface TestResult {
  name: string
  suiteName: string
  status: 'passed' | 'failed'
  error?: {
    message: string
    stack?: string
  }
  duration: number
}

interface TestResults {
  passed: number
  failed: number
  tests: TestResult[]
}

export async function runTests(): Promise<TestResults> {
  let suites = (globalThis as any).__testSuites || []
  let results: TestResults = {
    passed: 0,
    failed: 0,
    tests: [],
  }

  for (let suite of suites) {
    if (suite.beforeAll) {
      try {
        await suite.beforeAll()
      } catch (error) {
        console.error(`beforeAll failed in suite "${suite.name}":`, error)
        continue
      }
    }

    for (let test of suite.tests) {
      let startTime = performance.now()
      let result: TestResult = {
        name: test.name,
        suiteName: suite.name,
        status: 'passed',
        duration: 0,
      }

      try {
        if (suite.beforeEach) {
          await suite.beforeEach()
        }

        await test.fn()

        result.status = 'passed'
        results.passed++
      } catch (error: any) {
        result.status = 'failed'
        console.log('Error in test:', error)
        console.log(error.stack)
        result.error = {
          message: error.message || String(error),
          stack: error.stack,
        }
        results.failed++
        console.error(`Test failed: ${suite.name} > ${test.name}`, error)
      } finally {
        if (suite.afterEach) {
          try {
            await suite.afterEach()
          } catch (error) {
            console.error('afterEach failed:', error)
          }
        }

        result.duration = performance.now() - startTime
        results.tests.push(result)
      }
    }

    if (suite.afterAll) {
      try {
        await suite.afterAll()
      } catch (error) {
        console.error(`afterAll failed in suite "${suite.name}":`, error)
      }
    }
  }

  // Clear suites in-place so the shared test-framework module is reset
  // for the next test file (which reuses the same cached module instance)
  suites.length = 0

  return results
}
