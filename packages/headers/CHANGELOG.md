# `headers` CHANGELOG

This is the changelog for [`headers`](https://github.com/mjackson/remix-the-web/tree/main/packages/headers). It follows [semantic versioning](https://semver.org/).

## HEAD

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

- BREAKING CHANGE: `headers.set()` no longer accepts anything other than a string as the 2nd arg. This follows the native `Headers` interface more closely.

```ts
// before
let headers = new SuperHeaders();
headers.set('Content-Type', { mediaType: 'text/html' });

// after
headers.set('Content-Type', 'text/html');

// if you need the previous behavior, use the setter instead of set()
headers.contentType = { mediaType: 'text/html' };
```

- All setter methods now also accept `undefined | null` in addition to `string` and custom object values. Setting a header to `undefined | null` is the same as using `headers.delete()`.

```ts
// before
let headers = new SuperHeaders({ 'Content-Type': 'text/html' });
headers.contentType; // 'text/html'

headers.contentType = null; // same as headers.delete('Content-Type');
headers.contentType; // null
```

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
