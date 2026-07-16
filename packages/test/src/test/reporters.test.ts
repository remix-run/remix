import * as assert from '@remix-run/assert'
import { DotReporter } from '../lib/reporters/dot.ts'
import { FilesReporter } from '../lib/reporters/files.ts'
import { SpecReporter } from '../lib/reporters/spec.ts'
import { TapReporter } from '../lib/reporters/tap.ts'
import type { TestResults } from '../lib/reporters/results.ts'
import { describe, it } from '../lib/framework.ts'

describe('reporters skip and todo reasons', () => {
  it('prints reasons in the spec reporter', () => {
    let output = captureOutput(() => new SpecReporter().onResult(createPendingResults()))

    assert.match(output, /skipped test # skipped: needs credentials/)
    assert.match(output, /todo test # todo: needs design/)
  })

  it('prints reasons in the files reporter', () => {
    let output = captureOutput(() => new FilesReporter().onResult(createPendingResults()))

    assert.match(output, /suite > skipped test # skipped: needs credentials/)
    assert.match(output, /suite > todo test # todo: needs design/)
  })

  it('prints reasons as TAP directives', () => {
    let output = captureOutput(() => new TapReporter().onResult(createPendingResults()))

    assert.match(output, /ok 1 - suite > skipped test # SKIP needs credentials/)
    assert.match(output, /ok 2 - suite > todo test # TODO needs design/)
  })
})

describe('reporters quiet mode', () => {
  it('omits skipped tests from the spec reporter', () => {
    let output = captureOutput(() =>
      new SpecReporter({ quiet: true }).onResult(createPendingResults()),
    )

    assert.doesNotMatch(output, /skipped test/)
    assert.doesNotMatch(output, /needs credentials/)
    assert.match(output, /todo test # todo: needs design/)
  })

  it('omits skipped tests from the files reporter', () => {
    let output = captureOutput(() =>
      new FilesReporter({ quiet: true }).onResult(createPendingResults()),
    )

    assert.doesNotMatch(output, /skipped test/)
    assert.doesNotMatch(output, /needs credentials/)
    assert.match(output, /suite > todo test # todo: needs design/)
  })

  it('omits skipped tests from the TAP reporter', () => {
    let output = captureOutput(() =>
      new TapReporter({ quiet: true }).onResult(createPendingResults()),
    )

    assert.doesNotMatch(output, /skipped test/)
    assert.doesNotMatch(output, /SKIP needs credentials/)
    assert.match(output, /ok 1 - suite > todo test # TODO needs design/)
  })

  it('omits skipped tests from the dot reporter', () => {
    let output = captureOutput(() => {
      let reporter = new DotReporter({ quiet: true })
      reporter.onResult(createPendingResults())
      reporter.onSummary({ passed: 0, failed: 0, skipped: 1, todo: 1 }, 1)
    })

    assert.doesNotMatch(output, /skipped test/)
    assert.doesNotMatch(output, /needs credentials/)
    assert.match(output, /suite > todo test # todo: needs design/)
    assert.match(output, /skipped 1/)
  })
})

function createPendingResults(): TestResults {
  return {
    passed: 0,
    failed: 0,
    skipped: 1,
    todo: 1,
    tests: [
      {
        name: 'skipped test',
        suiteName: 'suite',
        status: 'skipped',
        reason: 'needs credentials',
        duration: 0,
      },
      {
        name: 'todo test',
        suiteName: 'suite',
        status: 'todo',
        reason: 'needs design',
        duration: 0,
      },
    ],
  }
}

function captureOutput(fn: () => void): string {
  let chunks: string[] = []
  let originalLog = console.log
  let originalWrite = process.stdout.write
  console.log = (...args: unknown[]) => {
    chunks.push(`${args.map(String).join(' ')}\n`)
  }
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk))
    return true
  }) as typeof process.stdout.write
  try {
    fn()
  } finally {
    console.log = originalLog
    process.stdout.write = originalWrite
  }
  return stripAnsi(chunks.join(''))
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
}
