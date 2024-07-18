# fetch-super-headers

`SuperHeaders` is an enhanced JavaScript `Headers` interface with type-safe access.

Another way to think about it is a spec-compliant, type-safe way to parse, modify, and stringify various HTTP headers and collections of them.

## Features

This package is a suite of tools that make it a little more fun to work with `Headers`.

- Strongly typed header-specific getters and setters (e.g., `headers.contentType`, `headers.setCookie`, etc.)
- Easy parsing and manipulation of complex headers like `Content-Disposition`, `Content-Type`, `Set-Cookie`, and more
- Iterable interface for easy header enumeration
- Convenient string conversion for HTTP message parsing and assembly
- Extends [the standard `Headers` class](https://developer.mozilla.org/en-US/docs/Web/API/Headers), so all `Headers` methods work as you'd expect

## Installation

```sh
$ npm install fetch-super-headers
```

## Usage

fetch-super-headers is an enhanced interface for `Headers`, with some additions that make working with HTTP headers feel a lot more like working with JavaScript objects.

```ts
import SuperHeaders from 'fetch-super-headers';
// or, if you don't mind clobbering the global `Headers` reference:
// import Headers from `fetch-super-headers';

let headers = new SuperHeaders();

// Content-Type
headers.contentType = 'application/json; charset=utf-8';

console.log(headers.contentType.mediaType); // 'application/json'
console.log(headers.contentType.charset); // 'utf-8'

headers.contentType.charset = 'iso-8859-1';

// SuperHeaders *extends* Headers, so all methods of Headers work just
// as you'd expect them to.
console.log(headers.get('Content-Type')); // 'application/json; charset=iso-8859-1'

// Content-Disposition
headers.contentDisposition =
  'attachment; filename="example.pdf"; filename*=UTF-8\'\'%E4%BE%8B%E5%AD%90.pdf';

console.log(headers.contentDisposition.type); // 'attachment'
console.log(headers.contentDisposition.filename); // 'example.pdf'
console.log(headers.contentDisposition.filenameSplat); // 'UTF-8\'\'%E4%BE%8B%E5%AD%90.pdf'
console.log(headers.contentDisposition.preferredFilename); // '例子.pdf'

// Cookie
headers.cookie = 'session_id=abc123; user_id=12345';

console.log(headers.cookie.get('session_id')); // 'abc123'
console.log(headers.cookie.get('user_id')); // '12345'

headers.cookie.set('theme', 'dark');
console.log(headers.get('Cookie')); // 'session_id=abc123; user_id=12345; theme=dark'

// Set-Cookie
headers.setCookie = 'session_id=abc123; Path=/; HttpOnly';

console.log(headers.setCookie.name); // 'session_id'
console.log(headers.setCookie.value); // 'abc123'
console.log(headers.setCookie.path); // '/'
console.log(headers.setCookie.httpOnly); // true

// Modifying Set-Cookie attributes
headers.setCookie.maxAge = 3600;
headers.setCookie.secure = true;

console.log(headers.get('Set-Cookie'));
// session_id=abc123; Path=/; HttpOnly; Max-Age=3600; Secure

// Setting multiple cookies
headers.append('Set-Cookie', 'user_id=12345; Path=/api; Secure');

// Accessing multiple Set-Cookie headers
for (let cookie of headers.getSetCookie()) {
  console.log(cookie);
}
// session_id=abc123; Path=/; HttpOnly; Max-Age=3600; Secure
// user_id=12345; Path=/api; Secure
```

You can easily build `SuperHeaders` from an exising `Headers` object, like the one you get in a `fetch` response:

```ts
let response = await fetch('https://example.com');
let headers = new SuperHeaders(response.headers);
```

Or use them to construct a new `fetch` request, or even convert back to a normal `Headers` object:

```ts
fetch('https://example.com', {
  headers: new SuperHeaders(),
});

let headers = new Headers(new SuperHeaders());

assert.ok(new SuperHeaders() instanceof Headers);
```

`SuperHeaders` are iterable:

```ts
let headers = new SuperHeaders({
  'Content-Type': 'application/json',
  'X-API-Key': 'secret-key',
  'Accept-Language': 'en-US,en;q=0.9',
});

for (let [name, value] of headers) {
  console.log(`${name}: ${value}`);
}
// Content-Type: application/json
// X-Api-Key: secret-key
// Accept-Language: en-US,en;q=0.9
```

If you're assembling HTTP messages, you can easily convert to a multiline string suitable for using as a Request/Response header block:

```ts
let headers = new SuperHeaders();
headers.set('Content-Type', 'text/html'); // or headers.contentType = 'text/html'
headers.set('X-Custom-Header', 'value');

console.log(headers.toString());
// Content-Type: text/html
// X-Custom-Header: value

// Note: This varies from the built-in Headers class where you would normally
// get [object Headers] from toString().
```

In addition to the high-level API, fetch-super-headers also provides a rich set of primitives you can use to work with just about any complex HTTP header value. Each header class includes a spec-compliant parser (the constructor), stringifier (`toString`), and getters/setters for all relevant attributes. Classes for headers that contain a list of fields, like `Cookie`, are iterable.

```ts
import { ContentType, Cookie } from 'fetch-super-headers';

let contentType = new ContentType('text/html; charset=utf-8');
console.log(contentType.charset);

let cookie = new Cookie();
cookie.set('theme', 'dark');
cookie.set('session_id', '123');

for (let [key, value] of cookie) {
  // ...
}
```
