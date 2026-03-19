import { tsImport } from 'tsx/esm/api'
import { runTests } from '../executor.ts'
import { displayResults } from './result-collector.ts'
import type { TestResults } from './runner.ts'

export async function runNodeTests(files: string[]): Promise<{ failed: boolean }> {
  let allResults: TestResults = { passed: 0, failed: 0, tests: [] }

  for (let file of files) {
    await tsImport(file, { parentURL: import.meta.url })
    let results = await runTests()
    allResults.passed += results.passed
    allResults.failed += results.failed
    for (let test of results.tests) {
      allResults.tests.push({ ...test, filePath: file })
    }
  }

  displayResults(allResults)
  return { failed: allResults.failed > 0 }
}
