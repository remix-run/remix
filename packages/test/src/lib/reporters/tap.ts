import { normalizeLine } from '../normalize.ts'
import type { Reporter } from './index.ts'
import type { Counts, TestResults } from './results.ts'

export class TapReporter implements Reporter {
  #counter = 0
  #total = 0
  #files = new Set<string>()
  #suites = new Set<string>()

  onSectionStart(_label: string) {}

  onResult(results: TestResults, env?: string) {
    if (this.#counter === 0) {
      console.log('TAP version 14')
    }

    let envComment = env ? ` # ${env}` : ''

    for (let test of results.tests) {
      if (test.filePath) this.#files.add(test.filePath)
      if (test.suiteName) this.#suites.add(test.suiteName)
    }

    for (let test of results.tests) {
      this.#counter++
      this.#total++
      let fullName = test.name
        ? `${test.suiteName} > ${test.name}${envComment}`
        : `${test.suiteName}${envComment}`

      if (test.status === 'passed') {
        console.log(`ok ${this.#counter} - ${fullName}`)
      } else if (test.status === 'skipped') {
        console.log(`ok ${this.#counter} - ${fullName} # SKIP`)
      } else if (test.status === 'todo') {
        console.log(`ok ${this.#counter} - ${fullName} # TODO`)
      } else {
        console.log(`not ok ${this.#counter} - ${fullName}`)
        console.log('  ---')
        console.log(`  message: ${test.error?.message ?? 'unknown error'}`)
        if (test.error?.stack) {
          let frames = test.error.stack
            .split('\n')
            .slice(1, 4)
            .map((l) => normalizeLine(l).trim())
            .join('\n    ')
          console.log(`  stack: |\n    ${frames}`)
        }
        console.log('  ...')
      }
    }
  }

  onSummary(counts: Counts, durationMs: number) {
    let { passed, failed, skipped, todo } = counts
    console.log(`1..${this.#total}`)
    console.log(`# files ${this.#files.size}`)
    console.log(`# suites ${this.#suites.size}`)
    console.log(`# tests ${passed + failed + skipped + todo}`)
    console.log(`# pass ${passed}`)
    console.log(`# fail ${failed}`)
    if (skipped > 0) console.log(`# skipped ${skipped}`)
    if (todo > 0) console.log(`# todo ${todo}`)
    console.log(`# duration_ms ${durationMs.toFixed(5)}`)
  }
}
