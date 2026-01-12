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
