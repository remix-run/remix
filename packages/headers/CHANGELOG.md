# `headers` CHANGELOG

This is the changelog for [`headers`](https://github.com/mjackson/remix-the-web/tree/main/packages/headers). It follows [semantic versioning](https://semver.org/).

## v0.11.0 (2025-06-06)

- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.10.0 (2025-01-27)

This release contains several improvements to `Cookie` that bring it more in line with other headers like `Accept`, `AcceptEncoding`, and `AcceptLanguage`.

- BREAKING CHANGE: `cookie.names()` and `cookie.values()` are now getters that return `string[]` instead of methods that return `IterableIterator<string>`
- BREAKING CHANGE: `cookie.forEach()` calls its callback with `(name, value, cookie)` instead of `(value, name, map)`
- BREAKING CHANGE: `cookie.delete(name)` returns `void` instead of `boolean`

```ts
// before
let cookieNames = Array.from(headers.cookie.names());

// after
let cookieNames = headers.cookie.names;
```

Additionally, this release adds support for the `If-None-Match` header. This is useful for conditional GET requests where you want to return a response with content only if the ETag has changed.

```ts
import { SuperHeaders } from '@mjackson/headers';

function requestHandler(request: Request): Promise<Response> {
  let response = await callDownstreamService(request);

  if (request.method === 'GET' && response.headers.has('ETag')) {
    let headers = new SuperHeaders(request.headers);
    if (headers.ifNoneMatch.matches(response.headers.get('ETag'))) {
      return new Response(null, { status: 304 });
    }
  }

  return response;
}
```

## v0.9.0 (2024-12-20)

This release tightens up the type safety and brings `SuperHeaders` more in line with the built-in `Headers` interface.

- BREAKING CHANGE: The mutation methods `headers.set()` and `headers.append()` no longer accept anything other than a string as the 2nd arg. This follows the native `Headers` interface more closely.

```ts
// before
let headers = new SuperHeaders();
headers.set('Content-Type', { mediaType: 'text/html' });

// after
headers.set('Content-Type', 'text/html');

// if you need the previous behavior, use the setter instead of set()
headers.contentType = { mediaType: 'text/html' };
```

Similarly, the constructor no longer accepts non-string values in an array init value.

```ts
// before
let headers = new SuperHeaders([['Content-Type', { mediaType: 'text/html' }]]);

// if you need the previous behavior, use the object init instead
let headers = new SuperHeaders({ contentType: { mediaType: 'text/html' } });
```

- BREAKING CHANGE: `headers.get()` returns `null` for uninitialized custom header values instead of `undefined`. This follows the native `Headers` interface more closely.

```ts
// before
let headers = new SuperHeaders();
headers.get('Host'); // null
headers.get('Content-Type'); // undefined

// after
headers.get('Host'); // null
headers.get('Content-Type'); // null
```

- BREAKING CHANGE: Removed ability to initialize `AcceptLanguage` with `undefined` weight values.

```ts
// before
let h1 = new AcceptLanguage({ 'en-US': undefined });
let h2 = new AcceptLanguage([['en-US', undefined]]);

// after
let h3 = new AcceptLanguage({ 'en-US': 1 });
```

- All setters now also accept `undefined | null` in addition to `string` and custom object values. Setting a header to `undefined | null` is the same as using `headers.delete()`.

```ts
let headers = new SuperHeaders({ contentType: 'text/html' });
headers.get('Content-Type'); // 'text/html'

headers.contentType = null; // same as headers.delete('Content-Type');
headers.get('Content-Type'); // null
```

- Allow setting date headers (`date`, `expires`, `ifModifiedSince`, `ifUnmodifiedSince`, and `lastModified`) using numbers.

```ts
let ms = new Date().getTime();
let headers = new SuperHeaders({ lastModified: ms });
headers.date = ms;
```

- Added `AcceptLanguage.prototype.accepts(language)`, `AcceptLanguage.prototype.getWeight(language)`,
  `AcceptLanguage.prototype.getPreferred(languages)`

```ts
import { AcceptLanguage } from '@mjackson/headers';

let header = new AcceptLanguage({ 'en-US': 1, en: 0.9 });

header.accepts('en-US'); // true
header.accepts('en-GB'); // true
header.accepts('en'); // true
header.accepts('fr'); // false

header.getWeight('en-US'); // 1
header.getWeight('en-GB'); // 0.9

header.getPreferred(['en-GB', 'en-US']); // 'en-US'
```

- Added `Accept` support

```ts
import { Accept } from '@mjackson/headers';

let header = new Accept({ 'text/html': 1, 'text/*': 0.9 });

header.accepts('text/html'); // true
header.accepts('text/plain'); // true
header.accepts('text/*'); // true
header.accepts('image/jpeg'); // false

header.getWeight('text/html'); // 1
header.getWeight('text/plain'); // 0.9

header.getPreferred(['text/html', 'text/plain']); // 'text/html'
```

- Added `Accept-Encoding` support

```ts
import { AcceptEncoding } from '@mjackson/headers';

let header = new AcceptEncoding({ gzip: 1, deflate: 0.9 });

header.accepts('gzip'); // true
header.accepts('deflate'); // true
header.accepts('identity'); // true
header.accepts('br'); // false

header.getWeight('gzip'); // 1
header.getWeight('deflate'); // 0.9

header.getPreferred(['gzip', 'deflate']); // 'gzip'
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

- Added support for the `Accept-Language` header (https://github.com/mjackson/remix-the-web/pull/8, thanks [@ArnoSaine](https://github.com/ArnoSaine))

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
});
```

- Changed package name from `fetch-super-headers` to `@mjackson/headers`. Eventual goal is to get the `headers` npm package name.
