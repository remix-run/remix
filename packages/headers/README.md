# headers

Tired of manually parsing and stringifying HTTP header values in JavaScript? `headers` supercharges the standard `Headers` interface, providing a robust toolkit for effortless and type-safe header manipulation.

HTTP headers are packed with critical information—from content negotiation and caching directives to authentication tokens and file metadata. While the native `Headers` API provides a basic string-based interface, it leaves the complexities of parsing specific header formats (like `Accept`, `Content-Type`, or `Set-Cookie`) entirely up to you.

`headers` solves this by offering:

- **Type-Safe Accessors:** Interact with complex header values (e.g., media types, quality factors, cookie attributes) through strongly-typed properties and methods, eliminating guesswork and manual parsing.
- **Automatic Parsing & Stringification:** The library intelligently handles the parsing of raw header strings into structured objects and stringifies your structured data back into spec-compliant header values.
- **Fluent Interface:** Enjoy a more expressive and developer-friendly API for reading and writing header information.
- **Drop-in Enhancement:** As a subclass of the standard `Headers` object, it can be used anywhere a `Headers` object is expected, providing progressive enhancement to your existing code.
- **Individual Header Utilities:** For fine-grained control, use standalone utility classes for specific headers, perfect for scenarios outside of a full `Headers` object.

Unlock a more powerful and elegant way to work with HTTP headers in your JavaScript and TypeScript projects!

## Installation

```sh
npm install @remix-run/headers
```

## Overview

The following should give you a sense of what kinds of things you can do with this library:

```ts
import Headers from '@remix-run/headers';

let headers = new Headers();

// Accept
headers.accept = 'text/html, text/*;q=0.9';

headers.accept.mediaTypes; // [ 'text/html', 'text/*' ]
Object.fromEntries(headers.accept.entries()); // { 'text/html': 1, 'text/*': 0.9 }

headers.accept.accepts('text/html'); // true
headers.accept.accepts('text/plain'); // true
headers.accept.accepts('image/jpeg'); // false

headers.accept.getPreferred(['text/plain', 'text/html']); // 'text/html'

headers.accept.set('text/plain', 0.9);
headers.accept.set('text/*', 0.8);

headers.get('Accept'); // 'text/html,text/plain;q=0.9,text/*;q=0.8'

// Accept-Encoding
headers.acceptEncoding = 'gzip, deflate;q=0.8';

headers.acceptEncoding.encodings; // [ 'gzip', 'deflate' ]
Object.fromEntries(headers.acceptEncoding.entries()); // { 'gzip': 1, 'deflate': 0.8 }

headers.acceptEncoding.accepts('gzip'); // true
headers.acceptEncoding.accepts('br'); // false

headers.acceptEncoding.getPreferred(['gzip', 'deflate']); // 'gzip'

// Accept-Language
headers.acceptLanguage = 'en-US, en;q=0.9';

headers.acceptLanguage.languages; // [ 'en-us', 'en' ]
Object.fromEntries(headers.acceptLanguage.entries()); // { 'en-us': 1, en: 0.9 }

headers.acceptLanguage.accepts('en'); // true
headers.acceptLanguage.accepts('ja'); // false

headers.acceptLanguage.getPreferred(['en-US', 'en-GB']); // 'en-US'
headers.acceptLanguage.getPreferred(['en', 'fr']); // 'en'

// Accept-Ranges
headers.acceptRanges = 'bytes';

// Connection
headers.connection = 'close';

// Content-Type
headers.contentType = 'application/json; charset=utf-8';

headers.contentType.mediaType; // "application/json"
headers.contentType.charset; // "utf-8"

headers.contentType.charset = 'iso-8859-1';

headers.get('Content-Type'); // "application/json; charset=iso-8859-1"

// Content-Disposition
headers.contentDisposition =
  'attachment; filename="example.pdf"; filename*=UTF-8\'\'%E4%BE%8B%E5%AD%90.pdf';

headers.contentDisposition.type; // 'attachment'
headers.contentDisposition.filename; // 'example.pdf'
headers.contentDisposition.filenameSplat; // 'UTF-8\'\'%E4%BE%8B%E5%AD%90.pdf'
headers.contentDisposition.preferredFilename; // '例子.pdf'

// Cookie
headers.cookie = 'session_id=abc123; user_id=12345';

headers.cookie.get('session_id'); // 'abc123'
headers.cookie.get('user_id'); // '12345'

headers.cookie.set('theme', 'dark');
headers.get('Cookie'); // 'session_id=abc123; user_id=12345; theme=dark'

// Host
headers.host = 'example.com';

// If-None-Match
headers.ifNoneMatch = ['67ab43', '54ed21'];
headers.get('If-None-Match'); // '"67ab43", "54ed21"'

// Last-Modified
headers.lastModified = new Date();
// or headers.lastModified = new Date().getTime();
headers.get('Last-Modified'); // 'Fri, 20 Dec 2024 08:08:05 GMT'

// Location
headers.location = 'https://example.com';

// Referer
headers.referer = 'https://example.com/';

// Set-Cookie
headers.setCookie = ['session_id=abc123; Path=/; HttpOnly'];

headers.setCookie[0].name; // 'session_id'
headers.setCookie[0].value; // 'abc123'
headers.setCookie[0].path; // '/'
headers.setCookie[0].httpOnly; // true

// Modifying Set-Cookie attributes
headers.setCookie[0].maxAge = 3600;
headers.setCookie[0].secure = true;

headers.get('Set-Cookie'); // 'session_id=abc123; Path=/; HttpOnly; Max-Age=3600; Secure'

// Setting multiple cookies is easy, it's just an array
headers.setCookie.push('user_id=12345; Path=/api; Secure');
// or headers.setCookie = [...headers.setCookie, '...']

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
import Headers from '@remix-run/headers';

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
// Content-Type: application/json
// Accept-Language: en-US,en;q=0.9
```

## Individual Header Utility Classes

In addition to the high-level `Headers` API, `headers` also provides a rich set of primitives you can use to work with just about any complex HTTP header value. Each header class includes a spec-compliant parser (the constructor), stringifier (`toString`), and getters/setters for all relevant attributes. Classes for headers that contain a list of fields, like `Cookie`, are iterable.

If you need support for a header that isn't listed here, please [send a PR](https://github.com/remix-run/remix/pulls)! The goal is to have first-class support for all common HTTP headers.

### Accept

```ts
import { Accept } from '@remix-run/headers';

let header = new Accept('text/html;text/*;q=0.9');

header.has('text/html'); // true
header.has('text/plain'); // false

header.accepts('text/html'); // true
header.accepts('text/plain'); // true
header.accepts('text/*'); // true
header.accepts('image/jpeg'); // false

header.getPreferred(['text/html', 'text/plain']); // 'text/html'

for (let [mediaType, quality] of header) {
  // ...
}

// Alternative init styles
let header = new Accept({ 'text/html': 1, 'text/*': 0.9 });
let header = new Accept(['text/html', ['text/*', 0.9]]);
```

### Accept-Encoding

```ts
import { AcceptEncoding } from '@remix-run/headers';

let header = new AcceptEncoding('gzip,deflate;q=0.9');

header.has('gzip'); // true
header.has('br'); // false

header.accepts('gzip'); // true
header.accepts('deflate'); // true
header.accepts('identity'); // true
header.accepts('br'); // true

header.getPreferred(['gzip', 'deflate']); // 'gzip'

for (let [encoding, weight] of header) {
  // ...
}

// Alternative init styles
let header = new AcceptEncoding({ gzip: 1, deflate: 0.9 });
let header = new AcceptEncoding(['gzip', ['deflate', 0.9]]);
```

### Accept-Language

```ts
import { AcceptLanguage } from '@remix-run/headers';

let header = new AcceptLanguage('en-US,en;q=0.9');

header.has('en-US'); // true
header.has('en-GB'); // false

header.accepts('en-US'); // true
header.accepts('en-GB'); // true
header.accepts('en'); // true
header.accepts('fr'); // true

header.getPreferred(['en-US', 'en-GB']); // 'en-US'
header.getPreferred(['en', 'fr']); // 'en'

for (let [language, quality] of header) {
  // ...
}

// Alternative init styles
let header = new AcceptLanguage({ 'en-US': 1, en: 0.9 });
let header = new AcceptLanguage(['en-US', ['en', 0.9]]);
```

### Cache-Control

```ts
import { CacheControl } from '@remix-run/headers';

let header = new CacheControl('public, max-age=3600, s-maxage=3600');
header.public; // true
header.maxAge; // 3600
header.sMaxage; // 3600

// Alternative init style
let header = new CacheControl({ public: true, maxAge: 3600 });

// Full set of supported properties
header.public; // true/false
header.private; // true/false
header.noCache; // true/false
header.noStore; // true/false
header.noTransform; // true/false
header.mustRevalidate; // true/false
header.proxyRevalidate; // true/false
header.maxAge; // number
header.sMaxage; // number
header.minFresh; // number
header.maxStale; // number
header.onlyIfCached; // true/false
header.immutable; // true/false
header.staleWhileRevalidate; // number
header.staleIfError; // number
```

### Content-Disposition

```ts
import { ContentDisposition } from '@remix-run/headers';

let header = new ContentDisposition('attachment; name=file1; filename=file1.txt');
header.type; // "attachment"
header.name; // "file1"
header.filename; // "file1.txt"
header.preferredFilename; // "file1.txt"

// Alternative init style
let header = new ContentDisposition({
  type: 'attachment',
  name: 'file1',
  filename: 'file1.txt',
});
```

### Content-Type

```ts
import { ContentType } from '@remix-run/headers';

let header = new ContentType('text/html; charset=utf-8');
header.mediaType; // "text/html"
header.boundary; // undefined
header.charset; // "utf-8"

// Alternative init style
let header = new ContentType({
  mediaType: 'multipart/form-data',
  boundary: '------WebKitFormBoundary12345',
  charset: 'utf-8',
});
```

### Cookie

```ts
import { Cookie } from '@remix-run/headers';

let header = new Cookie('theme=dark; session_id=123');
header.get('theme'); // "dark"
header.set('theme', 'light');
header.delete('theme');
header.has('session_id'); // true

// Iterate over cookie name/value pairs
for (let [name, value] of header) {
  // ...
}

// Alternative init styles
let header = new Cookie({ theme: 'dark', session_id: '123' });
let header = new Cookie([
  ['theme', 'dark'],
  ['session_id', '123'],
]);
```

### If-None-Match

```ts
import { IfNoneMatch } from '@remix-run/headers';

let header = new IfNoneMatch('"67ab43", "54ed21"');

header.has('67ab43'); // true
header.has('21ba69'); // false

header.matches('"67ab43"'); // true

// Alternative init style
let header = new IfNoneMatch(['67ab43', '54ed21']);
let header = new IfNoneMatch({
  tags: ['67ab43', '54ed21'],
});
```

### Set-Cookie

```ts
import { SetCookie } from '@remix-run/headers';

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

// Alternative init styles
let header = new SetCookie({
  name: 'session_id',
  value: 'abc',
  domain: 'example.com',
  path: '/',
  secure: true,
  httpOnly: true,
});
```

## Related Packages

- [`fetch-proxy`](https://github.com/remix-run/remix/tree/v3/packages/fetch-proxy) - Build HTTP proxy servers using the web fetch API
- [`node-fetch-server`](https://github.com/remix-run/remix/tree/v3/packages/node-fetch-server) - Build HTTP servers on Node.js using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/v3/LICENSE)
