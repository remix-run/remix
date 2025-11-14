import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Accept } from './accept.ts'
import { AcceptEncoding } from './accept-encoding.ts'
import { AcceptLanguage } from './accept-language.ts'
import { CacheControl } from './cache-control.ts'
import { ContentDisposition } from './content-disposition.ts'
import { ContentType } from './content-type.ts'
import { Cookie } from './cookie.ts'
import { SuperHeaders } from './super-headers.ts'
import { IfNoneMatch } from './if-none-match.ts'

describe('SuperHeaders', () => {
  it('is an instance of Headers', () => {
    let headers = new SuperHeaders()
    assert.ok(headers instanceof SuperHeaders)
    assert.ok(headers instanceof Headers)
  })

  it('initializes with no arguments', () => {
    let headers = new SuperHeaders()
    assert.equal(headers.get('Content-Type'), null)
  })

  it('initializes from an object of header name/value pairs', () => {
    let headers = new SuperHeaders({ 'Content-Type': 'text/plain' })
    assert.equal(headers.get('Content-Type'), 'text/plain')
  })

  it('initializes from an array of key-value pairs', () => {
    let headers = new SuperHeaders([
      ['Content-Type', 'text/plain'],
      ['X-Custom', 'value'],
    ])
    assert.equal(headers.get('Content-Type'), 'text/plain')
    assert.equal(headers.get('X-Custom'), 'value')
  })

  it('initializes from a Headers instance', () => {
    let h1 = new Headers({ 'Content-Type': 'text/plain' })
    let h2 = new SuperHeaders(h1)
    assert.equal(h2.get('Content-Type'), 'text/plain')
  })

  it('initializes from another SuperHeaders instance', () => {
    let h1 = new SuperHeaders({ 'Content-Type': 'text/plain' })
    let h2 = new SuperHeaders(h1)
    assert.equal(h2.get('Content-Type'), 'text/plain')
  })

  it('initializes from a string', () => {
    let headers = new SuperHeaders('Content-Type: text/plain\r\nContent-Length: 42')
    assert.equal(headers.get('Content-Type'), 'text/plain')
    assert.equal(headers.get('Content-Length'), '42')
  })

  it('appends values', () => {
    let headers = new SuperHeaders()
    headers.append('X-Custom', 'value1')
    headers.append('X-Custom', 'value2')
    assert.equal(headers.get('X-Custom'), 'value1, value2')
  })

  it('sets values', () => {
    let headers = new SuperHeaders()
    headers.set('X-Custom', 'value1')
    headers.set('X-Custom', 'value2')
    assert.equal(headers.get('X-Custom'), 'value2')
  })

  it('deletes values', () => {
    let headers = new SuperHeaders({ 'X-Custom': 'value' })
    headers.delete('X-Custom')
    assert.equal(headers.has('X-Custom'), false)
  })

  it('checks if a header exists', () => {
    let headers = new SuperHeaders({ 'X-Custom': 'value' })
    assert.equal(headers.has('X-Custom'), true)
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
    assert.deepEqual(entries, [
      ['content-type', 'text/plain'],
      ['content-length', '42'],
    ])
  })

  it('iterates over keys', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let keys = Array.from(headers.keys())
    assert.deepEqual(keys, ['content-type', 'content-length'])
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
    assert.deepEqual(values, ['text/plain', '42'])
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
    assert.deepEqual(result, [
      ['content-type', 'text/plain'],
      ['content-length', '42'],
    ])
  })

  it('is directly iterable', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    })
    let entries = Array.from(headers)
    assert.deepEqual(entries, [
      ['content-type', 'text/plain'],
      ['content-length', '42'],
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
      assert.equal(headers.get('Accept'), 'text/html,application/json;q=0.9')
    })

    it('handles the acceptEncoding property', () => {
      let headers = new SuperHeaders({ acceptEncoding: { gzip: 1, deflate: 0.8 } })
      assert.equal(headers.get('Accept-Encoding'), 'gzip,deflate;q=0.8')
    })

    it('handles the acceptLanguage property', () => {
      let headers = new SuperHeaders({ acceptLanguage: { 'en-US': 1, en: 0.9 } })
      assert.equal(headers.get('Accept-Language'), 'en-us,en;q=0.9')
    })

    it('handles the acceptRanges property', () => {
      let headers = new SuperHeaders({ acceptRanges: 'bytes' })
      assert.equal(headers.get('Accept-Ranges'), 'bytes')
    })

    it('handles the age property', () => {
      let headers = new SuperHeaders({ age: 42 })
      assert.equal(headers.get('Age'), '42')
    })

    it('handles the cacheControl property', () => {
      let headers = new SuperHeaders({ cacheControl: { public: true, maxAge: 3600 } })
      assert.equal(headers.get('Cache-Control'), 'public, max-age=3600')
    })

    it('handles the connection property', () => {
      let headers = new SuperHeaders({ connection: 'close' })
      assert.equal(headers.get('Connection'), 'close')
    })

    it('handles the contentDisposition property', () => {
      let headers = new SuperHeaders({
        contentDisposition: { type: 'attachment', filename: 'example.txt' },
      })
      assert.equal(headers.get('Content-Disposition'), 'attachment; filename=example.txt')
    })

    it('handles the contentEncoding property', () => {
      let headers = new SuperHeaders({ contentEncoding: 'gzip' })
      assert.equal(headers.get('Content-Encoding'), 'gzip')
    })

    it('handles the contentLanguage property', () => {
      let headers = new SuperHeaders({ contentLanguage: 'en-US' })
      assert.equal(headers.get('Content-Language'), 'en-US')
    })

    it('handles the contentLength property', () => {
      let headers = new SuperHeaders({ contentLength: 42 })
      assert.equal(headers.get('Content-Length'), '42')
    })

    it('handles the contentType property', () => {
      let headers = new SuperHeaders({
        contentType: { mediaType: 'text/plain', charset: 'utf-8' },
      })
      assert.equal(headers.get('Content-Type'), 'text/plain; charset=utf-8')
    })

    it('handles the cookie property', () => {
      let headers = new SuperHeaders({ cookie: [['name', 'value']] })
      assert.equal(headers.get('Cookie'), 'name=value')
    })

    it('handles the date property', () => {
      let headers = new SuperHeaders({ date: new Date('2021-01-01T00:00:00Z') })
      assert.equal(headers.get('Date'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the etag property', () => {
      let headers = new SuperHeaders({ etag: '"67ab43"' })
      assert.equal(headers.get('ETag'), '"67ab43"')

      let headers2 = new SuperHeaders({ etag: '67ab43' })
      assert.equal(headers2.get('ETag'), '"67ab43"')

      let headers3 = new SuperHeaders({ etag: 'W/"67ab43"' })
      assert.equal(headers3.get('ETag'), 'W/"67ab43"')
    })

    it('handles the expires property', () => {
      let headers = new SuperHeaders({ expires: new Date('2021-01-01T00:00:00Z') })
      assert.equal(headers.get('Expires'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the host property', () => {
      let headers = new SuperHeaders({ host: 'example.com' })
      assert.equal(headers.get('Host'), 'example.com')
    })

    it('handles the ifModifiedSince property', () => {
      let headers = new SuperHeaders({ ifModifiedSince: new Date('2021-01-01T00:00:00Z') })
      assert.equal(headers.get('If-Modified-Since'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the ifNoneMatch property', () => {
      let headers = new SuperHeaders({ ifNoneMatch: ['67ab43', '54ed21'] })
      assert.equal(headers.get('If-None-Match'), '"67ab43", "54ed21"')
    })

    it('handles the ifUnmodifiedSince property', () => {
      let headers = new SuperHeaders({ ifUnmodifiedSince: new Date('2021-01-01T00:00:00Z') })
      assert.equal(headers.get('If-Unmodified-Since'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the lastModified property', () => {
      let headers = new SuperHeaders({ lastModified: new Date('2021-01-01T00:00:00Z') })
      assert.equal(headers.get('Last-Modified'), 'Fri, 01 Jan 2021 00:00:00 GMT')
    })

    it('handles the location property', () => {
      let headers = new SuperHeaders({ location: 'https://example.com' })
      assert.equal(headers.get('Location'), 'https://example.com')
    })

    it('handles the referer property', () => {
      let headers = new SuperHeaders({ referer: 'https://example.com' })
      assert.equal(headers.get('Referer'), 'https://example.com')
    })

    it('handles the setCookie property', () => {
      let headers = new SuperHeaders({
        setCookie: [
          { name: 'session', value: 'abc', path: '/' },
          { name: 'theme', value: 'dark', expires: new Date('2021-12-31T23:59:59Z') },
        ],
      })
      assert.deepEqual(headers.getSetCookie(), [
        'session=abc; Path=/',
        'theme=dark; Expires=Fri, 31 Dec 2021 23:59:59 GMT',
      ])
    })

    it('handles the vary property', () => {
      let headers = new SuperHeaders({ vary: ['Accept-Encoding', 'Accept-Language'] })
      assert.equal(headers.get('Vary'), 'accept-encoding, accept-language')
    })

    it('stringifies unknown properties with non-string values', () => {
      let headers = new SuperHeaders({ unknown: 42 })
      assert.equal(headers.get('Unknown'), '42')
    })
  })

  describe('property getters and setters', () => {
    it('supports the accept property', () => {
      let headers = new SuperHeaders()

      assert.ok(headers.accept instanceof Accept)

      headers.accept = 'text/html,application/json;q=0.9'
      assert.deepEqual(headers.accept.size, 2)
      assert.deepEqual(headers.accept.mediaTypes, ['text/html', 'application/json'])
      assert.deepEqual(headers.accept.weights, [1, 0.9])

      headers.accept = { 'application/json': 0.8, 'text/html': 1 }
      assert.deepEqual(headers.accept.size, 2)
      assert.deepEqual(headers.accept.mediaTypes, ['text/html', 'application/json'])
      assert.deepEqual(headers.accept.weights, [1, 0.8])

      headers.accept = null
      assert.ok(headers.accept instanceof Accept)
      assert.equal(headers.accept.toString(), '')
    })

    it('supports the acceptEncoding property', () => {
      let headers = new SuperHeaders()

      assert.ok(headers.acceptEncoding instanceof AcceptEncoding)

      headers.acceptEncoding = 'gzip, deflate'
      assert.deepEqual(headers.acceptEncoding.size, 2)
      assert.deepEqual(headers.acceptEncoding.encodings, ['gzip', 'deflate'])
      assert.deepEqual(headers.acceptEncoding.weights, [1, 1])

      headers.acceptEncoding = { gzip: 1, deflate: 0.8 }
      assert.deepEqual(headers.acceptEncoding.size, 2)
      assert.deepEqual(headers.acceptEncoding.encodings, ['gzip', 'deflate'])
      assert.deepEqual(headers.acceptEncoding.weights, [1, 0.8])

      headers.acceptEncoding = null
      assert.ok(headers.acceptEncoding instanceof AcceptEncoding)
      assert.equal(headers.acceptEncoding.toString(), '')
    })

    it('supports the acceptLanguage property', () => {
      let headers = new SuperHeaders()

      assert.ok(headers.acceptLanguage instanceof AcceptLanguage)

      headers.acceptLanguage = 'en-US,en;q=0.9'
      assert.deepEqual(headers.acceptLanguage.size, 2)
      assert.deepEqual(headers.acceptLanguage.languages, ['en-us', 'en'])
      assert.deepEqual(headers.acceptLanguage.weights, [1, 0.9])

      headers.acceptLanguage = { en: 1, 'en-US': 0.8 }
      assert.deepEqual(headers.acceptLanguage.size, 2)
      assert.deepEqual(headers.acceptLanguage.languages, ['en', 'en-us'])
      assert.deepEqual(headers.acceptLanguage.weights, [1, 0.8])

      headers.acceptLanguage = null
      assert.ok(headers.acceptLanguage instanceof AcceptLanguage)
      assert.equal(headers.acceptLanguage.toString(), '')
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

    it('supports the cacheControl property', () => {
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

    it('supports the connection property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.connection, null)

      headers.connection = 'close'
      assert.equal(headers.connection, 'close')

      headers.connection = null
      assert.equal(headers.connection, null)
    })

    it('supports the contentDisposition property', () => {
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

    it('supports the contentType property', () => {
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

    it('supports the cookie property', () => {
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

    it('supports the ifNoneMatch property', () => {
      let headers = new SuperHeaders()

      assert.ok(headers.ifNoneMatch instanceof IfNoneMatch)

      headers.ifNoneMatch = '"67ab43", "54ed21"'
      assert.deepEqual(headers.ifNoneMatch.tags, ['"67ab43"', '"54ed21"'])

      headers.ifNoneMatch = ['67ab43', '54ed21']
      assert.deepEqual(headers.ifNoneMatch.tags, ['"67ab43"', '"54ed21"'])

      headers.ifNoneMatch = { tags: ['67ab43', '54ed21'] }
      assert.deepEqual(headers.ifNoneMatch.tags, ['"67ab43"', '"54ed21"'])

      headers.ifNoneMatch = null
      assert.ok(headers.ifNoneMatch instanceof IfNoneMatch)
      assert.equal(headers.ifNoneMatch.toString(), '')
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

    it('supports the referer property', () => {
      let headers = new SuperHeaders()

      assert.equal(headers.referer, null)

      headers.referer = 'https://example.com'
      assert.equal(headers.referer, 'https://example.com')

      headers.referer = null
      assert.equal(headers.referer, null)
    })

    it('supports the setCookie property', () => {
      let headers = new SuperHeaders()

      assert.deepEqual(headers.setCookie, [])

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
      assert.deepEqual(headers.setCookie, [])
    })

    it('supports the vary property', () => {
      let headers = new SuperHeaders()

      headers.vary = 'Accept-Encoding, Accept-Language'
      assert.equal(headers.vary.has('accept-encoding'), true)
      assert.equal(headers.vary.has('accept-language'), true)

      headers.vary = null
      assert.equal(headers.vary.size, 0)
    })
  })
})
