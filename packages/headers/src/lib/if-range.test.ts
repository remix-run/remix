import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IfRange } from './if-range.ts'

describe('IfRange', () => {
  let testDate = new Date('2021-01-01T00:00:00Z')
  let testDateString = testDate.toUTCString() // 'Fri, 01 Jan 2021 00:00:00 GMT'
  let testTimestamp = testDate.getTime() // 1609459200000

  it('initializes with an empty string', () => {
    let header = new IfRange('')
    assert.equal(header.value, '')
  })

  it('initializes with a string (HTTP date)', () => {
    let header = new IfRange(testDateString)
    assert.equal(header.value, testDateString)
  })

  it('initializes with a string (ETag)', () => {
    let header = new IfRange('"67ab43"')
    assert.equal(header.value, '"67ab43"')
  })

  it('initializes with a Date', () => {
    let header = new IfRange(testDate)
    assert.equal(header.value, testDateString)
  })

  it('converts to a string', () => {
    let header = new IfRange(testDateString)
    assert.equal(header.toString(), testDateString)

    let header2 = new IfRange('"67ab43"')
    assert.equal(header2.toString(), '"67ab43"')
  })

  describe('matches()', () => {
    describe('with HTTP dates', () => {
      it('matches when lastModified matches the date (timestamp)', () => {
        let header = new IfRange(testDateString)
        assert.ok(header.matches({ lastModified: testTimestamp }))
      })

      it('matches when lastModified matches the date (Date object)', () => {
        let header = new IfRange(testDateString)
        assert.ok(header.matches({ lastModified: testDate }))
      })

      it('does not match when lastModified is later', () => {
        let header = new IfRange(testDateString)
        assert.ok(!header.matches({ lastModified: testTimestamp + 1000 }))
      })

      it('does not match when lastModified is earlier', () => {
        let header = new IfRange(testDateString)
        assert.ok(!header.matches({ lastModified: testTimestamp - 1000 }))
      })

      it('handles fractional seconds (rounds to second)', () => {
        let header = new IfRange(testDateString)
        // Same second, different milliseconds
        assert.ok(header.matches({ lastModified: testTimestamp + 123 }))
        assert.ok(header.matches({ lastModified: testTimestamp + 999 }))
      })

      it('does not match when lastModified is null', () => {
        let header = new IfRange(testDateString)
        assert.ok(!header.matches({ lastModified: null }))
      })

      it('does not match when lastModified is missing', () => {
        let header = new IfRange(testDateString)
        assert.ok(!header.matches({}))
      })

      it('does not match invalid HTTP dates', () => {
        let header = new IfRange('not-a-date')
        assert.ok(!header.matches({ lastModified: testTimestamp }))
      })
    })

    describe('with ETags', () => {
      it('matches when etag matches (strong ETag)', () => {
        let header = new IfRange('"67ab43"')
        assert.ok(header.matches({ etag: '"67ab43"' }))
      })

      it('matches when etag matches (without quotes)', () => {
        let header = new IfRange('67ab43')
        assert.ok(header.matches({ etag: '67ab43' }))
      })

      it('does not match when etag differs', () => {
        let header = new IfRange('"67ab43"')
        assert.ok(!header.matches({ etag: '"54ed21"' }))
      })

      it('does not match when etag is null', () => {
        let header = new IfRange('"67ab43"')
        assert.ok(!header.matches({ etag: null }))
      })

      it('does not match when etag is missing', () => {
        let header = new IfRange('"67ab43"')
        assert.ok(!header.matches({}))
      })

      it('does not match weak ETags (per RFC 7233)', () => {
        let header = new IfRange('W/"67ab43"')
        assert.ok(!header.matches({ etag: 'W/"67ab43"' }))
      })

      it('does not match when resource ETag is weak', () => {
        let header = new IfRange('"67ab43"')
        assert.ok(!header.matches({ etag: 'W/"67ab43"' }))
      })

      it('does not match when If-Range is weak and resource is strong', () => {
        let header = new IfRange('W/"67ab43"')
        assert.ok(!header.matches({ etag: '"67ab43"' }))
      })
    })

    describe('with both etag and lastModified', () => {
      it('matches date when value is a date', () => {
        let header = new IfRange(testDateString)
        assert.ok(
          header.matches({
            etag: '"67ab43"',
            lastModified: testTimestamp,
          }),
        )
      })

      it('matches etag when value is an ETag', () => {
        let header = new IfRange('"67ab43"')
        assert.ok(
          header.matches({
            etag: '"67ab43"',
            lastModified: testTimestamp,
          }),
        )
      })
    })

    describe('with empty value', () => {
      it('matches unconditionally (condition passes when header is not present)', () => {
        let header = new IfRange('')
        assert.ok(header.matches({ etag: '"67ab43"' }))
        assert.ok(header.matches({ lastModified: testTimestamp }))
        assert.ok(header.matches({ etag: '"67ab43"', lastModified: testTimestamp }))
        assert.ok(header.matches({}))
      })
    })
  })
})

describe('IfRange.from', () => {
  it('parses a string value', () => {
    let result = IfRange.from('"abc"')
    assert.ok(result instanceof IfRange)
    assert.equal(result.value, '"abc"')
  })

  it('parses a Date value', () => {
    let date = new Date('2024-01-01T00:00:00.000Z')
    let result = IfRange.from(date)
    assert.ok(result instanceof IfRange)
    assert.equal(result.value, date.toUTCString())
  })
})
