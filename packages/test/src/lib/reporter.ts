import { colors, normalizeLine } from './utils.ts'
import type { TestResult, TestResults } from './executor.ts'

export interface Reporter {
  onResult(results: TestResults, env?: 'server' | 'browser'): void
  onSummary(passed: number, failed: number, durationMs: number): void
}

// ── Spec ─────────────────────────────────────────────────────────────────────

export class SpecReporter implements Reporter {
  onResult(results: TestResults, env?: 'server' | 'browser') {
    let suiteMap = new Map<string, TestResult[]>()
    for (let test of results.tests) {
      let suite = test.suiteName || 'Global'
      if (!suiteMap.has(suite)) suiteMap.set(suite, [])
      suiteMap.get(suite)!.push(test)
    }

    let envLabel = env ? ` ${colors.dim(`[${env}]`)}` : ''

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

  onSummary(passed: number, failed: number, durationMs: number) {
    let info = colors.cyan('ℹ')
    console.log()
    console.log(`${info} tests ${passed + failed}`)
    console.log(`${info} pass ${passed}`)
    console.log(`${info} fail ${failed}`)
    console.log(`${info} duration_ms ${durationMs.toFixed(5)}`)
    console.log()
  }
}

// ── TAP ──────────────────────────────────────────────────────────────────────

export class TapReporter implements Reporter {
  private counter = 0
  private total = 0

  onResult(results: TestResults, env?: 'server' | 'browser') {
    if (this.counter === 0) {
      console.log('TAP version 14')
    }

    let envComment = env ? ` # ${env}` : ''

    for (let test of results.tests) {
      this.counter++
      this.total++
      let fullName = `${test.suiteName} > ${test.name}${envComment}`

      if (test.status === 'passed') {
        console.log(`ok ${this.counter} - ${fullName}`)
      } else {
        console.log(`not ok ${this.counter} - ${fullName}`)
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

  onSummary(passed: number, failed: number, durationMs: number) {
    console.log(`1..${this.total}`)
    console.log(`# tests ${passed + failed}`)
    console.log(`# pass ${passed}`)
    console.log(`# fail ${failed}`)
    console.log(`# duration_ms ${durationMs.toFixed(5)}`)
  }
}

// ── Dot ──────────────────────────────────────────────────────────────────────

export class DotReporter implements Reporter {
  private failures: { name: string; error: TestResult['error'] }[] = []
  private dotCount = 0

  onResult(results: TestResults, _env?: 'server' | 'browser') {
    for (let test of results.tests) {
      if (test.status === 'passed') {
        process.stdout.write(colors.green('.'))
      } else {
        process.stdout.write(colors.red('F'))
        this.failures.push({ name: `${test.suiteName} > ${test.name}`, error: test.error })
      }
      this.dotCount++
    }
  }

  onSummary(passed: number, failed: number, durationMs: number) {
    if (this.dotCount > 0) console.log()

    for (let i = 0; i < this.failures.length; i++) {
      let { name, error } = this.failures[i]
      console.log(`\n  ${colors.red(`${i + 1})`)} ${name}`)
      if (error) {
        console.log(`     ${colors.red(error.message)}`)
        if (error.stack) {
          let frames = error.stack
            .split('\n')
            .slice(1, 4)
            .map((l) => `     ${normalizeLine(l).trim()}`)
            .join('\n')
          console.log(frames)
        }
      }
    }

    let info = colors.cyan('ℹ')
    console.log()
    console.log(`${info} tests ${passed + failed}`)
    console.log(`${info} pass ${passed}`)
    console.log(`${info} fail ${failed}`)
    console.log(`${info} duration_ms ${durationMs.toFixed(5)}`)
    console.log()
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createReporter(type: string): Reporter {
  switch (type) {
    case 'tap':
      return new TapReporter()
    case 'dot':
      return new DotReporter()
    case 'spec':
    default:
      return new SpecReporter()
  }
}
