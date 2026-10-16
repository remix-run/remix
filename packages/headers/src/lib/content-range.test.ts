import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

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

  it('rejects a range whose end precedes its start', () => {
    let contentRange = new ContentRange('bytes 100-50/200')
    assert.equal(contentRange.unit, '')
    assert.equal(contentRange.start, null)
    assert.equal(contentRange.end, null)
    assert.equal(contentRange.size, undefined)
    assert.equal(contentRange.toString(), '')
  })

  it('rejects a range that reaches the complete length', () => {
    let contentRange = new ContentRange('bytes 0-100/100')
    assert.equal(contentRange.unit, '')
    assert.equal(contentRange.toString(), '')
  })

  it('does not serialize a range reversed after construction', () => {
    let contentRange = new ContentRange('bytes 0-99/100')
    contentRange.start = 100
    contentRange.end = 50
    assert.equal(contentRange.toString(), '')
  })

  it('does not serialize a range changed to reach the complete length', () => {
    let contentRange = new ContentRange('bytes 0-99/100')
    contentRange.end = 100
    assert.equal(contentRange.toString(), '')
  })

  it('accepts a range ending on the last byte of the resource', () => {
    let contentRange = new ContentRange('bytes 0-99/100')
    assert.equal(contentRange.unit, 'bytes')
    assert.equal(contentRange.start, 0)
    assert.equal(contentRange.end, 99)
    assert.equal(contentRange.size, 100)
    assert.equal(contentRange.toString(), 'bytes 0-99/100')
  })

  it('rejects a reversed range even when the size is unknown', () => {
    let contentRange = new ContentRange('bytes 100-50/*')
    assert.equal(contentRange.unit, '')
    assert.equal(contentRange.toString(), '')
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

  it('rejects an init object whose end precedes its start', () => {
    let result = ContentRange.from({ unit: 'bytes', start: 100, end: 50, size: 200 })
    assert.equal(result.unit, '')
    assert.equal(result.toString(), '')
  })

  it('rejects an init object that reaches the complete length', () => {
    let result = ContentRange.from({ unit: 'bytes', start: 0, end: 100, size: 100 })
    assert.equal(result.unit, '')
    assert.equal(result.toString(), '')
  })

  it('accepts an init object for an unsatisfied range', () => {
    let result = ContentRange.from({ unit: 'bytes', start: null, end: null, size: 67589 })
    assert.equal(result.unit, 'bytes')
    assert.equal(result.toString(), 'bytes */67589')
  })
})
