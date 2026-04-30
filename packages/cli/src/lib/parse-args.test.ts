import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { parseArgs } from './parse-args.ts'

describe('parseArgs', () => {
  it('parses boolean flags, string options, and positionals', () => {
    let result = parseArgs(
      ['my-app', '--app-name', 'My App', '--force'],
      {
        appName: { flag: '--app-name', type: 'string' },
        force: { flag: '--force', type: 'boolean' },
      },
      { maxPositionals: 1 },
    )

    assert.deepEqual(result, {
      options: {
        appName: 'My App',
        force: true,
      },
      positionals: ['my-app'],
    })
  })

  it('defaults boolean flags to false and string options to undefined', () => {
    let result = parseArgs([], {
      dir: { flag: '--dir', type: 'string' },
      json: { flag: '--json', type: 'boolean' },
    })

    assert.deepEqual(result, {
      options: {
        dir: undefined,
        json: false,
      },
      positionals: [],
    })
  })

  it('throws for missing string option values', () => {
    assert.throws(
      () =>
        parseArgs(['--dir'], {
          dir: { flag: '--dir', type: 'string' },
        }),
      /--dir requires a value\./,
    )
  })

  it('throws for missing string option values before another flag', () => {
    assert.throws(
      () =>
        parseArgs(['--dir', '--json'], {
          dir: { flag: '--dir', type: 'string' },
          json: { flag: '--json', type: 'boolean' },
        }),
      /--dir requires a value\./,
    )
  })

  it('throws for unknown flags', () => {
    assert.throws(
      () =>
        parseArgs(['--nope'], {
          json: { flag: '--json', type: 'boolean' },
        }),
      /Unknown argument: --nope/,
    )
  })

  it('throws for extra positionals beyond the configured maximum', () => {
    assert.throws(
      () => parseArgs(['first', 'second'], {}, { maxPositionals: 1 }),
      /Unexpected extra argument: second/,
    )
  })
})
