# headers

`headers` is a toolkit for working with HTTP headers in JavaScript.

HTTP headers contain a wealth of information:

- Who is sending this request?
- What's in the payload and how is it encoded?
- What is the filename of this file upload?
- and much, much more!

The [built-in JavaScript `Headers` interface](https://developer.mozilla.org/en-US/docs/Web/API/Headers) accepts and gives you strings for everything, which you're probably used to parsing and stringifying manually as needed. This library aims to give you a more fluent interface for all of this information. Similar to how the DOM gives you programmatic access to HTML documents, `headers` gives you access to HTTP headers.

## Installation

```sh
npm install @mjackson/headers
```

## Overview

```ts
import Headers from '@mjackson/headers';

let headers = new Headers();

// Accept-Language

headers.acceptLanguage = 'en-US,en;q=0.9';

console.log(headers.acceptLanguage.languages); // [ 'en-US', 'en' ]
console.log(headers.acceptLanguage.entries());
// [Map Entries] { [ 'en-US', 1 ], [ 'en', 0.9 ] }

// Content-Type
headers.contentType = 'application/json; charset=utf-8';

console.log(headers.contentType.mediaType); // "application/json"
console.log(headers.contentType.charset); // "utf-8"

headers.contentType.charset = 'iso-8859-1';

console.log(headers.get('Content-Type')); // "application/json; charset=iso-8859-1"

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

`Headers` can be initialized with an object config:

```ts
let headers = new Headers({
  contentType: {
    mediaType: 'text/html',
    charset: 'utf-8',
  },
  setCookie: [
    { name: 'session', value: 'abc', path: '/' },
    { name: 'theme', value: 'dark', expires: new Date('2021-12-31T23:59:59Z') },
  ],
});

console.log(`${headers}`);
// Content-Type: text/html; charset=utf-8
// Set-Cookie: session=abc; Path=/
// Set-Cookie: theme=dark; Expires=Fri, 31 Dec 2021 23:59:59 GMT
```

`Headers` works just like [DOM's `Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers) (it's a subclass) so you can use them anywhere you need a `Headers`.

```ts
import Headers from '@mjackson/headers';

// Use in a fetch()
let response = await fetch('https://example.com', {
  headers: new Headers(),
});

// Convert from DOM Headers
let headers = new Headers(response.headers);

headers.set('Content-Type', 'text/html');
headers.get('Content-Type'); // "text/html"
```

If you're familiar with using DOM `Headers`, everything works as you'd expect.

`Headers` are iterable:

```ts
let headers = new Headers({
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
let headers = new Headers({
  'Content-Type': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
});

console.log(`${headers}`);
// Content-Type: text/html
// Accept-Language: en-US,en;q=0.9
```

## Low-level API

In addition to the high-level `Headers` API, `headers` also provides a rich set of primitives you can use to work with just about any complex HTTP header value. Each header class includes a spec-compliant parser (the constructor), stringifier (`toString`), and getters/setters for all relevant attributes. Classes for headers that contain a list of fields, like `Cookie`, are `Iterable`.

All individual header classes may be initialized with either a) the string value of the header or b) an `init` object specific to that header.

The following headers are currently supported:

- [`Accept-Language`](#accept-language)
- [`Cache-Control`](#cache-control)
- [`Content-Disposition`](#content-disposition)
- [`Content-Type`](#content-type)
- [`Cookie`](#cookie)
- [`Set-Cookie`](#set-cookie)

If you need support for a header that isn't listed here, please [send a PR](https://github.com/mjackson/headers/pulls)! The goal is to have first-class support for all common HTTP headers.

### Accept-Language

```ts
let header = new AcceptLanguage('en-US,en;q=0.9');
header.get('en-US'); // 1
header.set('en-US', 0.8);
header.delete('en-US');
header.has('en'); // true

// Iterate over language/quality pairs
for (let [language, quality] of header) {
  // ...
}

let header = new AcceptLanguage(['en-US', ['en', 0.9]]);
let header = new AcceptLanguage({ 'en-US': 1, en: 0.9 });
```

### Cache-Control

```ts
import { CacheControl } from '@mjackson/headers';

let header = new CacheControl('public, max-age=3600, s-maxage=3600');
header.public; // true
header.maxAge; // 3600
header.sMaxage; // 3600
```

### Content-Disposition

```ts
import { ContentDisposition } from '@mjackson/headers';

let header = new ContentDisposition('attachment; name=file1; filename=file1.txt');
header.type; // "attachment"
header.name; // "file1"
header.filename; // "file1.txt"
header.preferredFilename; // "file1.txt"
```

### Content-Type

```ts
import { ContentType } from '@mjackson/headers';

let header = new ContentType('text/html; charset=utf-8');
header.mediaType; // "text/html"
header.boundary; // undefined
header.charset; // "utf-8"

let header = new ContentType({
  mediaType: 'multipart/form-data',
  boundary: '------WebKitFormBoundary12345',
});
```

### Cookie

```ts
import { Cookie } from '@mjackson/headers';

let header = new Cookie('theme=dark; session_id=123');
header.get('theme'); // "dark"
header.set('theme', 'light');
header.delete('theme');
header.has('session_id'); // true

// Iterate over cookie name/value pairs
for (let [name, value] of header) {
  // ...
}
```

### Set-Cookie

```ts
import { SetCookie } from '@mjackson/headers';

let header = new SetCookie('session_id=abc; Domain=example.com; Path=/; Secure; HttpOnly');
header.name; // "session_id"
header.value; // "abc"
header.domain; // "example.com"
header.path; // "/"
header.secure; // true
header.httpOnly; // true
header.sameSite; // undefined
header.maxAge; // undefined
header.expires; // undefined
```

## License

See [LICENSE](https://github.com/mjackson/headers/blob/main/LICENSE)
