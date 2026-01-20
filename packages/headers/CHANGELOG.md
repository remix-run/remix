# `headers` CHANGELOG

This is the changelog for [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers). It follows [semantic versioning](https://semver.org/).

## v0.19.0

### Minor Changes

- BREAKING CHANGE: Removed `Headers`/`SuperHeaders` class and default export. Use the native `Headers` class with the static `from()` method on each header class instead.

  New individual header `.from()` methods:

  - `Accept.from()`
  - `AcceptEncoding.from()`
  - `AcceptLanguage.from()`
  - `CacheControl.from()`
  - `ContentDisposition.from()`
  - `ContentRange.from()`
  - `ContentType.from()`
  - `Cookie.from()`
  - `IfMatch.from()`
  - `IfNoneMatch.from()`
  - `IfRange.from()`
  - `Range.from()`
  - `SetCookie.from()`
  - `Vary.from()`

  New raw header utilities added:

  - `parse()`
  - `stringify()`

  Migration example:

  ```ts
  // Before:
  import SuperHeaders from '@remix-run/headers'
  let headers = new SuperHeaders(request.headers)
  let mediaType = headers.contentType.mediaType

  // After:
  import { ContentType } from '@remix-run/headers'
  let contentType = ContentType.from(request.headers.get('content-type'))
  let mediaType = contentType.mediaType
  ```

  If you were using the `Headers` constructor to parse raw HTTP header strings, use `parse()` instead:

  ```ts
  // Before:
  import SuperHeaders from '@remix-run/headers'
  let headers = new SuperHeaders('Content-Type: text/html\r\nCache-Control: no-cache')

  // After:
  import { parse } from '@remix-run/headers'
  let headers = parse('Content-Type: text/html\r\nCache-Control: no-cache')
  ```

  If you were using `headers.toString()` to convert headers to raw format, use `stringify()` instead:

  ```ts
  // Before:
  import SuperHeaders from '@remix-run/headers'
  let headers = new SuperHeaders()
  headers.set('Content-Type', 'text/html')
  let rawHeaders = headers.toString()

  // After:
  import { stringify } from '@remix-run/headers'
  let headers = new Headers()
  headers.set('Content-Type', 'text/html')
  let rawHeaders = stringify(headers)
  ```

## v0.18.0 (2025-11-25)

- Add `Vary` support

```ts
import { Vary } from '@remix-run/headers'

let header = new Vary('Accept-Encoding')
header.add('Accept-Language')
header.headerNames // ['accept-encoding', 'accept-language']
header.toString() // 'accept-encoding, accept-language'
```

- `Accept.getPreferred()`, `AcceptEncoding.getPreferred()`, and `AcceptLanguage.getPreferred()` are now generic, preserving the union type of the input array in the return type

## v0.17.2 (2025-11-25)

- Fix `secure` property type in `SetCookie` to accept `boolean` instead of only `true`, making it consistent with `httpOnly` and `partitioned`

## v0.17.1 (2025-11-21)

- Fix bug where `Max-Age=0` did not show up in `SetCookie` header

## v0.17.0 (2025-11-18)

- Add `Range` support

```ts
import { Range } from '@remix-run/headers'

let header = new Range({ unit: 'bytes', ranges: [{ start: 0, end: 999 }] })
header.toString() // "bytes=0-999"

// Parse from string
let header = new Range('bytes=0-999,2000-2999')
header.ranges // [{ start: 0, end: 999 }, { start: 2000, end: 2999 }]

// Check if range is satisfiable for a given file size
header.isSatisfiable(5000) // true

// Normalize ranges to concrete start/end values for a given file size
let header = new Range('bytes=0-')
header.normalize(5000) // [{ start: 0, end: 4999 }]
```

- Add `Content-Range` support

```ts
import { ContentRange } from '@remix-run/headers'

let header = new ContentRange({
  unit: 'bytes',
  start: 0,
  end: 999,
  size: 5000,
})
header.toString() // "bytes 0-999/5000"

// Parse from string
let header = new ContentRange('bytes 200-1000/67589')
header.start // 200
header.end // 1000
header.size // 67589
```

- Add `If-Match` support

```ts
import { IfMatch } from '@remix-run/headers'

let header = new IfMatch(['"abc123"', '"def456"'])
header.has('"abc123"') // true

// Check if precondition passes
header.matches('"abc123"') // true
header.matches('"xyz789"') // false
header.matches('W/"abc123"') // false (weak ETags never match)
```

- Add `If-Range` support

```ts
import { IfRange } from '@remix-run/headers'

// With ETag
let header = new IfRange('"abc123"')
header.matches({ etag: '"abc123"' }) // true
header.matches({ etag: 'W/"abc123"' }) // false (weak ETags never match)

// With Last-Modified date
let header = new IfRange(new Date('2025-10-21T07:28:00Z'))
header.matches({ lastModified: new Date('2025-10-21T07:28:00Z') }) // true
```

- Add `Allow` support

```ts
import { SuperHeaders } from '@remix-run/headers'

let headers = new SuperHeaders({ allow: ['GET', 'POST', 'OPTIONS'] })
headers.get('Allow') // "GET, POST, OPTIONS"
```

## v0.16.0 (2025-11-05)

- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.15.0 (2025-11-04)

- Add support for `httpOnly: false` in `SetCookie` constructor
- Export `CookieProperties` type with all cookie properties
- Add `Partitioned` support to `SetCookie`

## v0.14.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v0.13.0 (2025-10-04)

- Drop support for TypeScript < 5.7

## v0.12.0 (2025-07-18)

- Rename package from `@mjackson/headers` to `@remix-run/headers`

## v0.11.1 (2025-06-06)

- Do not minify builds
- Remove some test files from the build

## v0.11.0 (2025-06-06)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.10.0 (2025-01-27)

This release contains several improvements to `Cookie` that bring it more in line with other headers like `Accept`, `AcceptEncoding`, and `AcceptLanguage`.

- BREAKING CHANGE: `cookie.names()` and `cookie.values()` are now getters that return `string[]` instead of methods that return `IterableIterator<string>`
- BREAKING CHANGE: `cookie.forEach()` calls its callback with `(name, value, cookie)` instead of `(value, name, map)`
- BREAKING CHANGE: `cookie.delete(name)` returns `void` instead of `boolean`

```ts
// before
let cookieNames = Array.from(headers.cookie.names())

// after
let cookieNames = headers.cookie.names
```

Additionally, this release adds support for the `If-None-Match` header. This is useful for conditional GET requests where you want to return a response with content only if the ETag has changed.

```ts
import { SuperHeaders } from '@remix-run/headers'

function requestHandler(request: Request): Promise<Response> {
  let response = await callDownstreamService(request)

  if (request.method === 'GET' && response.headers.has('ETag')) {
    let headers = new SuperHeaders(request.headers)
    if (headers.ifNoneMatch.matches(response.headers.get('ETag'))) {
      return new Response(null, { status: 304 })
    }
  }

  return response
}
```

## v0.9.0 (2024-12-20)

This release tightens up the type safety and brings `SuperHeaders` more in line with the built-in `Headers` interface.

- BREAKING CHANGE: The mutation methods `headers.set()` and `headers.append()` no longer accept anything other than a string as the 2nd arg. This follows the native `Headers` interface more closely.

```ts
// before
let headers = new SuperHeaders()
headers.set('Content-Type', { mediaType: 'text/html' })

// after
headers.set('Content-Type', 'text/html')

// if you need the previous behavior, use the setter instead of set()
headers.contentType = { mediaType: 'text/html' }
```

Similarly, the constructor no longer accepts non-string values in an array init value.

```ts
// before
let headers = new SuperHeaders([['Content-Type', { mediaType: 'text/html' }]])

// if you need the previous behavior, use the object init instead
let headers = new SuperHeaders({ contentType: { mediaType: 'text/html' } })
```

- BREAKING CHANGE: `headers.get()` returns `null` for uninitialized custom header values instead of `undefined`. This follows the native `Headers` interface more closely.

```ts
// before
let headers = new SuperHeaders()
headers.get('Host') // null
headers.get('Content-Type') // undefined

// after
headers.get('Host') // null
headers.get('Content-Type') // null
```

- BREAKING CHANGE: Removed ability to initialize `AcceptLanguage` with `undefined` weight values.

```ts
// before
let h1 = new AcceptLanguage({ 'en-US': undefined })
let h2 = new AcceptLanguage([['en-US', undefined]])

// after
let h3 = new AcceptLanguage({ 'en-US': 1 })
```

- All setters now also accept `undefined | null` in addition to `string` and custom object values. Setting a header to `undefined | null` is the same as using `headers.delete()`.

```ts
let headers = new SuperHeaders({ contentType: 'text/html' })
headers.get('Content-Type') // 'text/html'

headers.contentType = null // same as headers.delete('Content-Type');
headers.get('Content-Type') // null
```

- Allow setting date headers (`date`, `expires`, `ifModifiedSince`, `ifUnmodifiedSince`, and `lastModified`) using numbers.

```ts
let ms = new Date().getTime()
let headers = new SuperHeaders({ lastModified: ms })
headers.date = ms
```

- Added `AcceptLanguage.prototype.accepts(language)`, `AcceptLanguage.prototype.getWeight(language)`,
  `AcceptLanguage.prototype.getPreferred(languages)`

```ts
import { AcceptLanguage } from '@remix-run/headers'

let header = new AcceptLanguage({ 'en-US': 1, en: 0.9 })

header.accepts('en-US') // true
header.accepts('en-GB') // true
header.accepts('en') // true
header.accepts('fr') // false

header.getWeight('en-US') // 1
header.getWeight('en-GB') // 0.9

header.getPreferred(['en-GB', 'en-US']) // 'en-US'
```

- Added `Accept` support

```ts
import { Accept } from '@remix-run/headers'

let header = new Accept({ 'text/html': 1, 'text/*': 0.9 })

header.accepts('text/html') // true
header.accepts('text/plain') // true
header.accepts('text/*') // true
header.accepts('image/jpeg') // false

header.getWeight('text/html') // 1
header.getWeight('text/plain') // 0.9

header.getPreferred(['text/html', 'text/plain']) // 'text/html'
```

- Added `Accept-Encoding` support

```ts
import { AcceptEncoding } from '@remix-run/headers'

let header = new AcceptEncoding({ gzip: 1, deflate: 0.9 })

header.accepts('gzip') // true
header.accepts('deflate') // true
header.accepts('identity') // true
header.accepts('br') // false

header.getWeight('gzip') // 1
header.getWeight('deflate') // 0.9

header.getPreferred(['gzip', 'deflate']) // 'gzip'
```

- Added `SuperHeaders.prototype` (getters and setters) for:
  - `accept`
  - `acceptEncoding`
  - `acceptRanges`
  - `connection`
  - `contentEncoding`
  - `contentLanguage`
  - `etag`
  - `host`
  - `location`
  - `referer`

## v0.8.0 (2024-11-14)

- Added CommonJS build

## 0.7.2 (2024-08-29)

- Treat `Headers` as iterable in the constructor

## v0.7.1 (2024-08-28)

- Added `string` init type to `new Headers({ acceptLanguage })`

## v0.7.0 (2024-08-27)

- Added support for the `Accept-Language` header (https://github.com/remix-run/remix/pull/8, thanks [@ArnoSaine](https://github.com/ArnoSaine))

## v0.6.1 (2024-08-13)

- Associate `CacheControl` doc comments with the class instead of the constructor function

## v0.6.0 (2024-08-13)

- Added support for `Cache-Control` header (https://github.com/mjackson/headers/pull/7, thanks [@alexanderson1993](https://github.com/alexanderson1993))

## v0.5.1 (2024-08-6)

- Added `CookieInit` support to `headers.cookie=` setter

## v0.5.0 (2024-08-6)

- Added the ability to initialize a `SuperHeaders` instance with object config instead of just strings or header object instances.

```ts
let headers = new Headers({
  contentType: { mediaType: 'text/html' },
  cookies: [
    ['session_id', 'abc'],
    ['theme', 'dark'],
  ],
})
```

- Changed package name from `fetch-super-headers` to `@remix-run/headers`. Eventual goal is to get the `headers` npm package name.
