import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parse as parseRawHeaders, stringify as stringifyRawHeaders } from './raw-headers.ts'

describe('parseRawHeaders', () => {
  it('parses a single header', () => {
    let headers = parseRawHeaders('Content-Type: text/html')
    assert.equal(headers.get('content-type'), 'text/html')
  })

  it('parses multiple headers', () => {
    let headers = parseRawHeaders('Content-Type: text/html\r\nCache-Control: no-cache')
    assert.equal(headers.get('content-type'), 'text/html')
    assert.equal(headers.get('cache-control'), 'no-cache')
  })

  it('trims whitespace from header names and values', () => {
    let headers = parseRawHeaders('  Content-Type  :  text/html  ')
    assert.equal(headers.get('content-type'), 'text/html')
  })

  it('handles multiple values for the same header', () => {
    let headers = parseRawHeaders('Set-Cookie: a=1\r\nSet-Cookie: b=2')
    assert.equal(headers.get('set-cookie'), 'a=1, b=2')
  })

  it('ignores malformed lines', () => {
    let headers = parseRawHeaders(
      'Content-Type: text/html\r\nmalformed line\r\nCache-Control: no-cache',
    )
    assert.equal(headers.get('content-type'), 'text/html')
    assert.equal(headers.get('cache-control'), 'no-cache')
  })

  it('returns empty Headers for empty string', () => {
    let headers = parseRawHeaders('')
    assert.equal([...headers].length, 0)
  })

  it('handles headers with colons in values', () => {
    let headers = parseRawHeaders('Location: https://example.com:8080/path')
    assert.equal(headers.get('location'), 'https://example.com:8080/path')
  })
})

describe('stringifyRawHeaders', () => {
  it('stringifies a single header', () => {
    let headers = new Headers({ 'Content-Type': 'text/html' })
    assert.equal(stringifyRawHeaders(headers), 'Content-Type: text/html')
  })

  it('stringifies multiple headers', () => {
    let headers = new Headers()
    headers.set('Content-Type', 'text/html')
    headers.set('Cache-Control', 'no-cache')
    let result = stringifyRawHeaders(headers)
    assert.ok(result.includes('Content-Type: text/html'))
    assert.ok(result.includes('Cache-Control: no-cache'))
    assert.ok(result.includes('\r\n'))
  })

  it('returns empty string for empty Headers', () => {
    let headers = new Headers()
    assert.equal(stringifyRawHeaders(headers), '')
  })

  it('handles headers with colons in values', () => {
    let headers = new Headers({ Location: 'https://example.com:8080/path' })
    assert.equal(stringifyRawHeaders(headers), 'Location: https://example.com:8080/path')
  })

  it('uses canonical header name casing', () => {
    let headers = new Headers()
    headers.set('etag', '"abc"')
    headers.set('www-authenticate', 'Basic')
    headers.set('x-custom-header', 'value')
    let result = stringifyRawHeaders(headers)
    assert.ok(result.includes('ETag: "abc"'))
    assert.ok(result.includes('WWW-Authenticate: Basic'))
    assert.ok(result.includes('X-Custom-Header: value'))
  })

  it('round-trips with parseRawHeaders', () => {
    let original = new Headers()
    original.set('Content-Type', 'text/html')
    original.set('Cache-Control', 'no-cache')

    let stringified = stringifyRawHeaders(original)
    let parsed = parseRawHeaders(stringified)

    assert.equal(parsed.get('content-type'), 'text/html')
    assert.equal(parsed.get('cache-control'), 'no-cache')
  })
})

describe('parseRawHeaders non-ASCII handling', () => {
  it('encodes non-ASCII characters in header values', () => {
    // Japanese filename: テスト画像.png
    let headers = parseRawHeaders(
      'Content-Disposition: form-data; name="file"; filename="テスト画像.png"',
    )
    let value = headers.get('content-disposition')
    assert.ok(value !== null)
    // Should be percent-encoded
    assert.ok(value.includes('%E3%83%86%E3%82%B9%E3%83%88'), 'Should contain encoded テスト')
    assert.ok(value.includes('%E7%94%BB%E5%83%8F'), 'Should contain encoded 画像')
  })

  it('encodes Chinese characters', () => {
    // Chinese filename: 文件.png
    let headers = parseRawHeaders(
      'Content-Disposition: form-data; name="file"; filename="文件.png"',
    )
    let value = headers.get('content-disposition')
    assert.ok(value !== null)
    assert.ok(value.includes('%E6%96%87%E4%BB%B6'), 'Should contain encoded 文件')
  })

  it('encodes Korean characters', () => {
    // Korean filename: 파일.png
    let headers = parseRawHeaders(
      'Content-Disposition: form-data; name="file"; filename="파일.png"',
    )
    let value = headers.get('content-disposition')
    assert.ok(value !== null)
    assert.ok(value.includes('%ED%8C%8C%EC%9D%BC'), 'Should contain encoded 파일')
  })

  it('preserves ASCII-only header values unchanged', () => {
    let headers = parseRawHeaders('Content-Disposition: form-data; name="file"; filename="test.txt"')
    assert.equal(
      headers.get('content-disposition'),
      'form-data; name="file"; filename="test.txt"',
    )
  })

  it('handles mixed ASCII and non-ASCII', () => {
    let headers = parseRawHeaders(
      'Content-Disposition: form-data; name="file"; filename="test_テスト.png"',
    )
    let value = headers.get('content-disposition')
    assert.ok(value !== null)
    assert.ok(value.includes('test_'), 'Should preserve ASCII prefix')
    assert.ok(value.includes('%E3%83%86%E3%82%B9%E3%83%88'), 'Should contain encoded テスト')
    assert.ok(value.includes('.png'), 'Should preserve ASCII suffix')
  })
})
