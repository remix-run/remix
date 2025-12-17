import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Accept } from './accept.ts'
import { AcceptEncoding } from './accept-encoding.ts'
import { AcceptLanguage } from './accept-language.ts'
import { CacheControl } from './cache-control.ts'
import { ContentDisposition } from './content-disposition.ts'
import { ContentRange } from './content-range.ts'
import { ContentType } from './content-type.ts'
import { Cookie } from './cookie.ts'
import { IfMatch } from './if-match.ts'
import { IfNoneMatch } from './if-none-match.ts'
import { IfRange } from './if-range.ts'
import { Range } from './range.ts'
import { SuperHeaders } from './super-headers.ts'

/**
 * Returns headers as they appear when attached to a Response.
 *
 * In Bun, Response reads from native Headers storage, bypassing our JavaScript.
 * Always use this to verify header values to catch sync issues that direct
 * SuperHeaders.get() access would miss.
 */
function getResponseHeaders(headers: SuperHeaders): Headers {
  return new Response('', { headers }).headers
}

describe('SuperHeaders', () => {
  it('is an instance of Headers', () => {
    let headers = new SuperHeaders()
    assert.ok(headers instanceof SuperHeaders)
    assert.ok(headers instanceof Headers)
  })

  it('initializes with no arguments', () => {
    let headers = new SuperHeaders()
    // Check direct access since Response adds default Content-Type
    assert.equal(headers.get('Content-Type'), null)
  })

  it('initializes from an object of header name/value pairs', () => {
    let headers = new SuperHeaders({ 'Content-Type': 'text/plain' })
    assert.equal(getResponseHeaders(headers).get('Content-Type'), 'text/plain')
  })

  it('initializes from an array of key-value pairs', () => {
    let headers = new SuperHeaders([
      ['Content-Type', 'text/plain'],
      ['X-Custom', 'value'],
    ])
    let responseHeaders = getResponseHeaders(headers)
    assert.equal(responseHeaders.get('Content-Type'), 'text/plain')
    assert.equal(responseHeaders.get('X-Custom'), 'value')
  })

  it('initializes from a Headers instance', () => {
    let h1 = new Headers({ 'Content-Type': 'text/plain' })
    let h2 = new SuperHeaders(h1)
    assert.equal(getResponseHeaders(h2).get('Content-Type'), 'text/plain')
  })

  it('initializes from another SuperHeaders instance', () => {
    let h1 = new SuperHeaders({ 'Content-Type': 'text/plain' })
    let h2 = new SuperHeaders(h1)
    assert.equal(getResponseHeaders(h2).get('Content-Type'), 'text/plain')
  })

  it('initializes from a string', () => {
    let headers = new SuperHeaders('Content-Type: text/plain\r\nContent-Length: 42')
    let responseHeaders = getResponseHeaders(headers)
    assert.equal(responseHeaders.get('Content-Type'), 'text/plain')
    assert.equal(responseHeaders.get('Content-Length'), '42')
  })

  it('appends values', () => {
    let headers = new SuperHeaders()
    headers.append('X-Custom', 'value1')
    headers.append('X-Custom', 'value2')
    assert.equal(getResponseHeaders(headers).get('X-Custom'), 'value1, value2')
  })

  it('sets values', () => {
    let headers = new SuperHeaders()
    headers.set('X-Custom', 'value1')
    headers.set('X-Custom', 'value2')
    assert.equal(getResponseHeaders(headers).get('X-Custom'), 'value2')
  })

  it('deletes values', () => {
    let headers = new SuperHeaders({ 'X-Custom': 'value' })
    headers.delete('X-Custom')
    assert.equal(getResponseHeaders(headers).has('X-Custom'), false)
  })

  it('checks if a header exists', () => {
    let headers = new SuperHeaders({ 'X-Custom': 'value' })
    assert.equal(getResponseHeaders(headers).has('X-Custom'), true)
    // Check direct access for non-existent headers since Response adds defaults
    assert.equal(headers.has('Content-Type'), false)

    // Accessing this property should not change the result of has()
    let _ = headers.contentType
    assert.equal(headers.has('Content-Type'), false)
  })

  it('iterates over entries', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let entries = Array.from(headers.entries())
    // Fetch spec: headers iterate in sorted order by name
    assert.deepEqual(entries, [
      ['content-length', '42'],
      ['content-type', 'text/plain'],
    ])
  })

  it('iterates over keys', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let keys = Array.from(headers.keys())
    // Fetch spec: headers iterate in sorted order by name
    assert.deepEqual(keys, ['content-length', 'content-type'])
  })

  it('iterates over set-cookie keys correctly', () => {
    let headers = new SuperHeaders()
    headers.append('Set-Cookie', 'session=abc')
    headers.append('Set-Cookie', 'theme=dark')
    let keys = Array.from(headers.keys())
    assert.deepEqual(keys, ['set-cookie', 'set-cookie'])
  })

  it('iterates over values', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let values = Array.from(headers.values())
    // Fetch spec: headers iterate in sorted order by name
    assert.deepEqual(values, ['42', 'text/plain'])
  })

  it('uses forEach correctly', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let result: [string, string][] = []
    headers.forEach((value, key) => {
      result.push([key, value])
    })
    // Fetch spec: headers iterate in sorted order by name
    assert.deepEqual(result, [
      ['content-length', '42'],
      ['content-type', 'text/plain'],
    ])
  })

  it('is directly iterable', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let entries = Array.from(headers)
    // Fetch spec: headers iterate in sorted order by name
    assert.deepEqual(entries, [
      ['content-length', '42'],
      ['content-type', 'text/plain'],
    ])
  })

  it('omits empty values when stringified', () => {
    let headers = new SuperHeaders()

    // This should appear in the string since it has a media type, it's complete
    headers.contentType = 'text/plain'

    // This should not appear in the string since it's incomplete, missing the type
    headers.contentDisposition.filename = 'example.txt'

    assert.equal(headers.toString(), 'Content-Type: text/plain')
  })

  describe('constructor property init', () => {
    it('handles the accept property', () => {
      let headers = new SuperHeaders({ accept: { 'text/html': 1, 'application/json': 0.9 } })
      assert.equal(getResponseHeaders(headers).get('Accept'), 'text/html,application/json;q=0.9')
    })

    it('handles the acceptEncoding property', () => {
      let headers = new SuperHeaders({ acceptEncoding: { gzip: 1, deflate: 0.8 } })
      assert.equal(getResponseHeaders(headers).get('Accept-Encoding'), 'gzip,deflate;q=0.8')
    })

    it('handles the acceptLanguage property', () => {
      let headers = new SuperHeaders({ acceptLanguage: { 'en-US': 1, en: 0.9 } })
      assert.equal(getResponseHeaders(headers).get('Accept-Language'), 'en-us,en;q=0.9')
    })

    it('handles the acceptRanges property', () => {
      let headers = new SuperHeaders({ acceptRanges: 'bytes' })
      assert.equal(getResponseHeaders(headers).get('Accept-Ranges'), 'bytes')
    })

    it('handles the age property', () => {
      let headers = new SuperHeaders({ age: 42 })
      assert.equal(getResponseHeaders(headers).get('Age'), '42')
    })

    it('handles the cacheControl property', () => {
      let headers = new SuperHeaders({ cacheControl: { public: true, maxAge: 3600 } })
      assert.equal(getResponseHeaders(headers).get('Cache-Control'), 'public, max-age=3600')
    })

    it('handles the connection property', () => {
      let headers = new SuperHeaders({ connection: 'close' })
      assert.equal(getResponseHeaders(headers).get('Connection'), 'close')
    })

    it('handles the contentDisposition property', () => {
      let headers = new SuperHeaders({
        contentDisposition: { type: 'attachment', filename: 'example.txt' },
      })
      assert.equal(
        getResponseHeaders(headers).get('Content-Disposition'),
        'attachment; filename=example.txt',
      )
    })

    it('handles the contentEncoding property', () => {
      let headers = new SuperHeaders({ contentEncoding: 'gzip' })
      assert.equal(getResponseHeaders(headers).get('Content-Encoding'), 'gzip')
    })

    it('handles the contentLanguage property', () => {
      let headers = new SuperHeaders({ contentLanguage: 'en-US' })
      assert.equal(getResponseHeaders(headers).get('Content-Language'), 'en-US')
    })

    it('handles the contentLength property', () => {
      let headers = new SuperHeaders({ contentLength: 42 })
      assert.equal(getResponseHeaders(headers).get('Content-Length'), '42')
    })

    it('handles the contentRange property', () => {
      let headers = new SuperHeaders({
        contentRange: { unit: 'bytes', start: 200, end: 1000, size: 67589 },
      })
      assert.equal(getResponseHeaders(headers).get('Content-Range'), 'bytes 200-1000/67589')
    })

    it('handles the contentType property', () => {
      let headers = new SuperHeaders({
        contentType: { mediaType: 'text/plain', charset: 'utf-8' },
      })
      assert.equal(getResponseHeaders(headers).get('Content-Type'), 'text/plain; charset=utf-8')
    })

    it('handles the cookie property', () => {
      let headers = new SuperHeaders({ cookie: [['name', 'value']] })
      assert.equal(getResponseHeaders(headers).get('Cookie'), 'name=value')
    })

    it('handles the date property', () => {
      let headers = new SuperHeaders({ date: new Date('2021-01-01T00:00:00Z') })
      assert.equal(getResponseHeaders(headers).get('Date'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the etag property', () => {
      let headers = new SuperHeaders({ etag: '"67ab43"' })
      assert.equal(getResponseHeaders(headers).get('ETag'), '"67ab43"')

      let headers2 = new SuperHeaders({ etag: '67ab43' })
      assert.equal(getResponseHeaders(headers2).get('ETag'), '"67ab43"')

      let headers3 = new SuperHeaders({ etag: 'W/"67ab43"' })
      assert.equal(getResponseHeaders(headers3).get('ETag'), 'W/"67ab43"')
    })

    it('handles the expires property', () => {
      let headers = new SuperHeaders({ expires: new Date('2021-01-01T00:00:00Z') })
      assert.equal(getResponseHeaders(headers).get('Expires'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the host property', () => {
      let headers = new SuperHeaders({ host: 'example.com' })
      assert.equal(getResponseHeaders(headers).get('Host'), 'example.com')
    })

    it('handles the ifModifiedSince property', () => {
      let headers = new SuperHeaders({ ifModifiedSince: new Date('2021-01-01T00:00:00Z') })
      assert.equal(
        getResponseHeaders(headers).get('If-Modified-Since'),
        'Fri, 01 Jan 2021 00:00:00 GMT',
      )
    })

    it('handles the ifMatch property', () => {
      let headers = new SuperHeaders({ ifMatch: ['67ab43', '54ed21'] })
      assert.equal(getResponseHeaders(headers).get('If-Match'), '"67ab43", "54ed21"')
    })

    it('handles the ifNoneMatch property', () => {
      let headers = new SuperHeaders({ ifNoneMatch: ['67ab43', '54ed21'] })
      assert.equal(getResponseHeaders(headers).get('If-None-Match'), '"67ab43", "54ed21"')
    })

    it('handles the ifUnmodifiedSince property', () => {
      let headers = new SuperHeaders({ ifUnmodifiedSince: new Date('2021-01-01T00:00:00Z') })
      assert.equal(
        getResponseHeaders(headers).get('If-Unmodified-Since'),
        'Fri, 01 Jan 2021 00:00:00 GMT',
      )
    })

    it('handles the lastModified property', () => {
      let headers = new SuperHeaders({ lastModified: new Date('2021-01-01T00:00:00Z') })
      assert.equal(
        getResponseHeaders(headers).get('Last-Modified'),
        'Fri, 01 Jan 2021 00:00:00 GMT',
      )
    })

    it('handles the location property', () => {
      let headers = new SuperHeaders({ location: 'https://example.com' })
      assert.equal(getResponseHeaders(headers).get('Location'), 'https://example.com')
    })

    it('handles the referer property', () => {
      let headers = new SuperHeaders({ referer: 'https://example.com' })
      assert.equal(getResponseHeaders(headers).get('Referer'), 'https://example.com')
    })

    it('handles the setCookie property', () => {
      let headers = new SuperHeaders({
        setCookie: [
          { name: 'session', value: 'abc', path: '/' },
          { name: 'theme', value: 'dark', expires: new Date('2021-12-31T23:59:59Z') },
        ],
      })
      assert.deepEqual(getResponseHeaders(headers).getSetCookie(), [
        'session=abc; Path=/',
        'theme=dark; Expires=Fri, 31 Dec 2021 23:59:59 GMT',
      ])
    })

    it('handles the vary property', () => {
      let headers = new SuperHeaders({ vary: ['Accept-Encoding', 'Accept-Language'] })
      assert.equal(getResponseHeaders(headers).get('Vary'), 'accept-encoding, accept-language')
    })

    it('stringifies unknown properties with non-string values', () => {
      let headers = new SuperHeaders({ unknown: 42 })
      assert.equal(headers.get('Unknown'), '42')
    })
  })

  describe('property getters and setters', () => {
    describe('accept', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.accept instanceof Accept)

        headers.accept = 'text/html,application/json;q=0.9'
        assert.deepEqual(headers.accept.size, 2)
        // Spread arrays to work around Bun's deepEqual not handling Proxies
        assert.deepEqual([...headers.accept.mediaTypes], ['text/html', 'application/json'])
        assert.deepEqual([...headers.accept.weights], [1, 0.9])

        headers.accept = { 'application/json': 0.8, 'text/html': 1 }
        assert.deepEqual(headers.accept.size, 2)
        assert.deepEqual([...headers.accept.mediaTypes], ['text/html', 'application/json'])
        assert.deepEqual([...headers.accept.weights], [1, 0.8])

        headers.accept = null
        assert.ok(headers.accept instanceof Accept)
        assert.equal(headers.accept.toString(), '')
      })

      it('syncs set() mutations', () => {
        let headers = new SuperHeaders()
        headers.accept = 'text/html'

        headers.accept.set('application/json', 0.9)
        assert.ok(getResponseHeaders(headers).get('accept')?.includes('application/json'))
      })

      it('syncs delete() mutations', () => {
        let headers = new SuperHeaders()
        headers.accept = 'text/html, application/json'

        headers.accept.delete('application/json')
        assert.ok(!getResponseHeaders(headers).get('accept')?.includes('application/json'))
      })
    })

    describe('acceptEncoding', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.acceptEncoding instanceof AcceptEncoding)

        headers.acceptEncoding = 'gzip, deflate'
        assert.deepEqual(headers.acceptEncoding.size, 2)
        // Spread arrays to work around Bun's deepEqual not handling Proxies
        assert.deepEqual([...headers.acceptEncoding.encodings], ['gzip', 'deflate'])
        assert.deepEqual([...headers.acceptEncoding.weights], [1, 1])

        headers.acceptEncoding = { gzip: 1, deflate: 0.8 }
        assert.deepEqual(headers.acceptEncoding.size, 2)
        assert.deepEqual([...headers.acceptEncoding.encodings], ['gzip', 'deflate'])
        assert.deepEqual([...headers.acceptEncoding.weights], [1, 0.8])

        headers.acceptEncoding = null
        assert.ok(headers.acceptEncoding instanceof AcceptEncoding)
        assert.equal(headers.acceptEncoding.toString(), '')
      })

      it('syncs set() mutations', () => {
        let headers = new SuperHeaders()
        headers.acceptEncoding = 'gzip'

        headers.acceptEncoding.set('br', 1)
        assert.ok(getResponseHeaders(headers).get('accept-encoding')?.includes('br'))
      })
    })

    describe('acceptLanguage', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.acceptLanguage instanceof AcceptLanguage)

        headers.acceptLanguage = 'en-US,en;q=0.9'
        assert.deepEqual(headers.acceptLanguage.size, 2)
        // Spread arrays to work around Bun's deepEqual not handling Proxies
        assert.deepEqual([...headers.acceptLanguage.languages], ['en-us', 'en'])
        assert.deepEqual([...headers.acceptLanguage.weights], [1, 0.9])

        headers.acceptLanguage = { en: 1, 'en-US': 0.8 }
        assert.deepEqual(headers.acceptLanguage.size, 2)
        assert.deepEqual([...headers.acceptLanguage.languages], ['en', 'en-us'])
        assert.deepEqual([...headers.acceptLanguage.weights], [1, 0.8])

        headers.acceptLanguage = null
        assert.ok(headers.acceptLanguage instanceof AcceptLanguage)
        assert.equal(headers.acceptLanguage.toString(), '')
      })

      it('syncs set() mutations', () => {
        let headers = new SuperHeaders()
        headers.acceptLanguage = 'en'

        headers.acceptLanguage.set('fr', 0.8)
        assert.ok(getResponseHeaders(headers).get('accept-language')?.includes('fr'))
      })
    })

    it('supports the acceptRanges property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.acceptRanges, null)

      headers.acceptRanges = 'bytes'
      assert.equal(headers.acceptRanges, 'bytes')

      headers.acceptRanges = null
      assert.equal(headers.acceptRanges, null)
    })

    it('supports the age property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.age, null)

      headers.age = '42'
      assert.equal(headers.age, 42)

      headers.age = 42
      assert.equal(headers.age, 42)

      headers.age = null
      assert.equal(headers.age, null)
    })

    it('supports the allow property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.allow, null)

      headers.allow = 'GET, HEAD'
      assert.equal(headers.allow, 'GET, HEAD')

      headers.allow = ['GET', 'POST', 'PUT', 'DELETE']
      assert.equal(headers.allow, 'GET, POST, PUT, DELETE')

      headers.allow = null
      assert.equal(headers.allow, null)
    })

    describe('cacheControl', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.cacheControl instanceof CacheControl)

        headers.cacheControl = 'public, max-age=3600'
        assert.equal(headers.cacheControl.public, true)
        assert.equal(headers.cacheControl.maxAge, 3600)

        headers.cacheControl.maxAge = 1800
        assert.equal(headers.cacheControl.maxAge, 1800)

        headers.cacheControl = { noCache: true, noStore: true }
        assert.equal(headers.cacheControl.noCache, true)
        assert.equal(headers.cacheControl.noStore, true)

        headers.cacheControl = null
        assert.ok(headers.cacheControl instanceof CacheControl)
        assert.equal(headers.cacheControl.toString(), '')
      })

      it('syncs property mutations', () => {
        let headers = new SuperHeaders()
        headers.cacheControl = 'public'

        headers.cacheControl.maxAge = 3600
        assert.equal(getResponseHeaders(headers).get('cache-control'), 'public, max-age=3600')

        headers.cacheControl.noCache = true
        assert.ok(getResponseHeaders(headers).get('cache-control')?.includes('no-cache'))
      })
    })

    it('supports the connection property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.connection, null)

      headers.connection = 'close'
      assert.equal(headers.connection, 'close')

      headers.connection = null
      assert.equal(headers.connection, null)
    })

    describe('contentDisposition', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.contentDisposition instanceof ContentDisposition)

        headers.contentDisposition = 'attachment; filename="example.txt"'
        assert.equal(headers.contentDisposition.type, 'attachment')
        assert.equal(headers.contentDisposition.filename, 'example.txt')

        headers.contentDisposition.filename = 'new.txt'
        assert.equal(headers.contentDisposition.filename, 'new.txt')

        headers.contentDisposition = { type: 'inline', filename: 'index.html' }
        assert.equal(headers.contentDisposition.type, 'inline')
        assert.equal(headers.contentDisposition.filename, 'index.html')

        headers.contentDisposition = null
        assert.ok(headers.contentDisposition instanceof ContentDisposition)
        assert.equal(headers.contentDisposition.toString(), '')
      })

      it('syncs property mutations', () => {
        let headers = new SuperHeaders()
        headers.contentDisposition = 'attachment'

        headers.contentDisposition.filename = 'test.pdf'
        assert.equal(
          getResponseHeaders(headers).get('content-disposition'),
          'attachment; filename=test.pdf',
        )
      })
    })

    it('supports the contentEncoding property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.contentEncoding, null)

      headers.contentEncoding = 'gzip'
      assert.equal(headers.contentEncoding, 'gzip')

      headers.contentEncoding = ['deflate', 'gzip']
      assert.equal(headers.contentEncoding, 'deflate, gzip')

      headers.contentEncoding = null
      assert.equal(headers.contentEncoding, null)
    })

    it('supports the contentLanguage property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.contentLanguage, null)

      headers.contentLanguage = 'en-US'
      assert.equal(headers.contentLanguage, 'en-US')

      headers.contentLanguage = ['en', 'fr']
      assert.equal(headers.contentLanguage, 'en, fr')

      headers.contentLanguage = null
      assert.equal(headers.contentLanguage, null)
    })

    it('supports the contentLength property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.contentLength, null)

      headers.contentLength = '42'
      assert.equal(headers.contentLength, 42)

      headers.contentLength = 42
      assert.equal(headers.contentLength, 42)

      headers.contentLength = null
      assert.equal(headers.contentLength, null)
    })

    it('supports the contentRange property', () => {
      let headers = new SuperHeaders()

      assert.ok(headers.contentRange instanceof ContentRange)

      headers.contentRange = 'bytes 200-1000/67589'
      assert.equal(headers.contentRange.unit, 'bytes')
      assert.equal(headers.contentRange.start, 200)
      assert.equal(headers.contentRange.end, 1000)
      assert.equal(headers.contentRange.size, 67589)

      headers.contentRange = { unit: 'bytes', start: 0, end: 999, size: '*' }
      assert.equal(headers.contentRange.unit, 'bytes')
      assert.equal(headers.contentRange.start, 0)
      assert.equal(headers.contentRange.end, 999)
      assert.equal(headers.contentRange.size, '*')

      headers.contentRange = null
      assert.ok(headers.contentRange instanceof ContentRange)
      assert.equal(headers.contentRange.toString(), '')
    })

    describe('contentType', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.contentType instanceof ContentType)

        headers.contentType = 'text/plain; charset=utf-8'
        assert.equal(headers.contentType.mediaType, 'text/plain')
        assert.equal(headers.contentType.charset, 'utf-8')

        headers.contentType.charset = 'iso-8859-1'
        assert.equal(headers.contentType.charset, 'iso-8859-1')

        headers.contentType = { mediaType: 'text/html' }
        assert.equal(headers.contentType.mediaType, 'text/html')

        headers.contentType = null
        assert.ok(headers.contentType instanceof ContentType)
        assert.equal(headers.contentType.toString(), '')
      })

      it('syncs property mutations', () => {
        let headers = new SuperHeaders()
        headers.contentType = 'text/html'

        headers.contentType.mediaType = 'text/plain'
        assert.equal(getResponseHeaders(headers).get('content-type'), 'text/plain')

        headers.contentType.charset = 'utf-8'
        assert.equal(getResponseHeaders(headers).get('content-type'), 'text/plain; charset=utf-8')
      })

      it('maintains stable object identity when string API changes the value', () => {
        let headers = new SuperHeaders()

        // Get a reference to the contentType object
        let ct = headers.contentType
        ct.mediaType = 'text/plain'

        // Use string API to change the value
        headers.set('content-type', 'application/json')

        // The same object reference should reflect the new value
        assert.equal(ct.mediaType, 'application/json')
        assert.equal(ct.charset, undefined)
        assert.equal(headers.contentType, ct) // Same object reference
      })

      it('does not leak empty cached objects after delete', () => {
        let headers = new SuperHeaders()
        headers.contentType = 'text/html'

        // Get a reference to create cached object
        let ct = headers.contentType
        assert.equal(ct.mediaType, 'text/html')

        // Delete the header
        headers.delete('content-type')

        // Cached object should be empty but not leak into public API
        assert.equal(ct.mediaType, undefined)
        assert.equal(headers.get('content-type'), null)
        assert.equal(headers.has('content-type'), false)

        // Empty header should not appear in iteration
        let keys = [...headers.keys()]
        assert.ok(!keys.includes('content-type'))

        // Setting a new value should update the same object
        headers.set('content-type', 'application/json')
        assert.equal(ct.mediaType, 'application/json')
        assert.equal(headers.contentType, ct) // Same object reference
      })
    })

    describe('cookie', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.cookie instanceof Cookie)

        headers.cookie = 'name1=value1; name2=value2'
        assert.equal(headers.cookie.get('name1'), 'value1')
        assert.equal(headers.cookie.get('name2'), 'value2')

        headers.cookie.set('name3', 'value3')
        assert.equal(headers.cookie.get('name3'), 'value3')

        headers.cookie = [['name4', 'value4']]
        assert.equal(headers.cookie.get('name4'), 'value4')

        headers.cookie = null
        assert.ok(headers.cookie instanceof Cookie)
        assert.equal(headers.cookie.toString(), '')
      })

      it('syncs set() mutations', () => {
        let headers = new SuperHeaders()
        headers.cookie = 'a=1'

        headers.cookie.set('b', '2')
        assert.equal(getResponseHeaders(headers).get('cookie'), 'a=1; b=2')
      })

      it('syncs delete() mutations', () => {
        let headers = new SuperHeaders()
        headers.cookie = 'a=1; b=2'

        headers.cookie.delete('a')
        assert.equal(getResponseHeaders(headers).get('cookie'), 'b=2')
      })

      it('syncs clear() mutations', () => {
        let headers = new SuperHeaders()
        headers.cookie = 'a=1; b=2'

        headers.cookie.clear()
        assert.equal(getResponseHeaders(headers).get('cookie'), null)
      })
    })

    it('supports the date property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.date, null)

      headers.date = new Date('2021-01-01T00:00:00Z')
      assert.ok(headers.date instanceof Date)
      assert.equal(headers.date.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.date = null
      assert.equal(headers.date, null)
    })

    it('supports the etag property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.etag, null)

      headers.etag = '"67ab43"'
      assert.equal(headers.etag, '"67ab43"')

      headers.etag = '67ab43'
      assert.equal(headers.etag, '"67ab43"')

      headers.etag = 'W/"67ab43"'
      assert.equal(headers.etag, 'W/"67ab43"')

      headers.etag = ''
      assert.equal(headers.etag, '""')

      headers.etag = '""'
      assert.equal(headers.etag, '""')

      headers.etag = null
      assert.equal(headers.etag, null)
    })

    it('supports the expires property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.expires, null)

      headers.expires = new Date('2021-01-01T00:00:00Z')
      assert.ok(headers.expires instanceof Date)
      assert.equal(headers.expires.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.expires = null
      assert.equal(headers.expires, null)
    })

    it('supports the host property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.host, null)

      headers.host = 'example.com'
      assert.equal(headers.host, 'example.com')

      headers.host = null
      assert.equal(headers.host, null)
    })

    it('supports the ifModifiedSince property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.ifModifiedSince, null)

      headers.ifModifiedSince = new Date('2021-01-01T00:00:00Z')
      assert.ok(headers.ifModifiedSince instanceof Date)
      assert.equal(headers.ifModifiedSince.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.ifModifiedSince = null
      assert.equal(headers.ifModifiedSince, null)
    })

    describe('ifMatch', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.ifMatch instanceof IfMatch)
        assert.equal(headers.ifMatch.tags.length, 0)

        headers.ifMatch = '67ab43'
        // Spread arrays to work around Bun's deepEqual not handling Proxies
        assert.deepEqual([...headers.ifMatch.tags], ['"67ab43"'])

        headers.ifMatch = ['67ab43', '54ed21']
        assert.deepEqual([...headers.ifMatch.tags], ['"67ab43"', '"54ed21"'])

        headers.ifMatch = { tags: ['W/"67ab43"'] }
        assert.deepEqual([...headers.ifMatch.tags], ['W/"67ab43"'])

        headers.ifMatch = null
        assert.ok(headers.ifMatch instanceof IfMatch)
        assert.equal(headers.ifMatch.tags.length, 0)
      })

      it('syncs tags.push() mutations', () => {
        let headers = new SuperHeaders()
        headers.ifMatch = '"abc"'

        headers.ifMatch.tags.push('"def"')
        assert.ok(getResponseHeaders(headers).get('if-match')?.includes('"def"'))
      })
    })

    describe('ifNoneMatch', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.ifNoneMatch instanceof IfNoneMatch)

        headers.ifNoneMatch = '"67ab43", "54ed21"'
        // Spread arrays to work around Bun's deepEqual not handling Proxies
        assert.deepEqual([...headers.ifNoneMatch.tags], ['"67ab43"', '"54ed21"'])

        headers.ifNoneMatch = ['67ab43', '54ed21']
        assert.deepEqual([...headers.ifNoneMatch.tags], ['"67ab43"', '"54ed21"'])

        headers.ifNoneMatch = { tags: ['67ab43', '54ed21'] }
        assert.deepEqual([...headers.ifNoneMatch.tags], ['"67ab43"', '"54ed21"'])

        assert.equal(headers.ifNoneMatch.toString(), '"67ab43", "54ed21"')

        headers.ifNoneMatch = null
        assert.ok(headers.ifNoneMatch instanceof IfNoneMatch)
        assert.equal(headers.ifNoneMatch.toString(), '')
      })

      it('syncs tags.push() mutations', () => {
        let headers = new SuperHeaders()
        headers.ifNoneMatch = '"abc"'

        headers.ifNoneMatch.tags.push('"def"')
        assert.ok(getResponseHeaders(headers).get('if-none-match')?.includes('"def"'))
      })
    })

    it('supports the ifRange property', () => {
      let headers = new SuperHeaders()

      assert.ok(headers.ifRange instanceof IfRange)
      assert.equal(headers.ifRange.value, '')

      headers.ifRange = 'Fri, 01 Jan 2021 00:00:00 GMT'
      assert.equal(headers.ifRange.value, 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.ifRange = new Date('2021-01-01T00:00:00Z')
      assert.equal(headers.ifRange.value, 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.ifRange = '"67ab43"'
      assert.equal(headers.ifRange.value, '"67ab43"')

      assert.equal(headers.ifRange.toString(), '"67ab43"')
    })

    it('supports the ifUnmodifiedSince property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.ifUnmodifiedSince, null)

      headers.ifUnmodifiedSince = new Date('2021-01-01T00:00:00Z')
      assert.ok(headers.ifUnmodifiedSince instanceof Date)
      assert.equal(headers.ifUnmodifiedSince.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.ifUnmodifiedSince = null
      assert.equal(headers.ifUnmodifiedSince, null)
    })

    it('supports the lastModified property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.lastModified, null)

      headers.lastModified = new Date('2021-01-01T00:00:00Z')
      assert.ok(headers.lastModified instanceof Date)
      assert.equal(headers.lastModified.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT')

      headers.lastModified = null
      assert.equal(headers.lastModified, null)
    })

    it('supports the location property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.location, null)

      headers.location = 'https://example.com'
      assert.equal(headers.location, 'https://example.com')

      headers.location = null
      assert.equal(headers.location, null)
    })

    describe('range', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.ok(headers.range instanceof Range)
        assert.equal(headers.range.ranges.length, 0)

        headers.range = 'bytes=0-99'
        assert.equal(headers.range.unit, 'bytes')
        assert.equal(headers.range.ranges.length, 1)
        assert.equal(headers.range.ranges[0].start, 0)
        assert.equal(headers.range.ranges[0].end, 99)

        headers.range = { unit: 'bytes', ranges: [{ start: 100, end: 199 }] }
        assert.equal(headers.range.unit, 'bytes')
        assert.equal(headers.range.ranges.length, 1)
        assert.equal(headers.range.ranges[0].start, 100)
        assert.equal(headers.range.ranges[0].end, 199)

        headers.range = null
        assert.ok(headers.range instanceof Range)
        assert.equal(headers.range.ranges.length, 0)
      })

      it('syncs ranges.push() mutations', () => {
        let headers = new SuperHeaders()
        headers.range = { unit: 'bytes', ranges: [{ start: 0, end: 99 }] }

        headers.range.ranges.push({ start: 200, end: 299 })
        assert.equal(getResponseHeaders(headers).get('range'), 'bytes=0-99,200-299')
      })

      it('syncs ranges index assignment mutations', () => {
        let headers = new SuperHeaders()
        headers.range = { unit: 'bytes', ranges: [{ start: 0, end: 99 }] }

        headers.range.ranges[0] = { start: 100, end: 199 }
        assert.equal(getResponseHeaders(headers).get('range'), 'bytes=100-199')
      })

      it('syncs nested object mutations', () => {
        let headers = new SuperHeaders()
        headers.range = { unit: 'bytes', ranges: [{ start: 0, end: 99 }] }

        headers.range.ranges[0].end = 199
        assert.equal(getResponseHeaders(headers).get('range'), 'bytes=0-199')
      })
    })

    it('supports the referer property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.referer, null)

      headers.referer = 'https://example.com'
      assert.equal(headers.referer, 'https://example.com')

      headers.referer = null
      assert.equal(headers.referer, null)
    })

    describe('setCookie', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        assert.equal(headers.setCookie.length, 0)

        headers.setCookie = 'session=abc'
        assert.equal(headers.setCookie.length, 1)
        assert.equal(headers.setCookie[0].name, 'session')
        assert.equal(headers.setCookie[0].value, 'abc')

        headers.setCookie = { name: 'session', value: 'def' }
        assert.equal(headers.setCookie.length, 1)
        assert.equal(headers.setCookie[0].name, 'session')
        assert.equal(headers.setCookie[0].value, 'def')

        headers.setCookie = ['session=abc', 'theme=dark']
        assert.equal(headers.setCookie.length, 2)
        assert.equal(headers.setCookie[0].name, 'session')
        assert.equal(headers.setCookie[0].value, 'abc')
        assert.equal(headers.setCookie[1].name, 'theme')
        assert.equal(headers.setCookie[1].value, 'dark')

        // Can use ...spread to add new cookies
        headers.setCookie = [...headers.setCookie, 'lang=en']
        assert.equal(headers.setCookie.length, 3)
        assert.equal(headers.setCookie[2].name, 'lang')
        assert.equal(headers.setCookie[2].value, 'en')

        headers.setCookie = [
          { name: 'session', value: 'def' },
          { name: 'theme', value: 'light' },
        ]
        assert.equal(headers.setCookie.length, 2)
        assert.equal(headers.setCookie[0].name, 'session')
        assert.equal(headers.setCookie[0].value, 'def')
        assert.equal(headers.setCookie[1].name, 'theme')
        assert.equal(headers.setCookie[1].value, 'light')

        // Can use push() to add new cookies
        headers.setCookie.push({ name: 'lang', value: 'fr' })
        assert.equal(headers.setCookie.length, 3)
        assert.equal(headers.setCookie[2].name, 'lang')
        assert.equal(headers.setCookie[2].value, 'fr')

        headers.setCookie = null
        assert.equal(headers.setCookie.length, 0)
      })

      it('syncs setter assignment to Response', () => {
        let headers = new SuperHeaders()
        headers.setCookie = ['session=abc', 'theme=dark']

        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), ['session=abc', 'theme=dark'])
      })

      it('syncs push() mutations to Response', () => {
        let headers = new SuperHeaders()
        headers.setCookie = 'session=abc'

        headers.setCookie.push({ name: 'theme', value: 'dark' })
        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), ['session=abc', 'theme=dark'])
      })

      it('syncs index assignment mutations to Response', () => {
        let headers = new SuperHeaders()
        headers.setCookie = ['session=abc', 'theme=dark']

        headers.setCookie[0] = { name: 'updated', value: 'cookie' }
        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), [
          'updated=cookie',
          'theme=dark',
        ])
      })

      it('syncs property mutations on SetCookie objects to Response', () => {
        let headers = new SuperHeaders()
        headers.setCookie = 'session=abc'

        headers.setCookie[0].value = 'updated'
        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), ['session=updated'])

        headers.setCookie[0].path = '/'
        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), ['session=updated; Path=/'])
      })

      it('syncs delete() to Response', () => {
        let headers = new SuperHeaders()
        headers.setCookie = ['session=abc', 'theme=dark']

        headers.delete('set-cookie')
        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), [])
      })

      it('syncs append() to Response', () => {
        let headers = new SuperHeaders()
        headers.setCookie = 'session=abc'

        headers.append('set-cookie', 'theme=dark')
        assert.deepEqual(getResponseHeaders(headers).getSetCookie(), ['session=abc', 'theme=dark'])
      })
    })

    describe('vary', () => {
      it('gets and sets values', () => {
        let headers = new SuperHeaders()

        headers.vary = 'Accept-Encoding, Accept-Language'
        assert.equal(headers.vary.has('accept-encoding'), true)
        assert.equal(headers.vary.has('accept-language'), true)

        headers.vary = null
        assert.equal(headers.vary.size, 0)
      })

      it('syncs add() mutations', () => {
        let headers = new SuperHeaders()
        headers.vary = 'accept'

        headers.vary.add('accept-encoding')
        assert.ok(getResponseHeaders(headers).get('vary')?.includes('accept-encoding'))
      })

      it('syncs delete() mutations', () => {
        let headers = new SuperHeaders()
        headers.vary = 'accept, accept-encoding'

        headers.vary.delete('accept')
        assert.ok(!getResponseHeaders(headers).get('vary')?.includes('accept,'))
      })
    })
  })
})
