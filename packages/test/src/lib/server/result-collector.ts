import { normalizeFilePath, normalizeLine } from '../browser/utils.ts'
import type { TestResults } from './test-runner.ts'

export function displayResults(results: TestResults) {
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
    console.log(`\n${normalizeFilePath(displayPath)}`)

    let suiteMap = new Map<string, typeof tests>()
    for (let test of tests) {
      let suite = test.suiteName || 'Global'
      if (!suiteMap.has(suite)) {
        suiteMap.set(suite, [])
      }
      suiteMap.get(suite)!.push(test)
    }

    for (let [suiteName, suiteTests] of suiteMap) {
      console.log(`  ${suiteName}:`)

      for (let test of suiteTests) {
        let icon = test.status === 'passed' ? '✓' : '✗'
        let color = test.status === 'passed' ? '\x1b[32m' : '\x1b[31m'
        let reset = '\x1b[0m'

        console.log(`    ${color}${icon}${reset} ${test.name} (${test.duration.toFixed(2)}ms)`)

        if (test.error) {
          console.log(`      ${color}Error: ${test.error.message}${reset}`)
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

  console.log('\n' + '='.repeat(60))
  let totalColor = results.failed > 0 ? '\x1b[31m' : '\x1b[32m'
  console.log(`${totalColor}Total: ${results.passed} passed, ${results.failed} failed\x1b[0m`)
  console.log('='.repeat(60) + '\n')
}
