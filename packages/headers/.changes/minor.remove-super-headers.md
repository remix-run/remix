BREAKING CHANGE: Removed `Headers`/`SuperHeaders` class and default export. Use the native `Headers` class with the static `from()` method on each header class instead.

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

- `parseRawHeaders()`
- `stringifyRawHeaders()`

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

If you were using the `Headers` constructor to parse raw HTTP header strings, use `parseRawHeaders()` instead:

```ts
// Before:
import SuperHeaders from '@remix-run/headers'
let headers = new SuperHeaders('Content-Type: text/html\r\nCache-Control: no-cache')

// After:
import { parseRawHeaders } from '@remix-run/headers'
let headers = parseRawHeaders('Content-Type: text/html\r\nCache-Control: no-cache')
```

If you were using `headers.toString()` to convert headers to raw format, use `stringifyRawHeaders()` instead:

```ts
// Before:
import SuperHeaders from '@remix-run/headers'
let headers = new SuperHeaders()
headers.set('Content-Type', 'text/html')
let raw = headers.toString()

// After:
import { stringifyRawHeaders } from '@remix-run/headers'
let headers = new Headers()
headers.set('Content-Type', 'text/html')
let raw = stringifyRawHeaders(headers)
```
