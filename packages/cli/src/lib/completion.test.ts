import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getCompletionResult, getCompletionScript } from './completion.ts'

describe('completion engine', () => {
  it('completes top-level commands and flags', () => {
    let result = getCompletionResult(['remix', ''], 1)

    assert.equal(result.mode, 'values')
    assert.deepEqual(result.values, [
      'completion',
      'db',
      'doctor',
      'help',
      'new',
      'routes',
      'test',
      'version',
      '--config',
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
      'db',
      'doctor',
      'help',
      'new',
      'routes',
      'test',
      'version',
      '--config',
      '-h',
      '--help',
      '--no-color',
    ])
  })

  it('completes database subcommands and per-command flags', () => {
    let subcommands = getCompletionResult(['remix', 'db', ''], 2)
    let wipeFlags = getCompletionResult(['remix', 'db', 'wipe', ''], 3)
    let resetFlags = getCompletionResult(['remix', 'db', 'reset', '--force', ''], 4)
    let migrateFlags = getCompletionResult(['remix', 'db', 'migrate', ''], 3)
    let seedFlags = getCompletionResult(['remix', 'db', 'seed', ''], 3)

    assert.equal(subcommands.mode, 'values')
    assert.deepEqual(subcommands.values, [
      'migrate',
      'reset',
      'seed',
      'status',
      'wipe',
      '--config',
      '-h',
      '--help',
      '--no-color',
    ])

    assert.equal(wipeFlags.mode, 'values')
    assert.deepEqual(wipeFlags.values, ['--force', '--config', '-h', '--help', '--no-color'])

    assert.equal(resetFlags.mode, 'values')
    assert.deepEqual(resetFlags.values, ['--config', '-h', '--help', '--no-color'])

    assert.equal(migrateFlags.mode, 'values')
    assert.deepEqual(migrateFlags.values, ['--to', '--config', '-h', '--help', '--no-color'])

    assert.equal(seedFlags.mode, 'values')
    assert.deepEqual(seedFlags.values, ['--config', '-h', '--help', '--no-color'])
  })

  it('returns no completions for free-text migration targets', () => {
    let result = getCompletionResult(['remix', 'db', 'migrate', '--to', ''], 4)

    assert.deepEqual(result, { mode: 'none' })
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
    assert.deepEqual(result.values, [
      '--fix',
      '--strict',
      '--no-strict',
      '--config',
      '-h',
      '--help',
      '--no-color',
    ])
  })

  it('filters invalid routes flag combinations', () => {
    let jsonResult = getCompletionResult(['remix', 'routes', '--json', ''], 3)
    let tableResult = getCompletionResult(['remix', 'routes', '--table', ''], 3)

    assert.equal(jsonResult.mode, 'values')
    assert.deepEqual(jsonResult.values, ['--config', '-h', '--help', '--no-color'])

    assert.equal(tableResult.mode, 'values')
    assert.deepEqual(tableResult.values, [
      '--no-headers',
      '--verbose',
      '--config',
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

  it('completes all test flags and aliases', () => {
    let result = getCompletionResult(['remix', 'test', ''], 2)

    assert.equal(result.mode, 'values')
    assert.ok(result.values?.includes('--browser.echo'))
    assert.ok(result.values?.includes('--coverage.statements'))
    assert.ok(result.values?.includes('--playwrightConfig'))
    assert.ok(result.values?.includes('--project'))
    assert.ok(result.values?.includes('-p'))
    assert.ok(result.values?.includes('-h'))
    assert.ok(result.values?.includes('--help'))
    assert.ok(result.values?.includes('--no-color'))
  })

  it('uses file completion for test path flags and does not repeat singular flags', () => {
    let configValue = getCompletionResult(['remix', 'test', '--config', ''], 3)
    let inlineConfigValue = getCompletionResult(['remix', 'test', '--config=custom'], 2)
    let usedConfig = getCompletionResult(['remix', 'test', '--config=custom.json', ''], 3)
    let usedCoverage = getCompletionResult(['remix', 'test', '--coverage', ''], 3)

    assert.deepEqual(configValue, { mode: 'files' })
    assert.deepEqual(inlineConfigValue, { mode: 'files' })
    assert.equal(usedConfig.mode, 'values')
    assert.ok(!usedConfig.values?.includes('--config'))
    assert.equal(usedCoverage.mode, 'values')
    assert.ok(!usedCoverage.values?.includes('--coverage'))
    assert.ok(usedCoverage.values?.includes('--coverage.include'))
  })

  it('recognizes test flags with inline =values', () => {
    let result = getCompletionResult(['remix', 'test', '--reporter=spec', ''], 3)

    assert.equal(result.mode, 'values')
    assert.ok(!result.values?.includes('--reporter'))
    assert.ok(result.values?.includes('--watch'))
  })

  it('recognizes short test flags with attached values', () => {
    let result = getCompletionResult(['remix', 'test', '-c1', ''], 3)

    assert.equal(result.mode, 'values')
    assert.ok(!result.values?.includes('--concurrency'))
    assert.ok(!result.values?.includes('-c'))
    assert.ok(result.values?.includes('--watch'))
  })

  it('recognizes grouped boolean short test flags', () => {
    let result = getCompletionResult(['remix', 'test', '-qw', ''], 3)

    assert.equal(result.mode, 'values')
    assert.ok(!result.values?.includes('--quiet'))
    assert.ok(!result.values?.includes('--watch'))
    assert.ok(result.values?.includes('--coverage'))
  })

  it('treats everything after -- as positional test globs', () => {
    let result = getCompletionResult(['remix', 'test', '--', ''], 3)

    assert.deepEqual(result, { mode: 'files' })
  })
})

describe('completion script', () => {
  it('references the hidden completion plumbing mode', () => {
    let script = getCompletionScript()

    assert.match(script, /remix completion -- "\$cword" "\$\{words\[@\]\}"/)
    assert.match(script, /remix completion -- "\$\(\(CURRENT - 1\)\)" "\$\{words\[@\]\}"/)
  })

  it('completes the file portion of inline config flags', () => {
    let script = getCompletionScript()

    assert.match(script, /_get_comp_words_by_ref -n = -w words -i cword/)
    assert.match(script, /compgen -f -- "\$config_value"/)
    assert.match(script, /compset -P '--config='/)
  })
})
