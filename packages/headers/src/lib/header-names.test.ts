import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { canonicalHeaderName } from './header-names.ts'

describe('normalizeHeaderName', () => {
  it('handles common headers correctly', () => {
    assert.equal(canonicalHeaderName('content-type'), 'Content-Type')
    assert.equal(canonicalHeaderName('content-length'), 'Content-Length')
    assert.equal(canonicalHeaderName('user-agent'), 'User-Agent')
    assert.equal(canonicalHeaderName('accept'), 'Accept')
  })

  it('handles special case headers correctly', () => {
    assert.equal(canonicalHeaderName('etag'), 'ETag')
    assert.equal(canonicalHeaderName('www-authenticate'), 'WWW-Authenticate')
    assert.equal(canonicalHeaderName('x-forwarded-for'), 'X-Forwarded-For')
    assert.equal(canonicalHeaderName('x-xss-protection'), 'X-XSS-Protection')
    assert.equal(canonicalHeaderName('te'), 'TE')
    assert.equal(canonicalHeaderName('expect-ct'), 'Expect-CT')
  })

  it('normalizes mixed-case input', () => {
    assert.equal(canonicalHeaderName('CoNtEnT-TyPe'), 'Content-Type')
    assert.equal(canonicalHeaderName('x-FoRwArDeD-fOr'), 'X-Forwarded-For')
  })

  it('handles single-word headers', () => {
    assert.equal(canonicalHeaderName('authorization'), 'Authorization')
    assert.equal(canonicalHeaderName('host'), 'Host')
  })

  it('normalizes other common HTTP headers', () => {
    assert.equal(canonicalHeaderName('accept-charset'), 'Accept-Charset')
    assert.equal(canonicalHeaderName('accept-encoding'), 'Accept-Encoding')
    assert.equal(canonicalHeaderName('accept-language'), 'Accept-Language')
    assert.equal(canonicalHeaderName('cache-control'), 'Cache-Control')
    assert.equal(canonicalHeaderName('connection'), 'Connection')
    assert.equal(canonicalHeaderName('cookie'), 'Cookie')
    assert.equal(canonicalHeaderName('date'), 'Date')
    assert.equal(canonicalHeaderName('expect'), 'Expect')
    assert.equal(canonicalHeaderName('forwarded'), 'Forwarded')
    assert.equal(canonicalHeaderName('from'), 'From')
    assert.equal(canonicalHeaderName('if-match'), 'If-Match')
    assert.equal(canonicalHeaderName('if-modified-since'), 'If-Modified-Since')
    assert.equal(canonicalHeaderName('if-none-match'), 'If-None-Match')
    assert.equal(canonicalHeaderName('if-range'), 'If-Range')
    assert.equal(canonicalHeaderName('if-unmodified-since'), 'If-Unmodified-Since')
    assert.equal(canonicalHeaderName('max-forwards'), 'Max-Forwards')
    assert.equal(canonicalHeaderName('origin'), 'Origin')
    assert.equal(canonicalHeaderName('pragma'), 'Pragma')
    assert.equal(canonicalHeaderName('proxy-authorization'), 'Proxy-Authorization')
    assert.equal(canonicalHeaderName('range'), 'Range')
    assert.equal(canonicalHeaderName('referer'), 'Referer')
    assert.equal(canonicalHeaderName('server'), 'Server')
    assert.equal(canonicalHeaderName('transfer-encoding'), 'Transfer-Encoding')
    assert.equal(canonicalHeaderName('upgrade'), 'Upgrade')
    assert.equal(canonicalHeaderName('via'), 'Via')
    assert.equal(canonicalHeaderName('warning'), 'Warning')
    assert.equal(canonicalHeaderName('alt-svc'), 'Alt-Svc')
    assert.equal(canonicalHeaderName('content-disposition'), 'Content-Disposition')
    assert.equal(canonicalHeaderName('content-encoding'), 'Content-Encoding')
    assert.equal(canonicalHeaderName('content-language'), 'Content-Language')
    assert.equal(canonicalHeaderName('content-location'), 'Content-Location')
    assert.equal(canonicalHeaderName('content-range'), 'Content-Range')
    assert.equal(canonicalHeaderName('link'), 'Link')
    assert.equal(canonicalHeaderName('location'), 'Location')
    assert.equal(canonicalHeaderName('retry-after'), 'Retry-After')
    assert.equal(canonicalHeaderName('strict-transport-security'), 'Strict-Transport-Security')
    assert.equal(canonicalHeaderName('vary'), 'Vary')
  })

  it('handles custom X- headers', () => {
    assert.equal(canonicalHeaderName('x-custom-header'), 'X-Custom-Header')
    assert.equal(canonicalHeaderName('x-requested-with'), 'X-Requested-With')
  })

  it('preserves casing for unknown acronyms', () => {
    assert.equal(canonicalHeaderName('x-csrf-token'), 'X-Csrf-Token')
    assert.equal(canonicalHeaderName('x-api-key'), 'X-Api-Key')
  })
})
