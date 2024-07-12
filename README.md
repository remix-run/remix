# fetch-super-headers

This package is a suite of tools that make it a little more fun to work with `Headers`.

## Key Features

- Drop-in replacement for the standard `Headers` object
- Strongly typed header-specific getters and setters (e.g., `contentType`, `cookie`)
- Easy parsing and manipulation of complex headers like Content-Type and Content-Disposition
- Iterable interface for easy header enumeration
- Convenient string conversion for HTTP message assembly

## Installation

```sh
$ npm install fetch-super-headers
```

## Usage

fetch-super-headers is designed to be a drop-in replacement for `Headers`, with some additions that make working with HTTP
headers feel a lot more like working with JavaScript objects.

```ts
import Headers from 'fetch-super-headers';
// or, if you don't want to clobber the global `Headers` reference:
// import SuperHeaders from 'fetch-super-headers';

let headers = new Headers();

// Content-Type
headers.contentType = 'application/json; charset=utf-8';

console.log(headers.contentType.mediaType); // 'application/json'
console.log(headers.contentType.charset); // 'utf-8'

headers.contentType.charset = 'iso-8859-1';
console.log(headers.get('Content-Type')); // 'application/json; charset=iso-8859-1'

// Content-Disposition
headers.contentDisposition =
  'attachment; filename="example.pdf"; filename*=UTF-8\'\'%E4%BE%8B%E5%AD%90.pdf';

console.log(headers.contentDisposition.type); // 'attachment'
console.log(headers.contentDisposition.filename); // 'example.pdf'
console.log(headers.contentDisposition.preferredFilename); // '例子.pdf'

// Cookie
headers.cookie = 'session_id=abc123; user_id=12345';

console.log(headers.cookie.get('session_id')); // 'abc123'
console.log(headers.cookie.get('user_id')); // '12345'

headers.cookie.set('theme', 'dark');
console.log(headers.get('Cookie')); // 'session_id=abc123; user_id=12345; theme=dark'
```

Headers are iterable:

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

And you can easily build them from an exising `Headers` object, like the one you get in a `fetch` response:

```ts
let response = await fetch('https://example.com');
let headers = new Headers(response.headers);
```

If you're assembling HTTP messages, you can easily convert to a multiline string suitable for using as a Request/Response
header block:

```ts
let headers = new Headers();
headers.set('content-type', 'text/html'); // or headers.contentType = 'text/html'
headers.set('X-Custom-Header', 'value');

console.log(headers.toString());
// Content-Type: text/html
// X-Custom-Header: value
```

In addition to the high-level API, fetch-super-headers also exposes all of the low-level parsers it uses for each individual HTTP
header as public API, so you can use them in your own projects easily.

```ts
import { ContentType } from 'fetch-super-headers';

let contentType = new ContentType('text/html; charset=utf-8');
console.log(contentType.charset);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. Make sure to follow the existing coding style and add tests for any new functionality.

## License

MIT License
