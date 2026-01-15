import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IfMatch } from './if-match.ts'

describe('IfMatch', () => {
  it('initializes with an empty string', () => {
    let header = new IfMatch('')
    assert.deepEqual(header.tags, [])
  })

  it('initializes with a string with a single tag', () => {
    let header = new IfMatch('67ab43')
    assert.deepEqual(header.tags, ['"67ab43"'])

    let header2 = new IfMatch('"67ab43"')
    assert.deepEqual(header2.tags, ['"67ab43"'])

    let header3 = new IfMatch('W/"67ab43"')
    assert.deepEqual(header3.tags, ['W/"67ab43"'])
  })

  it('initializes with a string with multiple tags', () => {
    let header = new IfMatch('67ab43, 54ed21')
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])

    let header2 = new IfMatch('"67ab43", "54ed21"')
    assert.deepEqual(header2.tags, ['"67ab43"', '"54ed21"'])

    let header3 = new IfMatch('W/"67ab43", "54ed21"')
    assert.deepEqual(header3.tags, ['W/"67ab43"', '"54ed21"'])
  })

  it('initializes with an array of tags', () => {
    let header = new IfMatch(['67ab43', '54ed21'])
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])

    let header2 = new IfMatch(['"67ab43"', '"54ed21"'])
    assert.deepEqual(header2.tags, ['"67ab43"', '"54ed21"'])

    let header3 = new IfMatch(['W/"67ab43"', '"54ed21"'])
    assert.deepEqual(header3.tags, ['W/"67ab43"', '"54ed21"'])
  })

  it('initializes with an object', () => {
    let header = new IfMatch({ tags: ['67ab43', '54ed21'] })
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])

    let header2 = new IfMatch({ tags: ['"67ab43"', '"54ed21"'] })
    assert.deepEqual(header2.tags, ['"67ab43"', '"54ed21"'])

    let header3 = new IfMatch({ tags: ['W/"67ab43"', '"54ed21"'] })
    assert.deepEqual(header3.tags, ['W/"67ab43"', '"54ed21"'])
  })

  it('initializes with another IfMatch', () => {
    let header = new IfMatch(new IfMatch('67ab43, 54ed21'))
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])
  })

  it('converts to a string', () => {
    let header = new IfMatch('W/"67ab43", "54ed21"')
    assert.equal(header.toString(), 'W/"67ab43", "54ed21"')
  })

  describe('has()', () => {
    it('checks if a tag is present', () => {
      let header = new IfMatch('67ab43, 54ed21')
      assert.ok(header.has('"67ab43"'))
      assert.ok(header.has('"54ed21"'))
      assert.ok(!header.has('"7892dd"'))
      assert.ok(!header.has('*'))

      let header2 = new IfMatch('W/"67ab43", "54ed21"')
      assert.ok(header2.has('W/"67ab43"'))
      assert.ok(header2.has('"54ed21"'))
      assert.ok(!header2.has('"7892dd"'))
    })
  })

  describe('matches()', () => {
    it('returns true when header is not present', () => {
      let emptyHeader = new IfMatch()
      assert.ok(emptyHeader.matches('"67ab43"'))
    })

    it('returns true when header is present and matches', () => {
      let matchingHeader = new IfMatch('67ab43, 54ed21')
      assert.ok(matchingHeader.matches('"67ab43"'))
      assert.ok(matchingHeader.matches('"54ed21"'))
    })

    it('returns false when header is present but does not match', () => {
      let matchingHeader = new IfMatch('67ab43, 54ed21')
      assert.ok(!matchingHeader.matches('"7892dd"'))
    })

    it('returns true when wildcard is present', () => {
      let wildcardHeader = new IfMatch('*')
      assert.ok(wildcardHeader.matches('"67ab43"'))
      assert.ok(wildcardHeader.matches('"anything"'))
    })

    describe('ETag handling', () => {
      it('returns false when resource has weak tag', () => {
        let header = new IfMatch('67ab43')
        assert.ok(!header.matches('W/"67ab43"'))
      })

      it('returns false when If-Match header has weak tag', () => {
        let header = new IfMatch('W/"67ab43"')
        assert.ok(!header.matches('"67ab43"'))
      })

      it('returns false when both resource and If-Match header have weak tags', () => {
        let header = new IfMatch('W/"67ab43"')
        assert.ok(!header.matches('W/"67ab43"'))
      })

      it('returns true when both resource and If-Match header have strong tags', () => {
        let header = new IfMatch('"67ab43"')
        assert.ok(header.matches('"67ab43"'))
      })

      it('returns false when If-Match has mix of weak and strong tags and resource is weak', () => {
        let header = new IfMatch('W/"67ab43", "54ed21"')
        assert.ok(!header.matches('W/"67ab43"'))
      })

      it('returns true when If-Match has mix of weak and strong tags and resource matches strong tag', () => {
        let header = new IfMatch('W/"67ab43", "54ed21"')
        assert.ok(header.matches('"54ed21"'))
      })
    })
  })
})

describe('IfMatch.from', () => {
  it('parses a string value', () => {
    let result = IfMatch.from('"abc", "def"')
    assert.ok(result instanceof IfMatch)
    assert.equal(result.tags.length, 2)
  })
})
