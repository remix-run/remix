import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getCompletionResult, getCompletionScript } from './completion.ts'

describe('completion engine', () => {
  it('completes top-level commands and flags', () => {
    let result = getCompletionResult(['remix', ''], 1)

    assert.equal(result.mode, 'values')
    assert.deepEqual(result.values, [
      'completion',
      'doctor',
      'help',
      'new',
      'routes',
      'test',
      'version',
      '-h',
      '--help',
      '--no-color',
      '-v',
      '--version',
    ])
  })

  it('completes nested help topics', () => {
    let topLevelResult = getCompletionResult(['remix', 'help', ''], 2)

    assert.equal(topLevelResult.mode, 'values')
    assert.deepEqual(topLevelResult.values, [
      'completion',
      'doctor',
      'help',
      'new',
      'routes',
      'test',
      'version',
      '-h',
      '--help',
      '--no-color',
    ])
  })

  it('uses file completion for new target directories', () => {
    let newResult = getCompletionResult(['remix', 'new', ''], 2)

    assert.equal(newResult.mode, 'files')
  })

  it('returns no completions for free-text --app-name values', () => {
    let result = getCompletionResult(['remix', 'new', 'my-app', '--app-name', ''], 4)

    assert.deepEqual(result, { mode: 'none' })
  })

  it('does not repeat flags that are already present', () => {
    let result = getCompletionResult(['remix', 'doctor', '--json', ''], 3)

    assert.equal(result.mode, 'values')
    assert.deepEqual(result.values, ['--fix', '--strict', '-h', '--help', '--no-color'])
  })

  it('filters invalid routes flag combinations', () => {
    let jsonResult = getCompletionResult(['remix', 'routes', '--json', ''], 3)
    let tableResult = getCompletionResult(['remix', 'routes', '--table', ''], 3)

    assert.equal(jsonResult.mode, 'values')
    assert.deepEqual(jsonResult.values, ['-h', '--help', '--no-color'])

    assert.equal(tableResult.mode, 'values')
    assert.deepEqual(tableResult.values, [
      '--no-headers',
      '--verbose',
      '-h',
      '--help',
      '--no-color',
    ])
  })

  it('keeps --no-color available until it is used', () => {
    let available = getCompletionResult(['remix', 'routes', ''], 2)
    let consumed = getCompletionResult(['remix', 'routes', '--no-color', ''], 3)

    assert.equal(available.mode, 'values')
    assert.ok(available.values?.includes('--no-color'))
    assert.equal(consumed.mode, 'values')
    assert.ok(!consumed.values?.includes('--no-color'))
  })

  it('only suggests version flags before a command is chosen', () => {
    let topLevel = getCompletionResult(['remix', ''], 1)
    let nested = getCompletionResult(['remix', 'doctor', ''], 2)

    assert.equal(topLevel.mode, 'values')
    assert.ok(topLevel.values?.includes('-v'))
    assert.ok(topLevel.values?.includes('--version'))

    assert.equal(nested.mode, 'values')
    assert.ok(!nested.values?.includes('-v'))
    assert.ok(!nested.values?.includes('--version'))
  })
})

describe('completion script', () => {
  it('references the hidden completion plumbing mode', () => {
    let script = getCompletionScript()

    assert.match(script, /remix completion -- "\$cword" "\$\{words\[@\]\}"/)
    assert.match(script, /remix completion -- "\$\(\(CURRENT - 1\)\)" "\$\{words\[@\]\}"/)
  })
})
