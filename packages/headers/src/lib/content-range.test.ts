import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ContentRange } from './content-range.ts'

describe('ContentRange', () => {
  it('initializes with an empty string', () => {
    let contentRange = new ContentRange('')
    assert.equal(contentRange.unit, '')
    assert.equal(contentRange.start, null)
    assert.equal(contentRange.end, null)
    assert.equal(contentRange.size, undefined)
  })

  it('initializes with a string (satisfied range)', () => {
    let contentRange = new ContentRange('bytes 200-1000/67589')
    assert.equal(contentRange.unit, 'bytes')
    assert.equal(contentRange.start, 200)
    assert.equal(contentRange.end, 1000)
    assert.equal(contentRange.size, 67589)
  })

  it('initializes with a string (unsatisfied range)', () => {
    let contentRange = new ContentRange('bytes */67589')
    assert.equal(contentRange.unit, 'bytes')
    assert.equal(contentRange.start, null)
    assert.equal(contentRange.end, null)
    assert.equal(contentRange.size, 67589)
  })

  it('initializes with a string (unknown size)', () => {
    let contentRange = new ContentRange('bytes 0-999/*')
    assert.equal(contentRange.unit, 'bytes')
    assert.equal(contentRange.start, 0)
    assert.equal(contentRange.end, 999)
    assert.equal(contentRange.size, '*')
  })

  it('initializes with an object', () => {
    let contentRange = new ContentRange({
      unit: 'bytes',
      start: 200,
      end: 1000,
      size: 67589,
    })
    assert.equal(contentRange.unit, 'bytes')
    assert.equal(contentRange.start, 200)
    assert.equal(contentRange.end, 1000)
    assert.equal(contentRange.size, 67589)
  })

  it('initializes with another ContentRange', () => {
    let contentRange1 = new ContentRange({
      unit: 'bytes',
      start: 200,
      end: 1000,
      size: 67589,
    })
    let contentRange2 = new ContentRange(contentRange1)
    assert.equal(contentRange2.unit, 'bytes')
    assert.equal(contentRange2.start, 200)
    assert.equal(contentRange2.end, 1000)
    assert.equal(contentRange2.size, 67589)
  })

  it('sets and gets unit', () => {
    let contentRange = new ContentRange()
    contentRange.unit = 'items'
    assert.equal(contentRange.unit, 'items')
  })

  it('sets and gets start', () => {
    let contentRange = new ContentRange()
    contentRange.start = 100
    assert.equal(contentRange.start, 100)
  })

  it('sets and gets end', () => {
    let contentRange = new ContentRange()
    contentRange.end = 500
    assert.equal(contentRange.end, 500)
  })

  it('sets and gets size', () => {
    let contentRange = new ContentRange()
    contentRange.size = 1000
    assert.equal(contentRange.size, 1000)
  })

  it('converts to string correctly (satisfied range)', () => {
    let contentRange = new ContentRange({
      unit: 'bytes',
      start: 200,
      end: 1000,
      size: 67589,
    })
    assert.equal(contentRange.toString(), 'bytes 200-1000/67589')
  })

  it('converts to string correctly (unsatisfied range)', () => {
    let contentRange = new ContentRange({
      unit: 'bytes',
      start: null,
      end: null,
      size: 67589,
    })
    assert.equal(contentRange.toString(), 'bytes */67589')
  })

  it('converts to string correctly (unknown size)', () => {
    let contentRange = new ContentRange({
      unit: 'bytes',
      start: 0,
      end: 999,
      size: '*',
    })
    assert.equal(contentRange.toString(), 'bytes 0-999/*')
  })

  it('converts to an empty string when unit is not set', () => {
    let contentRange = new ContentRange()
    contentRange.unit = ''
    assert.equal(contentRange.toString(), '')
  })

  it('converts to an empty string when size is not set', () => {
    let contentRange = new ContentRange()
    contentRange.unit = 'bytes'
    contentRange.start = 0
    contentRange.end = 999
    assert.equal(contentRange.toString(), '')
  })

  it('handles partial range with start only', () => {
    let contentRange = new ContentRange({
      unit: 'bytes',
      start: 500,
      end: null,
      size: 1000,
    })
    assert.equal(contentRange.toString(), 'bytes */1000')
  })

  it('handles partial range with end only', () => {
    let contentRange = new ContentRange({
      unit: 'bytes',
      start: null,
      end: 999,
      size: 1000,
    })
    assert.equal(contentRange.toString(), 'bytes */1000')
  })

  it('handles zero-based ranges', () => {
    let contentRange = new ContentRange('bytes 0-0/1')
    assert.equal(contentRange.start, 0)
    assert.equal(contentRange.end, 0)
    assert.equal(contentRange.size, 1)
    assert.equal(contentRange.toString(), 'bytes 0-0/1')
  })
})

describe('ContentRange.from', () => {
  it('parses a string value', () => {
    let result = ContentRange.from('bytes 0-499/1234')
    assert.ok(result instanceof ContentRange)
    assert.equal(result.unit, 'bytes')
    assert.equal(result.start, 0)
    assert.equal(result.end, 499)
    assert.equal(result.size, 1234)
  })
})
