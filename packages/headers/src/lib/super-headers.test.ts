import * as assert from '@remix-run/assert'
import DefaultHeaders, {
  ContentType,
  stringify,
  SuperHeaders,
  type SuperHeadersInit,
} from '../index.ts'
import { describe, it } from '@remix-run/test'

function getResponseHeaders(headers: Headers): Headers {
  return new Response('', { headers }).headers
}

describe('SuperHeaders', () => {
  it('is an instance of Headers and the default export', () => {
    let headers = new SuperHeaders()

    assert.ok(headers instanceof SuperHeaders)
    assert.ok(headers instanceof Headers)
    assert.equal(DefaultHeaders, SuperHeaders)
  })

  it('initializes with no arguments', () => {
    let headers = new SuperHeaders()

    assert.equal(headers.get('Content-Type'), null)
  })

  it('initializes from header name/value pairs', () => {
    let headers = new SuperHeaders([
      ['Content-Type', 'text/plain'],
      ['X-Test', 'yes'],
    ])

    assert.equal(headers.get('Content-Type'), 'text/plain')
    assert.equal(headers.get('X-Test'), 'yes')
  })

  it('initializes from a Headers instance', () => {
    let original = new Headers({ 'Content-Type': 'text/plain' })
    let headers = new SuperHeaders(original)

    assert.equal(headers.get('Content-Type'), 'text/plain')
  })

  it('initializes from a plain header object', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'X-Test': 'yes',
    })

    assert.equal(headers.get('Content-Type'), 'text/plain')
    assert.equal(headers.get('X-Test'), 'yes')
  })

  it('initializes from typed property values', () => {
    let headers = new SuperHeaders({
      allow: ['GET', 'POST'],
      cacheControl: { public: true, maxAge: 3600 },
      contentType: { mediaType: 'text/html', charset: 'utf-8' },
      setCookie: [
        { name: 'session', value: 'abc', path: '/' },
        { name: 'theme', value: 'dark' },
      ],
    })

    assert.equal(headers.get('Allow'), 'GET, POST')
    assert.equal(headers.get('Cache-Control'), 'public, max-age=3600')
    assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')
    assert.deepEqual(headers.getSetCookie(), ['session=abc; Path=/', 'theme=dark'])
  })

  it('does not parse raw header strings', () => {
    assert.throws(() => Reflect.construct(SuperHeaders, ['Content-Type: text/html']), TypeError)
  })

  it('keeps native Headers storage visible to Response', () => {
    let headers = new SuperHeaders({ 'X-Test': 'yes' })

    assert.equal(getResponseHeaders(headers).get('X-Test'), 'yes')
  })

  it('parses typed headers lazily', () => {
    let original = ContentType.from
    let calls = 0

    ContentType.from = function from(value) {
      calls++
      return original(value)
    }

    try {
      let headers = new SuperHeaders({ 'Content-Type': 'text/html' })

      assert.equal(headers.has('Content-Type'), true)
      assert.equal(headers.get('Content-Type'), 'text/html')
      assert.deepEqual(Array.from(headers), [['content-type', 'text/html']])
      assert.equal(calls, 0)

      assert.equal(headers.contentType.mediaType, 'text/html')
      assert.equal(calls, 1)

      assert.equal(headers.contentType.mediaType, 'text/html')
      assert.equal(calls, 1)
    } finally {
      ContentType.from = original
    }
  })

  it('does not parse typed string initializer properties before access', () => {
    let original = ContentType.from
    let calls = 0

    ContentType.from = function from(value) {
      calls++
      return original(value)
    }

    try {
      let headers = new SuperHeaders({ contentType: 'text/html; charset=utf-8' })

      assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')
      assert.equal(calls, 0)

      assert.equal(headers.contentType.charset, 'utf-8')
      assert.equal(calls, 1)
      assert.equal(headers.contentType.mediaType, 'text/html')
      assert.equal(calls, 1)
    } finally {
      ContentType.from = original
    }
  })

  it('does not cache failed typed parses', () => {
    let original = ContentType.from
    let calls = 0

    ContentType.from = function from(value) {
      calls++
      if (calls === 1) {
        throw new Error('parse failed')
      }
      return original(value)
    }

    try {
      let headers = new SuperHeaders({ 'Content-Type': 'text/html' })

      assert.throws(() => headers.contentType, /parse failed/)
      assert.equal(calls, 1)
      assert.equal(headers.contentType.mediaType, 'text/html')
      assert.equal(calls, 2)
    } finally {
      ContentType.from = original
    }
  })

  it('sets string property values without parsing', () => {
    let original = ContentType.from
    let calls = 0

    ContentType.from = function from(value) {
      calls++
      return original(value)
    }

    try {
      let headers = new SuperHeaders()

      headers.contentType = 'text/html'
      assert.equal(headers.get('Content-Type'), 'text/html')
      assert.equal(calls, 0)

      assert.equal(headers.contentType.mediaType, 'text/html')
      assert.equal(calls, 1)
    } finally {
      ContentType.from = original
    }
  })

  it('does not create headers when accessing absent typed values', () => {
    let headers = new SuperHeaders()
    let contentType = headers.contentType

    assert.equal(headers.has('Content-Type'), false)
    assert.equal(headers.get('Content-Type'), null)
    assert.deepEqual(Array.from(headers), [])
    assert.equal(contentType.toString(), '')
  })

  it('creates headers when absent typed values become serializable', () => {
    let headers = new SuperHeaders()

    headers.contentType.charset = 'utf-8'
    assert.equal(headers.has('Content-Type'), false)

    headers.contentType.mediaType = 'text/html'
    assert.equal(headers.has('Content-Type'), true)
    assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')
  })

  it('deletes headers from nullish property values', () => {
    let headers = new SuperHeaders({ contentType: 'text/html' })

    headers.contentType = null
    assert.equal(headers.has('Content-Type'), false)
  })

  it('syncs typed property mutations to native storage', () => {
    let headers = new SuperHeaders()

    headers.contentType = 'text/html'
    headers.contentType.charset = 'utf-8'

    assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')
    assert.equal(getResponseHeaders(headers).get('Content-Type'), 'text/html; charset=utf-8')
  })

  it('syncs typed mutator methods to native storage', () => {
    let headers = new SuperHeaders()

    headers.accept.set('text/html')
    headers.accept.set('application/json', 0.8)
    headers.cookie.set('theme', 'dark')
    headers.vary.add('accept-encoding')

    assert.equal(headers.get('Accept'), 'text/html,application/json;q=0.8')
    assert.equal(headers.get('Cookie'), 'theme=dark')
    assert.equal(headers.get('Vary'), 'accept-encoding')
    assert.equal(getResponseHeaders(headers).get('Accept'), 'text/html,application/json;q=0.8')

    headers.accept.delete('text/html')
    assert.equal(headers.get('Accept'), 'application/json;q=0.8')

    headers.accept.clear()
    assert.equal(headers.has('Accept'), false)

    headers.acceptEncoding.set('gzip')
    assert.equal(headers.get('Accept-Encoding'), 'gzip')

    headers.acceptEncoding.delete('gzip')
    assert.equal(headers.has('Accept-Encoding'), false)

    headers.acceptLanguage.set('en-US')
    assert.equal(headers.get('Accept-Language'), 'en-us')

    headers.acceptLanguage.clear()
    assert.equal(headers.has('Accept-Language'), false)

    headers.cookie.delete('theme')
    assert.equal(headers.has('Cookie'), false)

    headers.vary.clear()
    assert.equal(headers.has('Vary'), false)
  })

  it('syncs nested array and object mutations to native storage', () => {
    let headers = new SuperHeaders()

    headers.ifMatch.tags.push('"abc"')
    assert.equal(headers.get('If-Match'), '"abc"')

    headers.ifNoneMatch.tags.push('"def"')
    assert.equal(headers.get('If-None-Match'), '"def"')

    headers.range.unit = 'bytes'
    headers.range.ranges.push({ start: 0, end: 99 })
    assert.equal(headers.get('Range'), 'bytes=0-99')

    headers.range.ranges[0].end = 199
    assert.equal(headers.get('Range'), 'bytes=0-199')
  })

  it('invalidates typed caches when standard methods mutate headers', () => {
    let headers = new SuperHeaders({ accept: 'text/html' })

    assert.equal(headers.accept.has('text/html'), true)

    headers.append('Accept', 'application/json')
    assert.equal(headers.accept.has('application/json'), true)

    headers.set('Accept', 'text/plain')
    assert.equal(headers.accept.has('text/html'), false)
    assert.equal(headers.accept.has('text/plain'), true)

    headers.delete('Accept')
    assert.equal(headers.accept.size, 0)
  })

  it('does not let stale typed values overwrite newer native values', () => {
    let headers = new SuperHeaders({ contentType: 'text/html' })
    let staleContentType = headers.contentType

    headers.set('Content-Type', 'application/json')
    staleContentType.charset = 'utf-8'

    assert.equal(headers.get('Content-Type'), 'application/json')
    assert.equal(headers.contentType.mediaType, 'application/json')
  })

  it('keeps cached typed values stable until native storage changes', () => {
    let headers = new SuperHeaders({ contentType: 'text/html' })
    let contentType = headers.contentType

    assert.equal(headers.contentType, contentType)

    contentType.charset = 'utf-8'
    assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')
    assert.equal(headers.contentType, contentType)

    headers.set('content-type', 'application/json')
    let updatedContentType = headers.contentType

    assert.notEqual(updatedContentType, contentType)
    assert.equal(updatedContentType.mediaType, 'application/json')

    contentType.boundary = 'stale'
    assert.equal(headers.get('Content-Type'), 'application/json')
  })

  it('supports scalar header accessors', () => {
    let headers = new SuperHeaders()
    let date = new Date('2021-01-01T00:00:00Z')

    headers.allow = ['GET', 'POST']
    headers.age = 42
    headers.crossOriginEmbedderPolicyReportOnly = 'require-corp'
    headers.crossOriginOpenerPolicyReportOnly = 'same-origin'
    headers.etag = 'abc123'
    headers.idempotencyKey = 'abc'
    headers.lastModified = date
    headers.permissionsPolicy = ['geolocation=()', 'camera=()']
    headers.prefer = ['respond-async', 'return=minimal']
    headers.preferenceApplied = 'return=minimal'
    headers.traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
    headers.tracestate = ['rojo=00f067aa0ba902b7', 'congo=t61rcWkgMzE']
    headers.userAgent = 'Remix'
    headers.xForwardedFor = ['203.0.113.7', '70.41.3.18']
    headers.xForwardedHost = 'example.com'
    headers.xForwardedProto = 'https'

    assert.equal(headers.get('Allow'), 'GET, POST')
    assert.equal(headers.age, 42)
    assert.equal(headers.get('Cross-Origin-Embedder-Policy-Report-Only'), 'require-corp')
    assert.equal(headers.get('Cross-Origin-Opener-Policy-Report-Only'), 'same-origin')
    assert.equal(headers.get('ETag'), '"abc123"')
    assert.equal(headers.get('Idempotency-Key'), 'abc')
    assert.equal(headers.lastModified?.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT')
    assert.equal(headers.get('Permissions-Policy'), 'geolocation=(), camera=()')
    assert.equal(headers.get('Prefer'), 'respond-async, return=minimal')
    assert.equal(headers.get('Preference-Applied'), 'return=minimal')
    assert.equal(headers.traceparent, '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00')
    assert.equal(headers.get('Tracestate'), 'rojo=00f067aa0ba902b7, congo=t61rcWkgMzE')
    assert.equal(headers.userAgent, 'Remix')
    assert.equal(headers.get('X-Forwarded-For'), '203.0.113.7, 70.41.3.18')
    assert.equal(headers.get('X-Forwarded-Host'), 'example.com')
    assert.equal(headers.get('X-Forwarded-Proto'), 'https')
  })

  it('preserves native iteration and raw stringification utilities', () => {
    let headers = new SuperHeaders({ contentType: 'text/html' })

    assert.deepEqual(Array.from(headers), [['content-type', 'text/html']])
    assert.equal(stringify(headers), 'Content-Type: text/html')
  })

  it('preserves and syncs multiple Set-Cookie values', () => {
    let headers = new SuperHeaders()

    headers.setCookie = 'session=abc'
    assert.deepEqual(headers.getSetCookie(), ['session=abc'])

    headers.setCookie.push({ name: 'theme', value: 'dark' })
    assert.deepEqual(headers.getSetCookie(), ['session=abc', 'theme=dark'])

    headers.setCookie[0].secure = true
    assert.deepEqual(headers.getSetCookie(), ['session=abc; Secure', 'theme=dark'])

    headers.setCookie[1] = { name: 'lang', value: 'en' }
    assert.deepEqual(headers.getSetCookie(), ['session=abc; Secure', 'lang=en'])

    headers.append('Set-Cookie', 'extra=1')
    assert.deepEqual(headers.getSetCookie(), ['session=abc; Secure', 'lang=en', 'extra=1'])

    headers.delete('Set-Cookie')
    assert.deepEqual(headers.getSetCookie(), [])
  })

  it('keeps Set-Cookie cache identity stable across observed mutations', () => {
    let headers = new SuperHeaders({
      setCookie: [{ name: 'session', value: 'abc' }],
    })
    let cookies = headers.setCookie

    cookies.push({ name: 'theme', value: 'dark' })

    assert.equal(headers.setCookie, cookies)
    assert.deepEqual(headers.getSetCookie(), ['session=abc', 'theme=dark'])

    headers.append('Set-Cookie', 'locale=en')

    assert.notEqual(headers.setCookie, cookies)
    assert.deepEqual(headers.getSetCookie(), ['session=abc', 'theme=dark', 'locale=en'])
  })

  it('syncs Set-Cookie element mutations reached through array helpers', () => {
    let headers = new SuperHeaders({
      setCookie: [{ name: 'session', value: 'abc' }],
    })
    let cookies = headers.setCookie

    for (let cookie of cookies) {
      cookie.secure = true
    }
    assert.deepEqual(headers.getSetCookie(), ['session=abc; Secure'])

    let cookie = cookies.at(0)
    assert.ok(cookie)
    cookie.httpOnly = true
    assert.deepEqual(headers.getSetCookie(), ['session=abc; HttpOnly; Secure'])

    cookies.forEach((cookie) => {
      cookie.path = '/'
    })
    assert.deepEqual(headers.getSetCookie(), ['session=abc; HttpOnly; Path=/; Secure'])
  })

  it('does not let stale nested or Set-Cookie values overwrite newer native values', () => {
    let headers = new SuperHeaders({
      range: { unit: 'bytes', ranges: [{ start: 0, end: 99 }] },
      setCookie: [{ name: 'session', value: 'abc' }],
    })
    let staleRange = headers.range.ranges[0]
    let staleCookies = headers.setCookie

    assert.ok(staleRange)

    headers.set('Range', 'bytes=200-299')
    headers.set('Set-Cookie', 'fresh=1')

    staleRange.end = 199
    staleCookies.push({ name: 'theme', value: 'dark' })

    assert.equal(headers.get('Range'), 'bytes=200-299')
    assert.deepEqual(headers.getSetCookie(), ['fresh=1'])
  })

  it('syncs Object.defineProperty and delete mutations on typed values', () => {
    let headers = new SuperHeaders()
    let contentType = headers.contentType

    Object.defineProperty(contentType, 'mediaType', {
      configurable: true,
      enumerable: true,
      value: 'text/html',
      writable: true,
    })
    assert.equal(headers.get('Content-Type'), 'text/html')

    Object.defineProperty(contentType, 'charset', {
      configurable: true,
      enumerable: true,
      value: 'utf-8',
      writable: true,
    })
    assert.equal(headers.get('Content-Type'), 'text/html; charset=utf-8')

    delete contentType.charset
    assert.equal(headers.get('Content-Type'), 'text/html')
  })

  it('rejects invalid date property values without clearing existing headers', () => {
    let lastModified = new Date('2021-01-01T00:00:00Z')
    let headers = new SuperHeaders({ lastModified })

    assert.throws(() => Reflect.set(headers, 'lastModified', {}), TypeError)
    assert.equal(headers.get('Last-Modified'), 'Fri, 01 Jan 2021 00:00:00 GMT')
  })

  it('does not let initializer fields shadow native Headers methods', () => {
    let headers = new SuperHeaders({
      append: 'shadow append',
      get: 'shadow get',
    })

    assert.equal(typeof headers.append, 'function')
    assert.equal(typeof headers.get, 'function')
    assert.equal(headers.get('append'), 'shadow append')
    assert.equal(headers.get('get'), 'shadow get')

    headers.append('append', 'again')
    assert.equal(headers.get('append'), 'shadow append, again')
  })

  it('keeps Set-Cookie mutations visible to Response', () => {
    let headers = new SuperHeaders({
      setCookie: [{ name: 'session', value: 'abc' }],
    })

    headers.setCookie[0].httpOnly = true
    headers.setCookie.push({ name: 'theme', value: 'dark' })

    assert.deepEqual(getResponseHeaders(headers).getSetCookie(), [
      'session=abc; HttpOnly',
      'theme=dark',
    ])
  })

  it('provides type-safe property setters', () => {
    let init: SuperHeadersInit = {
      cacheControl: { public: true },
      contentType: { mediaType: 'text/html' },
      idempotencyKey: 'abc',
      permissionsPolicy: ['fullscreen=*', 'geolocation=()'],
      setCookie: { name: 'session', value: 'abc' },
      xForwardedFor: ['203.0.113.7'],
    }
    let headers = new SuperHeaders(init)

    headers.contentType = 'application/json'
    headers.cacheControl = { private: true, maxAge: 60 }
    headers.setCookie.push({ name: 'theme', value: 'dark' })

    let contentType: ContentType = headers.contentType

    assert.equal(contentType.mediaType, 'application/json')
  })
})
