import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashCode, generateETag, matchesETag } from './etag.ts'

describe('hashCode', () => {
  it('generates consistent hash for same code', async () => {
    let code = 'export function test() { return 42; }'

    let hash1 = await hashCode(code)
    let hash2 = await hashCode(code)

    assert.equal(hash1, hash2)
  })

  it('generates different hashes for different code', async () => {
    let code1 = 'export function test() { return 42; }'
    let code2 = 'export function test() { return 43; }'

    let hash1 = await hashCode(code1)
    let hash2 = await hashCode(code2)

    assert.notEqual(hash1, hash2)
  })

  it('generates hash with reasonable length', async () => {
    let code = 'export function test() { return 42; }'

    let hash = await hashCode(code)

    assert.equal(hash.length, 16)
  })
})

describe('generateETag', () => {
  it('generates weak ETag from hash', () => {
    let hash = 'abc123def456'

    let etag = generateETag(hash)

    assert.ok(etag.startsWith('W/"'), 'ETag should be weak (W/ prefix)')
    assert.ok(etag.endsWith('"'), 'ETag should end with quote')
    assert.ok(etag.includes(hash), 'ETag should contain the hash')
  })

  it('generates different ETags for different hashes', () => {
    let hash1 = 'abc123def456'
    let hash2 = 'xyz789ghi012'

    let etag1 = generateETag(hash1)
    let etag2 = generateETag(hash2)

    assert.notEqual(etag1, etag2)
  })
})

describe('matchesETag', () => {
  it('returns false for null If-None-Match', () => {
    assert.equal(matchesETag(null, 'W/"abc"'), false)
  })

  it('returns true for exact match', () => {
    assert.equal(matchesETag('W/"abc"', 'W/"abc"'), true)
  })

  it('returns true for match without W/ prefix', () => {
    assert.equal(matchesETag('"abc"', 'W/"abc"'), true)
    assert.equal(matchesETag('W/"abc"', '"abc"'), true)
  })

  it('returns false for non-match', () => {
    assert.equal(matchesETag('W/"abc"', 'W/"xyz"'), false)
  })

  it('returns true for wildcard', () => {
    assert.equal(matchesETag('*', 'W/"abc"'), true)
  })

  it('handles multiple ETags in If-None-Match', () => {
    assert.equal(matchesETag('W/"abc", W/"def", W/"xyz"', 'W/"def"'), true)
    assert.equal(matchesETag('W/"abc", W/"def"', 'W/"xyz"'), false)
  })

  it('handles whitespace in multiple ETags', () => {
    assert.equal(matchesETag('W/"abc" , W/"def" , W/"xyz"', 'W/"def"'), true)
  })
})
