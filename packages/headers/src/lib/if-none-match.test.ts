import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { IfNoneMatch } from './if-none-match.ts'

describe('IfNoneMatch', () => {
  it('initializes with an empty string', () => {
    let header = new IfNoneMatch('')
    assert.deepEqual(header.tags, [])
  })

  it('initializes with a string with a single tag', () => {
    let header = new IfNoneMatch('67ab43')
    assert.deepEqual(header.tags, ['"67ab43"'])

    let header2 = new IfNoneMatch('"67ab43"')
    assert.deepEqual(header2.tags, ['"67ab43"'])

    let header3 = new IfNoneMatch('W/"67ab43"')
    assert.deepEqual(header3.tags, ['W/"67ab43"'])
  })

  it('initializes with a string with multiple tags', () => {
    let header = new IfNoneMatch('67ab43, 54ed21')
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])

    let header2 = new IfNoneMatch('"67ab43", "54ed21"')
    assert.deepEqual(header2.tags, ['"67ab43"', '"54ed21"'])

    let header3 = new IfNoneMatch('W/"67ab43", "54ed21"')
    assert.deepEqual(header3.tags, ['W/"67ab43"', '"54ed21"'])
  })

  it('initializes with an array of tags', () => {
    let header = new IfNoneMatch(['67ab43', '54ed21'])
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])

    let header2 = new IfNoneMatch(['"67ab43"', '"54ed21"'])
    assert.deepEqual(header2.tags, ['"67ab43"', '"54ed21"'])

    let header3 = new IfNoneMatch(['W/"67ab43"', '"54ed21"'])
    assert.deepEqual(header3.tags, ['W/"67ab43"', '"54ed21"'])
  })

  it('initializes with an object', () => {
    let header = new IfNoneMatch({ tags: ['67ab43', '54ed21'] })
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])

    let header2 = new IfNoneMatch({ tags: ['"67ab43"', '"54ed21"'] })
    assert.deepEqual(header2.tags, ['"67ab43"', '"54ed21"'])

    let header3 = new IfNoneMatch({ tags: ['W/"67ab43"', '"54ed21"'] })
    assert.deepEqual(header3.tags, ['W/"67ab43"', '"54ed21"'])
  })

  it('initializes with another IfNoneMatch', () => {
    let header = new IfNoneMatch(new IfNoneMatch('67ab43, 54ed21'))
    assert.deepEqual(header.tags, ['"67ab43"', '"54ed21"'])
  })

  it('checks if a tag is present', () => {
    let header = new IfNoneMatch('67ab43, 54ed21')
    assert.ok(header.has('"67ab43"'))
    assert.ok(header.has('"54ed21"'))
    assert.ok(!header.has('"7892dd"'))
    assert.ok(!header.has('*'))

    let header2 = new IfNoneMatch('W/"67ab43", "54ed21"')
    assert.ok(header2.has('W/"67ab43"'))
    assert.ok(header2.has('"54ed21"'))
    assert.ok(!header2.has('"7892dd"'))
  })

  it('checks if a tag matches', () => {
    let header = new IfNoneMatch('67ab43, 54ed21')
    assert.ok(header.matches('"67ab43"'))
    assert.ok(header.matches('"54ed21"'))
    assert.ok(!header.matches('"7892dd"'))

    let header2 = new IfNoneMatch('W/"67ab43", "54ed21"')
    assert.ok(header2.matches('W/"67ab43"'))
    assert.ok(header2.matches('"54ed21"'))
    assert.ok(!header2.matches('"7892dd"'))

    let header3 = new IfNoneMatch('*')
    assert.ok(header3.matches('"67ab43"'))
    assert.ok(header3.matches('"54ed21"'))
  })

  it('converts to a string', () => {
    let header = new IfNoneMatch('W/"67ab43", "54ed21"')
    assert.equal(header.toString(), 'W/"67ab43", "54ed21"')
  })
})

describe('IfNoneMatch.from', () => {
  it('parses a string value', () => {
    let result = IfNoneMatch.from('"abc", "def"')
    assert.ok(result instanceof IfNoneMatch)
    assert.equal(result.tags.length, 2)
  })
})
