import * as assert from '@remix-run/assert'
import { FilesReporter } from '../lib/reporters/files.ts'
import { SpecReporter } from '../lib/reporters/spec.ts'
import { TapReporter } from '../lib/reporters/tap.ts'
import type { TestResults } from '../lib/reporters/results.ts'
import { describe, it } from '../lib/framework.ts'

describe('reporters skip and todo reasons', () => {
  it('prints reasons in the spec reporter', () => {
    let output = captureConsole(() => new SpecReporter().onResult(createPendingResults()))

    assert.match(output, /skipped test # skipped: needs credentials/)
    assert.match(output, /todo test # todo: needs design/)
  })

  it('prints reasons in the files reporter', () => {
    let output = captureConsole(() => new FilesReporter().onResult(createPendingResults()))

    assert.match(output, /suite > skipped test # skipped: needs credentials/)
    assert.match(output, /suite > todo test # todo: needs design/)
  })

  it('prints reasons as TAP directives', () => {
    let output = captureConsole(() => new TapReporter().onResult(createPendingResults()))

    assert.match(output, /ok 1 - suite > skipped test # SKIP needs credentials/)
    assert.match(output, /ok 2 - suite > todo test # TODO needs design/)
  })
})

describe('SpecReporter focused results', () => {
  it('hides tests skipped by .only filtering', () => {
    let output = captureConsole(() => new SpecReporter().onResult(createFocusedResults()))

    assert.match(output, /focused suite/)
    assert.match(output, /focused test/)
    assert.match(output, /focused skipped test # skipped: focused pending/)
    assert.doesNotMatch(output, /unfocused sibling/)
    assert.doesNotMatch(output, /unfocused suite/)
    assert.doesNotMatch(output, /unfocused cross-suite test/)
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

function createFocusedResults(): TestResults {
  return {
    passed: 1,
    failed: 0,
    skipped: 3,
    todo: 0,
    tests: [
      {
        name: 'focused test',
        suiteName: 'focused suite',
        status: 'passed',
        focused: true,
        duration: 1,
      },
      {
        name: 'focused skipped test',
        suiteName: 'focused suite',
        status: 'skipped',
        reason: 'focused pending',
        focused: true,
        duration: 0,
      },
      {
        name: 'unfocused sibling',
        suiteName: 'focused suite',
        status: 'skipped',
        duration: 0,
      },
      {
        name: 'unfocused cross-suite test',
        suiteName: 'unfocused suite',
        status: 'skipped',
        duration: 0,
      },
    ],
  }
}

function captureConsole(fn: () => void): string {
  let lines: string[] = []
  let originalLog = console.log
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '))
  }
  try {
    fn()
  } finally {
    console.log = originalLog
  }
  return stripAnsi(lines.join('\n'))
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
}
