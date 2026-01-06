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
