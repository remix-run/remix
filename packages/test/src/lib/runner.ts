import { tsImport } from 'tsx/esm/api'
import { displayResults, runTests } from './executor.ts'

export async function runServerTests(files: string[]): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0

  for (let file of files) {
    await tsImport(file, { parentURL: import.meta.url })
    let results = await runTests()
    displayResults({ ...results, tests: results.tests.map((t) => ({ ...t, filePath: file })) }, 'server')
    passed += results.passed
    failed += results.failed
  }

  return { passed, failed }
}
