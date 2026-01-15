import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Range } from './range.ts'

describe('Range', () => {
  it('initializes with an empty string', () => {
    let range = new Range('')
    assert.equal(range.unit, '')
    assert.deepEqual(range.ranges, [])
  })

  describe('parsing from string', () => {
    it('parses a simple range', () => {
      let range = new Range('bytes=0-99')
      assert.equal(range.unit, 'bytes')
      assert.equal(range.ranges.length, 1)
      assert.equal(range.ranges[0].start, 0)
      assert.equal(range.ranges[0].end, 99)
    })

    it('parses a range with only start', () => {
      let range = new Range('bytes=100-')
      assert.equal(range.unit, 'bytes')
      assert.equal(range.ranges.length, 1)
      assert.equal(range.ranges[0].start, 100)
      assert.equal(range.ranges[0].end, undefined)
    })

    it('parses a suffix range (only end)', () => {
      let range = new Range('bytes=-500')
      assert.equal(range.unit, 'bytes')
      assert.equal(range.ranges.length, 1)
      assert.equal(range.ranges[0].start, undefined)
      assert.equal(range.ranges[0].end, 500)
    })

    it('parses multiple ranges', () => {
      let range = new Range('bytes=0-99,200-299,400-')
      assert.equal(range.unit, 'bytes')
      assert.equal(range.ranges.length, 3)
      assert.equal(range.ranges[0].start, 0)
      assert.equal(range.ranges[0].end, 99)
      assert.equal(range.ranges[1].start, 200)
      assert.equal(range.ranges[1].end, 299)
      assert.equal(range.ranges[2].start, 400)
      assert.equal(range.ranges[2].end, undefined)
    })

    it('handles malformed range with no bounds', () => {
      let range = new Range('bytes=-')
      assert.equal(range.ranges.length, 0)
    })

    it('handles completely invalid syntax', () => {
      let range = new Range('not-a-range')
      assert.equal(range.ranges.length, 0)
    })

    it('handles whitespace in ranges', () => {
      let range = new Range('bytes=0-99, 200-299')
      assert.equal(range.ranges.length, 2)
      assert.equal(range.ranges[0].start, 0)
      assert.equal(range.ranges[0].end, 99)
      assert.equal(range.ranges[1].start, 200)
      assert.equal(range.ranges[1].end, 299)
    })
  })

  describe('construction from object', () => {
    it('creates range from object init', () => {
      let range = new Range({
        unit: 'bytes',
        ranges: [{ start: 0, end: 99 }],
      })
      assert.equal(range.unit, 'bytes')
      assert.equal(range.ranges.length, 1)
      assert.equal(range.ranges[0].start, 0)
      assert.equal(range.ranges[0].end, 99)
    })

    it('uses empty unit if not specified', () => {
      let range = new Range({
        ranges: [{ start: 0, end: 99 }],
      })
      assert.equal(range.unit, '')
    })

    it('initializes with another Range', () => {
      let range1 = new Range('bytes=0-99')
      let range2 = new Range({
        unit: range1.unit,
        ranges: range1.ranges,
      })
      assert.equal(range2.unit, 'bytes')
      assert.equal(range2.ranges.length, 1)
      assert.equal(range2.ranges[0].start, 0)
      assert.equal(range2.ranges[0].end, 99)
    })
  })

  describe('canSatisfy', () => {
    it('returns true when range is within resource', () => {
      let range = new Range('bytes=0-99')
      assert.equal(range.canSatisfy(1000), true)
    })

    it('returns true when range starts within resource', () => {
      let range = new Range('bytes=100-')
      assert.equal(range.canSatisfy(1000), true)
    })

    it('returns true for suffix range', () => {
      let range = new Range('bytes=-500')
      assert.equal(range.canSatisfy(1000), true)
    })

    it('returns false when range starts beyond resource', () => {
      let range = new Range('bytes=1000-')
      assert.equal(range.canSatisfy(500), false)
    })

    it('returns false for empty ranges', () => {
      let range = new Range({ ranges: [] })
      assert.equal(range.canSatisfy(1000), false)
    })

    it('returns false when start > end', () => {
      let range = new Range({
        ranges: [{ start: 100, end: 50 }],
      })
      assert.equal(range.canSatisfy(1000), false)
    })

    it('returns false when range has no bounds', () => {
      let range = new Range({
        ranges: [{}],
      })
      assert.equal(range.canSatisfy(1000), false)
    })

    it('returns false for malformed range string', () => {
      let range = new Range('bytes=-')
      assert.equal(range.canSatisfy(1000), false)
    })

    it('returns true when at least one range is satisfiable', () => {
      let range = new Range('bytes=1000-,0-99')
      assert.equal(range.canSatisfy(500), true)
    })
  })

  describe('normalize', () => {
    it('normalizes simple range', () => {
      let range = new Range('bytes=0-99')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 1)
      assert.equal(normalized[0].start, 0)
      assert.equal(normalized[0].end, 99)
    })

    it('normalizes start-only range', () => {
      let range = new Range('bytes=100-')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 1)
      assert.equal(normalized[0].start, 100)
      assert.equal(normalized[0].end, 999)
    })

    it('normalizes suffix range', () => {
      let range = new Range('bytes=-500')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 1)
      assert.equal(normalized[0].start, 500)
      assert.equal(normalized[0].end, 999)
    })

    it('clamps end to file size', () => {
      let range = new Range('bytes=0-5000')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 1)
      assert.equal(normalized[0].start, 0)
      assert.equal(normalized[0].end, 999)
    })

    it('normalizes multiple ranges', () => {
      let range = new Range('bytes=0-99,200-299')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 2)
      assert.equal(normalized[0].start, 0)
      assert.equal(normalized[0].end, 99)
      assert.equal(normalized[1].start, 200)
      assert.equal(normalized[1].end, 299)
    })

    it('returns empty array for unsatisfiable range', () => {
      let range = new Range('bytes=1000-')
      let normalized = range.normalize(500)
      assert.equal(normalized.length, 0)
    })

    it('returns empty array for malformed range', () => {
      let range = new Range('bytes=-')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 0)
    })

    it('handles suffix larger than file size', () => {
      let range = new Range('bytes=-5000')
      let normalized = range.normalize(1000)
      assert.equal(normalized.length, 1)
      assert.equal(normalized[0].start, 0)
      assert.equal(normalized[0].end, 999)
    })
  })

  describe('toString', () => {
    it('converts simple range to string', () => {
      let range = new Range('bytes=0-99')
      assert.equal(range.toString(), 'bytes=0-99')
    })

    it('converts start-only range to string', () => {
      let range = new Range('bytes=100-')
      assert.equal(range.toString(), 'bytes=100-')
    })

    it('converts suffix range to string', () => {
      let range = new Range('bytes=-500')
      assert.equal(range.toString(), 'bytes=-500')
    })

    it('converts multiple ranges to string', () => {
      let range = new Range('bytes=0-99,200-299')
      assert.equal(range.toString(), 'bytes=0-99,200-299')
    })

    it('returns empty string for empty ranges', () => {
      let range = new Range({ ranges: [] })
      assert.equal(range.toString(), '')
    })

    it('returns empty string when unit is not set', () => {
      let range = new Range()
      range.unit = ''
      range.ranges = [{ start: 0, end: 99 }]
      assert.equal(range.toString(), '')
    })
  })
})

describe('Range.from', () => {
  it('parses a string value', () => {
    let result = Range.from('bytes=0-499')
    assert.ok(result instanceof Range)
    assert.equal(result.unit, 'bytes')
    assert.equal(result.ranges.length, 1)
  })
})
