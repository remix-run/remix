import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateETag, matchesETag } from './etag.ts'

describe('generateETag', () => {
  it('wraps hash in weak ETag format W/"..."', () => {
    assert.equal(generateETag('abc123'), 'W/"abc123"')
  })

  it('handles 16-char hashes (our standard length)', () => {
    let etag = generateETag('1a2b3c4d5e6f7890')
    assert.equal(etag, 'W/"1a2b3c4d5e6f7890"')
  })

  it('handles empty hash', () => {
    assert.equal(generateETag(''), 'W/""')
  })
})

describe('matchesETag', () => {
  describe('null If-None-Match', () => {
    it('returns false when ifNoneMatch is null', () => {
      assert.equal(matchesETag(null, 'W/"abc"'), false)
    })
  })

  describe('weak ETag matching', () => {
    it('matches weak against weak ETag', () => {
      assert.equal(matchesETag('W/"abc123"', 'W/"abc123"'), true)
    })

    it('matches strong If-None-Match against weak ETag', () => {
      assert.equal(matchesETag('"abc123"', 'W/"abc123"'), true)
    })

    it('matches weak If-None-Match against strong ETag (generated without W/)', () => {
      assert.equal(matchesETag('W/"abc123"', '"abc123"'), true)
    })

    it('does not match different hash values', () => {
      assert.equal(matchesETag('W/"abc123"', 'W/"xyz789"'), false)
    })

    it('does not match partial hash', () => {
      assert.equal(matchesETag('W/"abc"', 'W/"abc123"'), false)
    })
  })

  describe('wildcard', () => {
    it('matches wildcard * against any ETag', () => {
      assert.equal(matchesETag('*', 'W/"abc123"'), true)
    })
  })

  describe('comma-separated ETags', () => {
    it('matches when one of multiple ETags matches', () => {
      assert.equal(matchesETag('W/"other", W/"abc123"', 'W/"abc123"'), true)
    })

    it('does not match when none match', () => {
      assert.equal(matchesETag('W/"foo", W/"bar"', 'W/"abc123"'), false)
    })

    it('matches first ETag in list', () => {
      assert.equal(matchesETag('W/"abc123", W/"other"', 'W/"abc123"'), true)
    })
  })

  describe('real-world browser header values', () => {
    it('handles browser-sent weak ETag roundtrip', () => {
      let hash = '1a2b3c4d5e6f7890'
      let etag = generateETag(hash)
      assert.equal(matchesETag(etag, etag), true)
    })

    it('handles browser stripping W/ prefix', () => {
      // Some browsers send back the strong form even when server sends weak
      let hash = '1a2b3c4d5e6f7890'
      let serverEtag = generateETag(hash)
      let browserSent = `"${hash}"` // stripped W/
      assert.equal(matchesETag(browserSent, serverEtag), true)
    })
  })
})
