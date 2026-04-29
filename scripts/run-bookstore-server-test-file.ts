import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

type TestResults = {
  passed: number
  failed: number
  skipped: number
  todo: number
  tests: Array<{
    name: string
    suiteName: string
    status: 'passed' | 'failed' | 'skipped' | 'todo'
    duration: number
    error?: {
      message: string
      stack?: string
    }
  }>
}

const testLibDir = '../packages/test/src/lib'

function main(): Promise<void> {
  let [testFile] = process.argv.slice(2)

  if (!testFile) {
    throw new Error('Usage: node ./scripts/run-bookstore-server-test-file.ts <test-file>')
  }

  return runServerTestFile(testFile)
}

async function runServerTestFile(testFile: string): Promise<void> {
  let filePath = path.resolve(process.cwd(), testFile)
  let startTime = performance.now()
  let { importModule } = (await import(`${testLibDir}/import-module.ts`)) as {
    importModule(specifier: string, meta: ImportMeta): Promise<unknown>
  }
  let { runTests } = (await import(`${testLibDir}/executor.ts`)) as {
    runTests(): Promise<TestResults>
  }

  await importModule(pathToFileURL(filePath).href, import.meta)

  let results = await runTests()
  printResults(testFile, results, performance.now() - startTime)

  if (results.failed > 0) {
    process.exitCode = 1
  }
}

function printResults(testFile: string, results: TestResults, durationMs: number) {
  console.log(`${testFile} [server]`)

  for (let test of results.tests) {
    let name = test.name ? `${test.suiteName} > ${test.name}` : test.suiteName
    console.log(`  ${test.status}: ${name} (${test.duration.toFixed(2)}ms)`)

    if (test.error) {
      console.log(`    Error: ${test.error.message}`)
      if (test.error.stack) {
        console.log(test.error.stack)
      }
    }
  }

  console.log()
  console.log(`tests ${results.passed + results.failed + results.skipped + results.todo}`)
  console.log(`pass ${results.passed}`)
  console.log(`fail ${results.failed}`)
  if (results.skipped > 0) console.log(`skipped ${results.skipped}`)
  if (results.todo > 0) console.log(`todo ${results.todo}`)
  console.log(`duration_ms ${durationMs.toFixed(5)}`)
}

await main()
