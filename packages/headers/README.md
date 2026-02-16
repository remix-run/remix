# headers

Typed utilities for parsing, manipulating, and serializing HTTP header values. `headers` provides focused classes for common HTTP headers.

## Features

- **Header-Specific Classes** - Purpose-built APIs for `Accept`, `Cache-Control`, `Content-Type`, and more
- **Round-Trip Safety** - Parse from raw values and serialize back with `.toString()`
- **Typed Operations** - Work with structured values instead of manual string parsing

## Installation

```sh
npm i remix
```

## Individual Header Utilities

Each supported header has a class that represents the header value. Use the static `from()` method to parse header values. Each class has a `toString()` method that returns the header value as a string, which you can either call manually, or will be called automatically when the header class is used in a context that expects a string.

The following headers are currently supported:

- [Accept](./README.md#accept)
- [Accept-Encoding](./README.md#accept-encoding)
- [Accept-Language](./README.md#accept-language)
- [Cache-Control](./README.md#cache-control)
- [Content-Disposition](./README.md#content-disposition)
- [Content-Range](./README.md#content-range)
- [Content-Type](./README.md#content-type)
- [Cookie](./README.md#cookie)
- [If-Match](./README.md#if-match)
- [If-None-Match](./README.md#if-none-match)
- [If-Range](./README.md#if-range)
- [Range](./README.md#range)
- [Set-Cookie](./README.md#set-cookie)
- [Vary](./README.md#vary)

### Accept

Parse, manipulate and stringify [`Accept` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept).

Implements `Map<mediaType, quality>`.

```ts
import { Accept } from 'remix/headers'

// Parse from headers
let accept = Accept.from(request.headers.get('accept'))

accept.mediaTypes // ['text/html', 'text/*']
accept.weights // [1, 0.9]
accept.accepts('text/html') // true
accept.accepts('text/plain') // true (matches text/*)
accept.accepts('image/jpeg') // false
accept.getWeight('text/plain') // 1 (matches text/*)
accept.getPreferred(['text/html', 'text/plain']) // 'text/html'

// Iterate
for (let [mediaType, quality] of accept) {
  // ...
}

// Modify and set header
accept.set('application/json', 0.8)
accept.delete('text/*')
headers.set('Accept', accept)

// Construct directly
new Accept('text/html, text/*;q=0.9')
new Accept({ 'text/html': 1, 'text/*': 0.9 })
new Accept(['text/html', ['text/*', 0.9]])

// Use class for type safety when setting Headers values
// via Accept's `.toString()` method
let headers = new Headers({
  Accept: new Accept({ 'text/html': 1, 'application/json': 0.8 }),
})
headers.set('Accept', new Accept({ 'text/html': 1, 'application/json': 0.8 }))
```

### Accept-Encoding

Parse, manipulate and stringify [`Accept-Encoding` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Encoding).

Implements `Map<encoding, quality>`.

```ts
import { AcceptEncoding } from 'remix/headers'

// Parse from headers
let acceptEncoding = AcceptEncoding.from(request.headers.get('accept-encoding'))

acceptEncoding.encodings // ['gzip', 'deflate']
acceptEncoding.weights // [1, 0.8]
acceptEncoding.accepts('gzip') // true
acceptEncoding.accepts('br') // false
acceptEncoding.getWeight('gzip') // 1
acceptEncoding.getPreferred(['gzip', 'deflate', 'br']) // 'gzip'

// Modify and set header
acceptEncoding.set('br', 1)
acceptEncoding.delete('deflate')
headers.set('Accept-Encoding', acceptEncoding)

// Construct directly
new AcceptEncoding('gzip, deflate;q=0.8')
new AcceptEncoding({ gzip: 1, deflate: 0.8 })

// Use class for type safety when setting Headers values
// via AcceptEncoding's `.toString()` method
let headers = new Headers({
  'Accept-Encoding': new AcceptEncoding({ gzip: 1, br: 0.9 }),
})
headers.set('Accept-Encoding', new AcceptEncoding({ gzip: 1, br: 0.9 }))
```

### Accept-Language

Parse, manipulate and stringify [`Accept-Language` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Language).

Implements `Map<language, quality>`.

```ts
import { AcceptLanguage } from 'remix/headers'

// Parse from headers
let acceptLanguage = AcceptLanguage.from(request.headers.get('accept-language'))

acceptLanguage.languages // ['en-us', 'en']
acceptLanguage.weights // [1, 0.9]
acceptLanguage.accepts('en-US') // true
acceptLanguage.accepts('en-GB') // true (matches en)
acceptLanguage.getWeight('en-GB') // 1 (matches en)
acceptLanguage.getPreferred(['en-US', 'en-GB', 'fr']) // 'en-US'

// Modify and set header
acceptLanguage.set('fr', 0.5)
acceptLanguage.delete('en')
headers.set('Accept-Language', acceptLanguage)

// Construct directly
new AcceptLanguage('en-US, en;q=0.9')
new AcceptLanguage({ 'en-US': 1, en: 0.9 })

// Use class for type safety when setting Headers values
// via AcceptLanguage's `.toString()` method
let headers = new Headers({
  'Accept-Language': new AcceptLanguage({ 'en-US': 1, fr: 0.5 }),
})
headers.set('Accept-Language', new AcceptLanguage({ 'en-US': 1, fr: 0.5 }))
```

### Cache-Control

Parse, manipulate and stringify [`Cache-Control` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control).

```ts
import { CacheControl } from 'remix/headers'

// Parse from headers
let cacheControl = CacheControl.from(response.headers.get('cache-control'))

cacheControl.public // true
cacheControl.maxAge // 3600
cacheControl.sMaxage // 7200
cacheControl.noCache // undefined
cacheControl.noStore // undefined
cacheControl.noTransform // undefined
cacheControl.mustRevalidate // undefined
cacheControl.immutable // undefined

// Modify and set header
cacheControl.maxAge = 7200
cacheControl.immutable = true
headers.set('Cache-Control', cacheControl)

// Construct directly
new CacheControl('public, max-age=3600')
new CacheControl({ public: true, maxAge: 3600 })

// Use class for type safety when setting Headers values
// via CacheControl's `.toString()` method
let headers = new Headers({
  'Cache-Control': new CacheControl({ public: true, maxAge: 3600 }),
})
headers.set('Cache-Control', new CacheControl({ public: true, maxAge: 3600 }))
```

### Content-Disposition

Parse, manipulate and stringify [`Content-Disposition` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition).

```ts
import { ContentDisposition } from 'remix/headers'

// Parse from headers
let contentDisposition = ContentDisposition.from(response.headers.get('content-disposition'))

contentDisposition.type // 'attachment'
contentDisposition.filename // 'example.pdf'
contentDisposition.filenameSplat // "UTF-8''%E4%BE%8B%E5%AD%90.pdf"
contentDisposition.preferredFilename // '例子.pdf' (decoded from filename*)

// Modify and set header
contentDisposition.filename = 'download.pdf'
headers.set('Content-Disposition', contentDisposition)

// Construct directly
new ContentDisposition('attachment; filename="example.pdf"')
new ContentDisposition({ type: 'attachment', filename: 'example.pdf' })

// Use class for type safety when setting Headers values
// via ContentDisposition's `.toString()` method
let headers = new Headers({
  'Content-Disposition': new ContentDisposition({ type: 'attachment', filename: 'example.pdf' }),
})
headers.set(
  'Content-Disposition',
  new ContentDisposition({ type: 'attachment', filename: 'example.pdf' }),
)
```

### Content-Range

Parse, manipulate and stringify [`Content-Range` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range).

```ts
import { ContentRange } from 'remix/headers'

// Parse from headers
let contentRange = ContentRange.from(response.headers.get('content-range'))

contentRange.unit // "bytes"
contentRange.start // 200
contentRange.end // 1000
contentRange.size // 67589

// Unsatisfied range
let unsatisfied = ContentRange.from('bytes */67589')
unsatisfied.start // null
unsatisfied.end // null
unsatisfied.size // 67589

// Construct directly
new ContentRange({ unit: 'bytes', start: 0, end: 499, size: 1000 })

// Use class for type safety when setting Headers values
// via ContentRange's `.toString()` method
let headers = new Headers({
  'Content-Range': new ContentRange({ unit: 'bytes', start: 0, end: 499, size: 1000 }),
})
headers.set('Content-Range', new ContentRange({ unit: 'bytes', start: 0, end: 499, size: 1000 }))
```

### Content-Type

Parse, manipulate and stringify [`Content-Type` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type).

```ts
import { ContentType } from 'remix/headers'

// Parse from headers
let contentType = ContentType.from(request.headers.get('content-type'))

contentType.mediaType // "text/html"
contentType.charset // "utf-8"
contentType.boundary // undefined (or boundary string for multipart)

// Modify and set header
contentType.charset = 'iso-8859-1'
headers.set('Content-Type', contentType)

// Construct directly
new ContentType('text/html; charset=utf-8')
new ContentType({ mediaType: 'text/html', charset: 'utf-8' })

// Use class for type safety when setting Headers values
// via ContentType's `.toString()` method
let headers = new Headers({
  'Content-Type': new ContentType({ mediaType: 'text/html', charset: 'utf-8' }),
})
headers.set('Content-Type', new ContentType({ mediaType: 'text/html', charset: 'utf-8' }))
```

### Cookie

Parse, manipulate and stringify [`Cookie` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cookie).

Implements `Map<name, value>`.

```ts
import { Cookie } from 'remix/headers'

// Parse from headers
let cookie = Cookie.from(request.headers.get('cookie'))

cookie.get('session_id') // 'abc123'
cookie.get('theme') // 'dark'
cookie.has('session_id') // true
cookie.size // 2

// Iterate
for (let [name, value] of cookie) {
  // ...
}

// Modify and set header
cookie.set('theme', 'light')
cookie.delete('session_id')
headers.set('Cookie', cookie)

// Construct directly
new Cookie('session_id=abc123; theme=dark')
new Cookie({ session_id: 'abc123', theme: 'dark' })
new Cookie([
  ['session_id', 'abc123'],
  ['theme', 'dark'],
])

// Use class for type safety when setting Headers values
// via Cookie's `.toString()` method
let headers = new Headers({
  Cookie: new Cookie({ session_id: 'abc123', theme: 'dark' }),
})
headers.set('Cookie', new Cookie({ session_id: 'abc123', theme: 'dark' }))
```

### If-Match

Parse, manipulate and stringify [`If-Match` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match).

Implements `Set<etag>`.

```ts
import { IfMatch } from 'remix/headers'

// Parse from headers
let ifMatch = IfMatch.from(request.headers.get('if-match'))

ifMatch.tags // ['"67ab43"', '"54ed21"']
ifMatch.has('"67ab43"') // true
ifMatch.matches('"67ab43"') // true (checks precondition)
ifMatch.matches('"abc123"') // false

// Note: Uses strong comparison only (weak ETags never match)
let weak = IfMatch.from('W/"67ab43"')
weak.matches('W/"67ab43"') // false

// Modify and set header
ifMatch.add('"newetag"')
ifMatch.delete('"67ab43"')
headers.set('If-Match', ifMatch)

// Construct directly
new IfMatch(['abc123', 'def456'])

// Use class for type safety when setting Headers values
// via IfMatch's `.toString()` method
let headers = new Headers({
  'If-Match': new IfMatch(['"abc123"', '"def456"']),
})
headers.set('If-Match', new IfMatch(['"abc123"', '"def456"']))
```

### If-None-Match

Parse, manipulate and stringify [`If-None-Match` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match).

Implements `Set<etag>`.

```ts
import { IfNoneMatch } from 'remix/headers'

// Parse from headers
let ifNoneMatch = IfNoneMatch.from(request.headers.get('if-none-match'))

ifNoneMatch.tags // ['"67ab43"', '"54ed21"']
ifNoneMatch.has('"67ab43"') // true
ifNoneMatch.matches('"67ab43"') // true

// Supports weak comparison (unlike If-Match)
let weak = IfNoneMatch.from('W/"67ab43"')
weak.matches('W/"67ab43"') // true

// Modify and set header
ifNoneMatch.add('"newetag"')
ifNoneMatch.delete('"67ab43"')
headers.set('If-None-Match', ifNoneMatch)

// Construct directly
new IfNoneMatch(['abc123'])

// Use class for type safety when setting Headers values
// via IfNoneMatch's `.toString()` method
let headers = new Headers({
  'If-None-Match': new IfNoneMatch(['"abc123"']),
})
headers.set('If-None-Match', new IfNoneMatch(['"abc123"']))
```

### If-Range

Parse, manipulate and stringify [`If-Range` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Range).

```ts
import { IfRange } from 'remix/headers'

// Parse from headers
let ifRange = IfRange.from(request.headers.get('if-range'))

// With HTTP date
ifRange.matches({ lastModified: 1609459200000 }) // true
ifRange.matches({ lastModified: new Date('2021-01-01') }) // true

// With ETag
let etagHeader = IfRange.from('"67ab43"')
etagHeader.matches({ etag: '"67ab43"' }) // true

// Empty/null returns empty instance (range proceeds unconditionally)
let empty = IfRange.from(null)
empty.matches({ etag: '"any"' }) // true

// Construct directly
new IfRange('"abc123"')

// Use class for type safety when setting Headers values
// via IfRange's `.toString()` method
let headers = new Headers({
  'If-Range': new IfRange('"abc123"'),
})
headers.set('If-Range', new IfRange('"abc123"'))
```

### Range

Parse, manipulate and stringify [`Range` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Range).

```ts
import { Range } from 'remix/headers'

// Parse from headers
let range = Range.from(request.headers.get('range'))

range.unit // "bytes"
range.ranges // [{ start: 200, end: 1000 }]
range.canSatisfy(2000) // true
range.canSatisfy(500) // false
range.normalize(2000) // [{ start: 200, end: 1000 }]

// Multiple ranges
let multi = Range.from('bytes=0-499, 1000-1499')
multi.ranges.length // 2

// Suffix range (last N bytes)
let suffix = Range.from('bytes=-500')
suffix.normalize(2000) // [{ start: 1500, end: 1999 }]

// Construct directly
new Range({ unit: 'bytes', ranges: [{ start: 0, end: 999 }] })

// Use class for type safety when setting Headers values
// via Range's `.toString()` method
let headers = new Headers({
  Range: new Range({ unit: 'bytes', ranges: [{ start: 0, end: 999 }] }),
})
headers.set('Range', new Range({ unit: 'bytes', ranges: [{ start: 0, end: 999 }] }))
```

### Set-Cookie

Parse, manipulate and stringify [`Set-Cookie` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie).

```ts
import { SetCookie } from 'remix/headers'

// Parse from headers
let setCookie = SetCookie.from(response.headers.get('set-cookie'))

setCookie.name // "session_id"
setCookie.value // "abc"
setCookie.path // "/"
setCookie.httpOnly // true
setCookie.secure // true
setCookie.domain // undefined
setCookie.maxAge // undefined
setCookie.expires // undefined
setCookie.sameSite // undefined

// Modify and set header
setCookie.maxAge = 3600
setCookie.sameSite = 'Strict'
headers.set('Set-Cookie', setCookie)

// Construct directly
new SetCookie('session_id=abc; Path=/; HttpOnly; Secure')
new SetCookie({
  name: 'session_id',
  value: 'abc',
  path: '/',
  httpOnly: true,
  secure: true,
})

// Use class for type safety when setting Headers values
// via SetCookie's `.toString()` method
let headers = new Headers({
  'Set-Cookie': new SetCookie({ name: 'session_id', value: 'abc', httpOnly: true }),
})
headers.set('Set-Cookie', new SetCookie({ name: 'session_id', value: 'abc', httpOnly: true }))
```

### Vary

Parse, manipulate and stringify [`Vary` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Vary).

Implements `Set<headerName>`.

```ts
import { Vary } from 'remix/headers'

// Parse from headers
let vary = Vary.from(response.headers.get('vary'))

vary.headerNames // ['accept-encoding', 'accept-language']
vary.has('Accept-Encoding') // true (case-insensitive)
vary.size // 2

// Modify and set header
vary.add('User-Agent')
vary.delete('Accept-Language')
headers.set('Vary', vary)

// Construct directly
new Vary('Accept-Encoding, Accept-Language')
new Vary(['Accept-Encoding', 'Accept-Language'])
new Vary({ headerNames: ['Accept-Encoding', 'Accept-Language'] })

// Use class for type safety when setting Headers values
// via Vary's `.toString()` method
let headers = new Headers({
  Vary: new Vary(['Accept-Encoding', 'Accept-Language']),
})
headers.set('Vary', new Vary(['Accept-Encoding', 'Accept-Language']))
```

## Raw Headers

Parse and stringify raw HTTP header strings.

```ts
import { parse, stringify } from 'remix/headers'

let headers = parse('Content-Type: text/html\r\nCache-Control: no-cache')
headers.get('content-type') // 'text/html'
headers.get('cache-control') // 'no-cache'

stringify(headers)
// 'Content-Type: text/html\r\nCache-Control: no-cache'
```

## Related Packages

- [`fetch-proxy`](https://github.com/remix-run/remix/tree/main/packages/fetch-proxy) - Build HTTP proxy servers using the web fetch API
- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Build HTTP servers on Node.js using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
