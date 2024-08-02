# multipart-parser

`multipart-parser` is a fast, efficient parser for multipart streams. It can be used in any JavaScript environment (not just node.js) for a variety of use cases including:

- Handling file uploads (`multipart/form-data` requests)
- Parsing `multipart/mixed` messages (email attachments, API responses, etc.)
- Parsing email messages with both plain text and HTML versions (`multipart/alternative`)

## Goals

The goals of this project are:

- Provide a JavaScript-y multipart parser that runs anywhere JavaScript runs
- Support the entire spectrum of `multipart/*` message types
- Be fast enough to get the job done quickly while using as little memory as possible

## Installation

```sh
$ npm install @mjackson/multipart-parser
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

If you're working directly with multipart boundaries and buffers/streams of multipart data that are not necessarily part of a request, `multipart-parser` provides a few lower-level APIs that you can use directly:

```typescript
import { parseMultipart } from '@mjackson/multipart-parser';

// Get the data from some API, filesystem, etc.
let multipartData = new Uint8Array();
// can also be a stream or any Iterable/AsyncIterable
// let multipartData = new ReadableStream(...);
// let multipartData = [new Uint8Array(...), new Uint8Array(...)];

let boundary = '----WebKitFormBoundary56eac3x';

for await (let part of parseMultipart(multipartData, boundary)) {
  // Do whatever you want with the part...
}
```

If you'd prefer a callback-based API, instantiate your own `MultipartParser` and go for it:

```typescript
import { MultipartParser } from '@mjackson/multipart-parser';

let multipartData = new Uint8Array();
let boundary = '...';

let parser = new MultipartParser(boundary);

// parse() will resolve once all your callbacks are done
await parser.parse(multipartData, async (part) => {
  // Do whatever you need...
});
```

## Examples

The [`examples` directory](/examples) contains a few working examples of how you can use this library:

- [`cf-workers`](/examples/cf-workers) shows how you can handle multipart uploads in a Cloudflare worker and store files in R2
- [`node-server`](/examples/node-server) demonstrates handling multipart uploads and streaming files to disk

## Benchmark

`multipart-parser` is designed to be as efficient as possible, only operating on streams of data and never buffering in common usage. This design yields exceptional performance when handling multipart payloads of any size. In most benchmarks, `multipart-parser` is as fast or faster than `busboy`.

Important: Benchmarking can be tricky, and results vary greatly depending on platform, parameters, and other factors. So take these results with a grain of salt. The main point of this library is to be portable between JavaScript runtimes. To this end, we run the benchmarks on three major open source JavaScript runtimes: Node.js, Bun, and Deno. These benchmarks are only intended to show that multipart-parser is fast enough to get the job done wherever you run it.

The results of running the benchmarks on my laptop:

```
Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Date: 8/2/2024, 2:40:59 PM
Node.js v20.15.1
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.01 ms ± 0.03' │ '1.33 ms ± 0.07' │ '0.33 ms ± 0.14' │ '13.28 ms ± 0.33' │
│ busboy           │ '0.03 ms ± 0.07' │ '3.11 ms ± 1.26' │ '0.22 ms ± 0.03' │ '43.30 ms ± 2.25' │
│ @fastify/busboy  │ '0.03 ms ± 0.07' │ '1.12 ms ± 0.22' │ '0.39 ms ± 0.03' │ '11.28 ms ± 0.36' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘

> @mjackson/multipart-parser@0.1.1 bench:bun /Users/michael/Projects/multipart-parser
> bun run ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Date: 8/2/2024, 2:43:05 PM
Bun 1.1.21
┌──────────────────┬────────────────┬────────────────┬─────────────────┬─────────────────┐
│                  │ 1 small file   │ 1 large file   │ 100 small files │ 5 large files   │
├──────────────────┼────────────────┼────────────────┼─────────────────┼─────────────────┤
│ multipart-parser │ 0.01 ms ± 0.05 │ 1.14 ms ± 0.16 │ 0.13 ms ± 0.07  │ 11.49 ms ± 1.61 │
│           busboy │ 0.03 ms ± 0.13 │ 3.32 ms ± 0.13 │ 0.33 ms ± 0.14  │ 33.31 ms ± 3.08 │
│  @fastify/busboy │ 0.03 ms ± 0.13 │ 6.71 ms ± 0.13 │ 0.60 ms ± 0.14  │ 67.62 ms ± 3.66 │
└──────────────────┴────────────────┴────────────────┴─────────────────┴─────────────────┘

> @mjackson/multipart-parser@0.1.1 bench:deno /Users/michael/Projects/multipart-parser
> deno --unstable-sloppy-imports run --allow-sys ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Date: 8/2/2024, 2:45:58 PM
Deno 1.45.5
┌──────────────────┬──────────────────┬───────────────────┬──────────────────┬────────────────────┐
│ (idx)            │ 1 small file     │ 1 large file      │ 100 small files  │ 5 large files      │
├──────────────────┼──────────────────┼───────────────────┼──────────────────┼────────────────────┤
│ multipart-parser │ "0.02 ms ± 0.20" │ "1.09 ms ± 1.00"  │ "0.09 ms ± 0.42" │ "10.95 ms ± 1.81"  │
│ busboy           │ "0.04 ms ± 0.28" │ "2.88 ms ± 0.99"  │ "0.29 ms ± 0.70" │ "29.23 ms ± 2.58"  │
│ @fastify/busboy  │ "0.04 ms ± 0.30" │ "11.55 ms ± 0.89" │ "0.74 ms ± 0.97" │ "115.39 ms ± 6.50" │
└──────────────────┴──────────────────┴───────────────────┴──────────────────┴────────────────────┘
```

I'd encourage you to run the benchmarks yourself. You'll probably get different results!

```sh
$ pnpm run bench
```

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.
