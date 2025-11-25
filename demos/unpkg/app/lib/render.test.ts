import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatBytes } from './render.ts'

describe('formatBytes', () => {
  it('returns dash for zero bytes', () => {
    assert.equal(formatBytes(0), '-')
  })

  it('formats bytes', () => {
    assert.equal(formatBytes(1), '1 B')
    assert.equal(formatBytes(100), '100 B')
    assert.equal(formatBytes(1023), '1023 B')
  })

  it('formats kilobytes', () => {
    assert.equal(formatBytes(1024), '1.0 kB')
    assert.equal(formatBytes(1536), '1.5 kB')
    assert.equal(formatBytes(10240), '10.0 kB')
    assert.equal(formatBytes(1024 * 1023), '1023.0 kB')
  })

  it('formats megabytes', () => {
    assert.equal(formatBytes(1024 * 1024), '1.0 MB')
    assert.equal(formatBytes(1024 * 1024 * 2.5), '2.5 MB')
    assert.equal(formatBytes(1024 * 1024 * 100), '100.0 MB')
  })
})
