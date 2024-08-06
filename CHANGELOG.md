# `headers` CHANGELOG

## v0.5.1 - Aug 6, 2024

- Added `CookieInit` support to `headers.cookie=` setter

## v0.5.0 - Aug 6, 2024

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
