import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { getDefaultEnvironment, shouldUseColors } from './env.ts'

describe('shouldUseColors', () => {
  it('disables colors with NO_COLOR', () => {
    assert.equal(shouldUseColors({ env: { NO_COLOR: '' }, stream: { isTTY: true } }), false)
  })

  it('respects FORCE_COLOR', () => {
    assert.equal(shouldUseColors({ env: { FORCE_COLOR: '1' }, stream: { isTTY: false } }), true)
    assert.equal(shouldUseColors({ env: { FORCE_COLOR: 'true' }, stream: { isTTY: false } }), true)
    assert.equal(shouldUseColors({ env: { FORCE_COLOR: '0' }, stream: { isTTY: true } }), false)
    assert.equal(shouldUseColors({ env: { FORCE_COLOR: 'false' }, stream: { isTTY: true } }), false)
  })

  it('disables colors in CI', () => {
    assert.equal(shouldUseColors({ env: { CI: 'true' }, stream: { isTTY: true } }), false)
  })

  it('disables colors for dumb terminals', () => {
    assert.equal(shouldUseColors({ env: { TERM: 'dumb' }, stream: { isTTY: true } }), false)
  })

  it('falls back to TTY support', () => {
    assert.equal(shouldUseColors({ env: {}, stream: { isTTY: true } }), true)
    assert.equal(shouldUseColors({ env: {}, stream: { isTTY: false } }), false)
    assert.equal(shouldUseColors({ env: {}, stream: {} }), false)
  })
})

describe('getDefaultEnvironment', () => {
  it('returns the current process environment in Node-compatible runtimes', () => {
    assert.equal(getDefaultEnvironment(), process.env)
  })
})
