import { colors, normalizeLine } from './utils.ts'

export interface TestResult {
  name: string
  suiteName: string
  filePath?: string
  status: 'passed' | 'failed'
  error?: {
    message: string
    stack?: string
  }
  duration: number
}

export interface TestResults {
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

  // Clear suites in-place so the shared framework module is reset
  // for the next test file (which reuses the same cached module instance)
  suites.length = 0

  return results
}

export function displayResults(results: TestResults, env?: 'server' | 'browser') {
  let fileMap = new Map<string, typeof results.tests>()

  for (let test of results.tests) {
    let file = test.filePath || 'Unknown'
    if (!fileMap.has(file)) {
      fileMap.set(file, [])
    }
    fileMap.get(file)!.push(test)
  }

  let cwd = process.cwd().replace(/\\/g, '/')
  let fileOrder = Array.from(fileMap.keys()).sort()

  for (let file of fileOrder) {
    let tests = fileMap.get(file)!
    let displayPath = file.replace(`${cwd}/`, './')
    let envLabel = env ? ` ${colors.dim(`[${env}]`)}` : ''

    let suiteMap = new Map<string, typeof tests>()
    for (let test of tests) {
      let suite = test.suiteName || 'Global'
      if (!suiteMap.has(suite)) {
        suiteMap.set(suite, [])
      }
      suiteMap.get(suite)!.push(test)
    }

    for (let [suiteName, suiteTests] of suiteMap) {
      let totalDuration = suiteTests.reduce((sum, t) => sum + t.duration, 0)
      let suiteHasFailed = suiteTests.some((t) => t.status === 'failed')
      let label = suiteHasFailed ? colors.red(suiteName) : colors.green(suiteName)
      console.log(`${colors.dim('▶')} ${label} (${totalDuration.toFixed(2)}ms)${envLabel}`)

      for (let test of suiteTests) {
        let passed = test.status === 'passed'
        let icon = passed ? colors.green('✓') : colors.red('✗')

        console.log(`  ${icon} ${test.name} (${test.duration.toFixed(2)}ms)`)

        if (test.error) {
          console.log(`    ${colors.red(`Error: ${test.error.message}`)}`)
          if (test.error.stack) {
            let stack = test.error.stack
              .split('\n')
              .map((line) => normalizeLine(line))
              .join('\n')
            console.log(`      ${stack.split('\n').slice(1, 5).join('\n      ')}`)
          }
        }
      }
    }
  }
}

export function displaySummary(passed: number, failed: number, durationMs: number) {
  let info = colors.cyan('ℹ')
  console.log()
  console.log(`${info} tests ${passed + failed}`)
  console.log(`${info} pass ${passed}`)
  console.log(`${info} fail ${failed}`)
  console.log(`${info} duration_ms ${durationMs.toFixed(5)}`)
  console.log()
}
