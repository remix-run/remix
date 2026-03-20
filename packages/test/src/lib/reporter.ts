import { colors, normalizeLine } from './utils.ts'
import type { TestResult, TestResults } from './executor.ts'

export interface Reporter {
  onResult(results: TestResults, env?: 'server' | 'browser'): void
  onSummary(passed: number, failed: number, durationMs: number, skipped?: number, todo?: number): void
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
      let suiteAllSkipped = suiteTests.every((t) => t.status === 'skipped')
      let suiteAllTodo = suiteTests.every((t) => t.status === 'todo')
      let label = suiteHasFailed
        ? colors.red(suiteName)
        : suiteAllSkipped
          ? colors.dim(suiteName)
          : suiteAllTodo
            ? colors.yellow(suiteName)
            : colors.green(suiteName)
      let suiteComment = suiteAllSkipped ? colors.dim(' # skipped') : suiteAllTodo ? colors.yellow(' # todo') : ''
      let duration = suiteComment ? '' : ` (${totalDuration.toFixed(2)}ms)`
      console.log(`${colors.dim('▶')} ${label}${duration}${suiteComment}${envLabel}`)

      for (let test of suiteTests) {
        if (test.status === 'passed') {
          console.log(`  ${colors.green('✓')} ${test.name} (${test.duration.toFixed(2)}ms)`)
        } else if (test.status === 'failed') {
          console.log(`  ${colors.red('✗')} ${test.name} (${test.duration.toFixed(2)}ms)`)
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
        } else if (test.status === 'skipped') {
          if (test.name) console.log(`  ${colors.dim('↓')} ${colors.dim(`${test.name} # skipped`)}`)
        } else if (test.status === 'todo') {
          if (test.name) console.log(`  ${colors.yellow('…')} ${colors.yellow(`${test.name} # todo`)}`)
        }
      }
    }
  }

  onSummary(passed: number, failed: number, durationMs: number, skipped = 0, todo = 0) {
    let info = colors.cyan('ℹ')
    console.log()
    console.log(`${info} tests ${passed + failed + skipped + todo}`)
    console.log(`${info} pass ${passed}`)
    console.log(`${info} fail ${failed}`)
    if (skipped > 0) console.log(`${info} skipped ${skipped}`)
    if (todo > 0) console.log(`${info} todo ${todo}`)
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
      let fullName = test.name ? `${test.suiteName} > ${test.name}${envComment}` : `${test.suiteName}${envComment}`

      if (test.status === 'passed') {
        console.log(`ok ${this.counter} - ${fullName}`)
      } else if (test.status === 'skipped') {
        console.log(`ok ${this.counter} - ${fullName} # SKIP`)
      } else if (test.status === 'todo') {
        console.log(`ok ${this.counter} - ${fullName} # TODO`)
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

  onSummary(passed: number, failed: number, durationMs: number, skipped = 0, todo = 0) {
    console.log(`1..${this.total}`)
    console.log(`# tests ${passed + failed + skipped + todo}`)
    console.log(`# pass ${passed}`)
    console.log(`# fail ${failed}`)
    if (skipped > 0) console.log(`# skipped ${skipped}`)
    if (todo > 0) console.log(`# todo ${todo}`)
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
      } else if (test.status === 'skipped') {
        process.stdout.write(colors.dim('S'))
      } else if (test.status === 'todo') {
        process.stdout.write(colors.dim('T'))
      } else {
        process.stdout.write(colors.red('F'))
        this.failures.push({ name: `${test.suiteName} > ${test.name}`, error: test.error })
      }
      this.dotCount++
    }
  }

  onSummary(passed: number, failed: number, durationMs: number, skipped = 0, todo = 0) {
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
    console.log(`${info} tests ${passed + failed + skipped + todo}`)
    console.log(`${info} pass ${passed}`)
    console.log(`${info} fail ${failed}`)
    if (skipped > 0) console.log(`${info} skipped ${skipped}`)
    if (todo > 0) console.log(`${info} todo ${todo}`)
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
