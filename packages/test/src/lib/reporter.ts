import { colors, normalizeLine, type Counts } from './utils.ts'
import type { TestResult, TestResults } from './executor.ts'

export interface Reporter {
  onResult(results: TestResults, env?: string): void
  onSummary(counts: Counts, durationMs: number): void
  onSectionStart(label: string): void
}

// ── Spec ─────────────────────────────────────────────────────────────────────

export class SpecReporter implements Reporter {
  #failures: { suiteName: string; name: string; error: TestResult['error'] }[] = []

  onSectionStart(label: string) {
    console.log(label)
  }

  onResult(results: TestResults, env?: string) {
    let suiteMap = new Map<string, TestResult[]>()
    for (let test of results.tests) {
      let suite = test.suiteName || 'Global'
      if (!suiteMap.has(suite)) suiteMap.set(suite, [])
      suiteMap.get(suite)!.push(test)
    }

    let envLabel = env ? ` ${colors.dim(`[${env}]`)}` : ''
    let lastParts: string[] = []

    // Pre-compute aggregate test results for each path prefix so non-leaf
    // suite headings can be colored the same way as leaf headings.
    let prefixTests = new Map<string, TestResult[]>()
    for (let [suiteName, tests] of suiteMap) {
      let parts = suiteName.split(' > ')
      for (let i = 0; i < parts.length; i++) {
        let prefix = parts.slice(0, i + 1).join(' > ')
        if (!prefixTests.has(prefix)) prefixTests.set(prefix, [])
        prefixTests.get(prefix)!.push(...tests)
      }
    }

    for (let [suiteName, suiteTests] of suiteMap) {
      let parts = suiteName.split(' > ')

      // Find where this path diverges from the last rendered path
      let commonLen = 0
      while (
        commonLen < lastParts.length &&
        commonLen < parts.length &&
        lastParts[commonLen] === parts[commonLen]
      ) {
        commonLen++
      }

      // Print each new path component
      for (let i = commonLen; i < parts.length; i++) {
        let indent = '  '.repeat(i)
        let isLeaf = i === parts.length - 1

        if (isLeaf) {
          let totalDuration = suiteTests.reduce((sum, t) => sum + t.duration, 0)
          let suiteHasFailed = suiteTests.some((t) => t.status === 'failed')
          let suiteAllSkipped = suiteTests.every((t) => t.status === 'skipped')
          let suiteAllTodo = suiteTests.every((t) => t.status === 'todo')
          let label = suiteHasFailed
            ? colors.red(parts[i])
            : suiteAllSkipped
              ? colors.dim(parts[i])
              : suiteAllTodo
                ? colors.yellow(parts[i])
                : colors.green(parts[i])
          let suiteComment = suiteAllSkipped
            ? colors.dim(' # skipped')
            : suiteAllTodo
              ? colors.yellow(' # todo')
              : ''
          let duration = suiteComment ? '' : ` (${totalDuration.toFixed(2)}ms)`
          let label2 = envLabel
          console.log(`${indent}${colors.dim('▶')} ${label}${duration}${suiteComment}${label2}`)
        } else {
          let prefix = parts.slice(0, i + 1).join(' > ')
          let prefixTestList = prefixTests.get(prefix) ?? []
          let prefixHasFailed = prefixTestList.some((t) => t.status === 'failed')
          let prefixAllSkipped =
            prefixTestList.length > 0 && prefixTestList.every((t) => t.status === 'skipped')
          let prefixAllTodo =
            prefixTestList.length > 0 && prefixTestList.every((t) => t.status === 'todo')
          let nameColor = prefixHasFailed
            ? colors.red
            : prefixAllSkipped
              ? colors.dim
              : prefixAllTodo
                ? colors.yellow
                : colors.green
          let prefixDuration = prefixTestList.reduce((sum, t) => sum + t.duration, 0)
          let prefixComment = prefixAllSkipped
            ? colors.dim(' # skipped')
            : prefixAllTodo
              ? colors.yellow(' # todo')
              : ''
          let prefixDurationStr = prefixComment ? '' : ` (${prefixDuration.toFixed(2)}ms)`
          console.log(
            `${indent}${colors.dim('▶')} ${nameColor(parts[i])}${prefixDurationStr}${prefixComment}${envLabel}`,
          )
        }
      }

      lastParts = parts

      // Print tests indented to the suite's depth
      let testIndent = '  '.repeat(parts.length)
      for (let test of suiteTests) {
        if (test.status === 'passed') {
          console.log(
            `${testIndent}${colors.green('✓')} ${test.name} (${test.duration.toFixed(2)}ms)`,
          )
        } else if (test.status === 'failed') {
          console.log(
            `${testIndent}${colors.red('✗')} ${test.name} (${test.duration.toFixed(2)}ms)`,
          )
          if (test.error) {
            console.log(`${testIndent}  ${colors.red(`Error: ${test.error.message}`)}`)
            if (test.error.stack) {
              let stack = test.error.stack
                .split('\n')
                .map((line) => normalizeLine(line))
                .join('\n')
              console.log(
                `${testIndent}    ${stack.split('\n').slice(1, 5).join(`\n${testIndent}    `)}`,
              )
            }
          }
          this.#failures.push({ suiteName: test.suiteName, name: test.name, error: test.error })
        } else if (test.status === 'skipped') {
          if (test.name)
            console.log(`${testIndent}${colors.dim('↓')} ${colors.dim(`${test.name} # skipped`)}`)
        } else if (test.status === 'todo') {
          if (test.name)
            console.log(
              `${testIndent}${colors.yellow('…')} ${colors.yellow(`${test.name} # todo`)}`,
            )
        }
      }
    }
  }

  onSummary(counts: Counts, durationMs: number) {
    if (this.#failures.length > 0) {
      console.log()
      console.log(colors.red('Failed tests:'))
      for (let i = 0; i < this.#failures.length; i++) {
        let { suiteName, name, error } = this.#failures[i]
        let fullName = name ? `${suiteName} > ${name}` : suiteName
        console.log(`\n  ${colors.red(`${i + 1})`)} ${fullName}`)
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
    }

    let { passed, failed, skipped, todo } = counts
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
  #counter = 0
  #total = 0

  onSectionStart(_label: string) {}

  onResult(results: TestResults, env?: string) {
    if (this.#counter === 0) {
      console.log('TAP version 14')
    }

    let envComment = env ? ` # ${env}` : ''

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
  #failures: { name: string; error: TestResult['error'] }[] = []
  #dotCount = 0

  onSectionStart(_label: string) {}

  onResult(results: TestResults, _env?: string) {
    for (let test of results.tests) {
      if (test.status === 'passed') {
        process.stdout.write(colors.green('.'))
      } else if (test.status === 'skipped') {
        process.stdout.write(colors.dim('S'))
      } else if (test.status === 'todo') {
        process.stdout.write(colors.dim('T'))
      } else {
        process.stdout.write(colors.red('F'))
        this.#failures.push({ name: `${test.suiteName} > ${test.name}`, error: test.error })
      }
      this.#dotCount++
    }
  }

  onSummary(counts: Counts, durationMs: number) {
    if (this.#dotCount > 0) console.log()

    for (let i = 0; i < this.#failures.length; i++) {
      let { name, error } = this.#failures[i]
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

    let { passed, failed, skipped, todo } = counts
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
