# multipart-parser

`multipart-parser` is a fast, efficient parser for multipart streams. It can be used in any JavaScript environment (not just node.js) for a variety of use cases including:

- Handling file uploads (`multipart/form-data` requests)
- Parsing `multipart/mixed` messages (email attachments, API responses, etc.)
- Parsing email messages with both plain text and HTML versions (`multipart/alternative`)

## Features

- Runs anywhere JavaScript runs (see [examples for Node.js, Bun, Deno, and Cloudflare Workers](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser/examples))
- Built on the standard [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)
- Supports the entire spectrum of `multipart/*` message types
- Memory efficient and does not buffer anything in normal usage
- [As fast or faster than](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser#benchmark) other popular multipart libraries

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/multipart-parser
```

Or install from [JSR](https://jsr.io/):

```sh
deno add @mjackson/multipart-parser
```

## Usage

The most common use case for `multipart-parser` is handling file uploads when you're building a web server. For this case, the `parseMultipartRequest` function is your friend. It will automatically validate the request is `multipart/form-data`, extract the multipart boundary from the `Content-Type` header, parse all fields and files in the `request.body` stream, and `yield` each one to you as a `MultipartPart` object so you can save it to disk or upload it somewhere.

```typescript
import { MultipartParseError, parseMultipartRequest } from '@mjackson/multipart-parser';

async function handleMultipartRequest(request: Request): void {
  try {
    // The parser `yield`s each MultipartPart as it becomes available
    for await (let part of parseMultipartRequest(request)) {
      console.log(part.name);
      console.log(part.filename);

      if (/^text\//.test(part.mediaType)) {
        console.log(await part.text());
      } else {
        // TODO: part.body is a ReadableStream<Uint8Array>, stream it to a file
      }
    }
  } catch (error) {
    if (error instanceof MultipartParseError) {
      console.error('Failed to parse multipart request:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
}
```

The main module (`import from "@mjackson/multipart-parser"`) assumes you're working with [the fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) (`Request`, `ReadableStream`, etc). Support for these interfaces was added to Node.js by the [undici](https://github.com/nodejs/undici) project in [version 16.5.0](https://nodejs.org/en/blog/release/v16.5.0).

If however you're building a server for Node.js that relies on node-specific APIs like `http.IncomingMessage`, `stream.Readable`, and `buffer.Buffer` (ala Express or `http.createServer`), `multipart-parser` ships with an additional module that works directly with these APIs.

```typescript
import * as http from 'node:http';

import { MultipartParseError } from '@mjackson/multipart-parser';
// Note: Import from multipart-parser/node for node-specific APIs
import { parseMultipartRequest } from '@mjackson/multipart-parser/node';

const server = http.createServer(async (req, res) => {
  try {
    for await (let part of parseMultipartRequest(req)) {
      console.log(part.name);
      console.log(part.filename);
      console.log(part.mediaType);

      // ...
    }
  } catch (error) {
    if (error instanceof MultipartParseError) {
      console.error('Failed to parse multipart request:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
  }
});

server.listen(8080);
```

## Low-level API

If you're working directly with multipart boundaries and buffers/streams of multipart data that are not necessarily part of a request, `multipart-parser` provides a lower-level API that you can use directly:

```typescript
import { parseMultipart } from '@mjackson/multipart-parser';

// Get the multipart data from some API, filesystem, etc.
let multipartMessage = new Uint8Array();
// can also be a stream or any Iterable/AsyncIterable
// let multipartMessage = new ReadableStream(...);
// let multipartMessage = [new Uint8Array(...), new Uint8Array(...)];

let boundary = '----WebKitFormBoundary56eac3x';

for await (let part of parseMultipart(multipartMessage, boundary)) {
  // Do whatever you want with the part...
}
```

If you'd prefer a callback-based API, instantiate your own `MultipartParser` and go for it:

```typescript
import { MultipartParseError, MultipartParser } from '@mjackson/multipart-parser';

let multipartMessage = new Uint8Array(); // or ReadableStream<Uint8Array>, etc.
let boundary = '...';

let parser = new MultipartParser(boundary);

try {
  // parse() resolves once the parse is finished and all your callbacks are done
  await parser.parse(multipartMessage, async (part) => {
    // Do whatever you need...
  });
} catch (error) {
  if (error instanceof MultipartParseError) {
    // The parse failed
  } else {
    // One of your handlers failed
  }
}
```

## Examples

The [`examples` directory](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser/examples) contains a few working examples of how you can use this library:

- [`examples/bun`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser/examples/bun) - using multipart-parser in Bun
- [`examples/cf-workers`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser/examples/cf-workers) - using multipart-parser in a Cloudflare Worker and storing file uploads in R2
- [`examples/deno`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser/examples/deno) - using multipart-parser in Deno
- [`examples/node`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser/examples/node) - using multipart-parser in Node.js

## Benchmark

`multipart-parser` is designed to be as efficient as possible, operating mainly on streams of data and rarely buffering in common usage. This design yields exceptional performance when handling multipart payloads of any size. In most benchmarks, `multipart-parser` is as fast or faster than `busboy`.

Important: Benchmarking can be tricky, and results vary greatly depending on platform, parameters, and other factors. So take these results with a grain of salt. The main point of this library is to be portable between JavaScript runtimes. To this end, we run the benchmarks on three major open source JavaScript runtimes: Node.js, Bun, and Deno.

The results of running the benchmarks on my laptop:

```
> @mjackson/multipart-parser@0.6.1 bench:node /Users/michael/Projects/multipart-parser
> node --import tsimp/import ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Date: 8/18/2024, 4:18:39 PM
Node.js v22.1.0
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.01 ms ± 0.03' │ '1.06 ms ± 0.04' │ '0.10 ms ± 0.03' │ '10.60 ms ± 0.22' │
│ multipasta       │ '0.01 ms ± 0.03' │ '1.06 ms ± 0.03' │ '0.15 ms ± 0.02' │ '10.70 ms ± 2.70' │
│ busboy           │ '0.03 ms ± 0.09' │ '3.01 ms ± 0.08' │ '0.22 ms ± 0.03' │ '29.91 ms ± 0.91' │
│ @fastify/busboy  │ '0.03 ms ± 0.07' │ '1.20 ms ± 0.08' │ '0.39 ms ± 0.07' │ '11.86 ms ± 0.17' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘

> @mjackson/multipart-parser@0.6.1 bench:bun /Users/michael/Projects/multipart-parser
> bun run ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Date: 8/18/2024, 4:20:58 PM
Bun 1.1.21
┌──────────────────┬────────────────┬────────────────┬─────────────────┬─────────────────┐
│                  │ 1 small file   │ 1 large file   │ 100 small files │ 5 large files   │
├──────────────────┼────────────────┼────────────────┼─────────────────┼─────────────────┤
│ multipart-parser │ 0.01 ms ± 0.04 │ 0.91 ms ± 0.09 │ 0.11 ms ± 0.05  │ 8.23 ms ± 0.18  │
│       multipasta │ 0.01 ms ± 0.03 │ 0.87 ms ± 0.08 │ 0.22 ms ± 0.15  │ 8.09 ms ± 0.15  │
│           busboy │ 0.03 ms ± 0.07 │ 3.59 ms ± 0.13 │ 0.36 ms ± 0.17  │ 35.26 ms ± 0.39 │
│  @fastify/busboy │ 0.04 ms ± 0.11 │ 7.23 ms ± 0.15 │ 0.63 ms ± 0.15  │ 71.86 ms ± 0.53 │
└──────────────────┴────────────────┴────────────────┴─────────────────┴─────────────────┘

> @mjackson/multipart-parser@0.6.1 bench:deno /Users/michael/Projects/multipart-parser
> deno --unstable-byonm --unstable-sloppy-imports run --allow-sys ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Date: 8/18/2024, 4:24:16 PM
Deno 1.45.5
┌──────────────────┬──────────────────┬───────────────────┬──────────────────┬────────────────────┐
│ (idx)            │ 1 small file     │ 1 large file      │ 100 small files  │ 5 large files      │
├──────────────────┼──────────────────┼───────────────────┼──────────────────┼────────────────────┤
│ multipart-parser │ "0.01 ms ± 0.15" │ "1.00 ms ± 1.00"  │ "0.08 ms ± 0.39" │ "10.08 ms ± 0.41"  │
│ multipasta       │ "0.01 ms ± 0.14" │ "1.02 ms ± 1.00"  │ "0.17 ms ± 0.56" │ "14.59 ms ± 0.92"  │
│ busboy           │ "0.04 ms ± 0.28" │ "3.04 ms ± 1.00"  │ "0.30 ms ± 0.71" │ "29.86 ms ± 0.83"  │
│ @fastify/busboy  │ "0.05 ms ± 0.31" │ "12.36 ms ± 0.78" │ "0.78 ms ± 0.98" │ "123.54 ms ± 5.04" │
└──────────────────┴──────────────────┴───────────────────┴──────────────────┴────────────────────┘
```

I encourage you to run the benchmarks yourself. You'll probably get different results!

```sh
pnpm run bench
```

## Related Packages

- [`form-data-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/form-data-parser) - Uses `multipart-parser` internally to parse multipart requests and generate `FileUpload`s for storage
- [`headers`](https://github.com/mjackson/remix-the-web/tree/main/packages/headers) - Used internally to parse HTTP headers and get metadata (filename, content type) for each `MultipartPart`

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
