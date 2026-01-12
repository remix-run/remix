import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CacheControl } from './cache-control.ts'

const paramTestCases: Array<[string, keyof CacheControl, string, unknown]> = [
  ['max-age', 'maxAge', '3600', 3600],
  ['max-stale', 'maxStale', '7200', 7200],
  ['min-fresh', 'minFresh', '1800', 1800],
  ['s-maxage', 'sMaxage', '3600', 3600],
  ['no-cache', 'noCache', '', true],
  ['no-store', 'noStore', '', true],
  ['no-transform', 'noTransform', '', true],
  ['only-if-cached', 'onlyIfCached', '', true],
  ['must-revalidate', 'mustRevalidate', '', true],
  ['proxy-revalidate', 'proxyRevalidate', '', true],
  ['must-understand', 'mustUnderstand', '', true],
  ['private', 'private', '', true],
  ['public', 'public', '', true],
  ['immutable', 'immutable', '', true],
  ['stale-while-revalidate', 'staleWhileRevalidate', '60', 60],
  ['stale-if-error', 'staleIfError', '120', 120],
]

describe('CacheControl', () => {
  it('initializes with an empty string', () => {
    let header = new CacheControl('')
    assert.equal(header.maxAge, undefined)
    assert.equal(header.public, undefined)
    assert.equal(`${header}`, '')
  })

  it('initializes with a string', () => {
    let header = new CacheControl('public, max-age=3600, s-maxage=3600')
    assert.equal(header.maxAge, 3600)
    assert.equal(header.sMaxage, 3600)
    assert.equal(header.public, true)
  })

  for (let [param, prop, value, expected] of paramTestCases) {
    it(`initializes parameter: ${param}=${value}`, () => {
      let header = new CacheControl(`${param}=${value}`)
      assert.equal(header[prop], expected)
    })

    it(`coverts parameter to string: ${param}=${value}`, () => {
      let header = new CacheControl('')
      header[prop] = expected as never
      let expectedString = value ? `${param}=${value}` : param
      assert.equal(header.toString(), expectedString)
    })
  }

  it('initializes with an object', () => {
    let header = new CacheControl({ public: true, maxAge: 3600, sMaxage: 3600 })
    assert.equal(header.maxAge, 3600)
    assert.equal(header.sMaxage, 3600)
    assert.equal(header.public, true)
  })

  it('initializes with another CacheControl', () => {
    let header = new CacheControl(new CacheControl('public, max-age=3600, s-maxage=3600'))
    assert.equal(header.maxAge, 3600)
    assert.equal(header.sMaxage, 3600)
    assert.equal(header.public, true)
  })

  it('handles whitespace in initial value', () => {
    let header = new CacheControl(' public , max-age = 3600, s-maxage=3600 ')
    assert.equal(header.maxAge, 3600)
    assert.equal(header.sMaxage, 3600)
    assert.equal(header.public, true)
  })

  it('sets and gets attributes', () => {
    let header = new CacheControl('')
    header.maxAge = 3600
    header.sMaxage = 3600
    header.public = true
    assert.equal(header.maxAge, 3600)
    assert.equal(header.sMaxage, 3600)
    assert.equal(header.public, true)
  })

  it('converts to a string properly', () => {
    let header = new CacheControl('public, max-age=3600, s-maxage=3600')
    assert.equal(header.toString(), 'public, max-age=3600, s-maxage=3600')
  })

  it('sets numerical values to 0 instead of omitting them', () => {
    let header = new CacheControl()
    header.maxAge = 0
    assert.equal(header.toString(), 'max-age=0')
  })
})

describe('CacheControl.from', () => {
  it('parses a string value', () => {
    let result = CacheControl.from('max-age=3600, public')
    assert.ok(result instanceof CacheControl)
    assert.equal(result.maxAge, 3600)
    assert.equal(result.public, true)
  })

  it('accepts init object', () => {
    let result = CacheControl.from({ maxAge: 3600, public: true })
    assert.ok(result instanceof CacheControl)
    assert.equal(result.maxAge, 3600)
    assert.equal(result.public, true)
  })
})
