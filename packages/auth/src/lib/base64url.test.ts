import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { decodeBase64Url, encodeBase64Url } from './base64url.ts'

describe('encodeBase64Url()', () => {
  it('encodes bytes with the URL-safe alphabet and no padding', () => {
    assert.equal(encodeBase64Url(new Uint8Array([0xfb, 0xff, 0xbf])), '-_-_')
    assert.equal(encodeBase64Url(new Uint8Array([0x66])), 'Zg')
    assert.equal(encodeBase64Url(new Uint8Array([0x66, 0x6f])), 'Zm8')
    assert.equal(encodeBase64Url(new Uint8Array()), '')
  })
})

describe('decodeBase64Url()', () => {
  it('round-trips encoded bytes', () => {
    let bytes = crypto.getRandomValues(new Uint8Array(65))

    assert.deepEqual(decodeBase64Url(encodeBase64Url(bytes)), bytes)
  })

  it('tolerates trailing padding', () => {
    assert.deepEqual(decodeBase64Url('Zg=='), new Uint8Array([0x66]))
    assert.deepEqual(decodeBase64Url('Zm8='), new Uint8Array([0x66, 0x6f]))
  })

  it('returns null for characters outside the base64url alphabet', () => {
    assert.equal(decodeBase64Url('a+b/'), null)
    assert.equal(decodeBase64Url('ab cd'), null)
    assert.equal(decodeBase64Url('Zg==='), null)
  })

  it('returns null for impossible lengths', () => {
    assert.equal(decodeBase64Url('A'), null)
    assert.equal(decodeBase64Url('AAAAA'), null)
  })
})
