import { createTestContext } from './context.ts'

export interface TestResult {
  name: string
  suiteName: string
  filePath?: string
  status: 'passed' | 'failed' | 'skipped' | 'todo'
  error?: {
    message: string
    stack?: string
  }
  duration: number
}

export interface TestResults {
  passed: number
  failed: number
  skipped: number
  todo: number
  tests: TestResult[]
}

export async function runTests(): Promise<TestResults> {
  let suites = (globalThis as any).__testSuites || []
  let results: TestResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    todo: 0,
    tests: [],
  }

  let hasOnlySuites = suites.some((s: any) => s.only)

  for (let suite of suites) {
    // If any suite uses .only, skip all non-only suites
    if (hasOnlySuites && !suite.only) {
      for (let test of suite.tests) {
        results.tests.push({
          name: test.name,
          suiteName: suite.name,
          status: 'skipped',
          duration: 0,
        })
        results.skipped++
      }
      continue
    }

    if (suite.skip || suite.todo) {
      let status: 'skipped' | 'todo' = suite.todo ? 'todo' : 'skipped'
      for (let test of suite.tests) {
        results.tests.push({ name: test.name, suiteName: suite.name, status, duration: 0 })
        results[status]++
      }
      // describe.todo('name') with no tests — add placeholder so suite appears in output
      if (suite.tests.length === 0) {
        results.tests.push({ name: '', suiteName: suite.name, status, duration: 0 })
        results[status]++
      }
      continue
    }

    if (suite.beforeAll) {
      try {
        await suite.beforeAll()
      } catch (error) {
        console.error(`beforeAll failed in suite "${suite.name}":`, error)
        continue
      }
    }

    let hasOnlyTests = suite.tests.some((t: any) => t.only)

    for (let test of suite.tests) {
      // If any test uses .only, skip all non-only tests in this suite
      if (hasOnlyTests && !test.only) {
        results.tests.push({
          name: test.name,
          suiteName: suite.name,
          status: 'skipped',
          duration: 0,
        })
        results.skipped++
        continue
      }

      if (test.skip || test.todo) {
        let status: 'skipped' | 'todo' = test.todo ? 'todo' : 'skipped'
        results.tests.push({ name: test.name, suiteName: suite.name, status, duration: 0 })
        results[status]++
        continue
      }

      let startTime = performance.now()
      let result: TestResult = {
        name: test.name,
        suiteName: suite.name,
        status: 'passed',
        duration: 0,
      }

      let { testContext, cleanup } = createTestContext()
      try {
        if (suite.beforeEach) {
          await suite.beforeEach()
        }

        await test.fn(testContext)

        result.status = 'passed'
        results.passed++
      } catch (error: any) {
        result.status = 'failed'
        result.error = {
          message: error.message || String(error),
          stack: error.stack,
        }
        results.failed++
      } finally {
        await cleanup()
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

  // Clear suites in-place so the shared framework module is reset
  // for the next test file (which reuses the same cached module instance)
  suites.length = 0

  return results
}
