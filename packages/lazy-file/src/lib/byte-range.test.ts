import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type ByteRange, getByteLength, getIndexes } from './byte-range.ts'

describe('getByteLength', () => {
  it('returns the correct length', () => {
    let size = 100

    let range: ByteRange = { start: 10, end: 20 }
    assert.equal(getByteLength(range, size), 10)

    range = { start: 10, end: -10 }
    assert.equal(getByteLength(range, size), 80)

    range = { start: -10, end: -10 }
    assert.equal(getByteLength(range, size), 0)

    range = { start: -10, end: 20 }
    assert.equal(getByteLength(range, size), 0)

    range = { start: 0, end: Infinity }
    assert.equal(getByteLength(range, size), 100)

    range = { start: Infinity, end: 0 }
    assert.equal(getByteLength(range, size), 0)

    range = { start: Infinity, end: Infinity }
    assert.equal(getByteLength(range, size), 0)
  })
})

describe('getIndexes', () => {
  it('returns the correct indexes', () => {
    let size = 100

    let range: ByteRange = { start: 10, end: 20 }
    assert.deepEqual(getIndexes(range, size), [10, 20])

    range = { start: 10, end: -10 }
    assert.deepEqual(getIndexes(range, size), [10, 90])

    range = { start: -10, end: -10 }
    assert.deepEqual(getIndexes(range, size), [90, 90])

    range = { start: -10, end: 20 }
    assert.deepEqual(getIndexes(range, size), [90, 90])

    range = { start: 0, end: Infinity }
    assert.deepEqual(getIndexes(range, size), [0, 100])

    range = { start: Infinity, end: 0 }
    assert.deepEqual(getIndexes(range, size), [100, 100])

    range = { start: Infinity, end: Infinity }
    assert.deepEqual(getIndexes(range, size), [100, 100])
  })
})
