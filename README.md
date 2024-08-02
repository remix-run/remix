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

If you're building a server you can use `multipart-parser` to handle file uploads.

```typescript
import { MultipartParseError, parseMultipartRequest } from '@mjackson/multipart-parser';

async function handleMultipartRequest(request: Request): void {
  try {
    // The parser `yield`s each MultipartPart as it becomes available.
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

The main module (`import from "@mjackson/multipart-parser"`) assumes you're working with [the fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) (`Request`, `ReadableStream`, etc). Support for these interfaces was added to node.js by the [undici](https://github.com/nodejs/undici) project in [version 16.5.0](https://nodejs.org/en/blog/release/v16.5.0).

If however you're building a server for node.js that relies on node-specific APIs like `http.IncomingMessage`, `stream.Readable`, and `buffer.Buffer` (ala Express or `http.createServer`), `multipart-parser` ships with an additional module that works directly with these APIs.

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

## Examples

The [`examples` directory](/examples) contains a few working examples of how you can use this library:

- [`cf-workers`](/examples/cf-workers) shows how you can handle multipart uploads in a Cloudflare worker and store files in R2
- [`node-server`](/examples/node-server) demonstrates handling multipart uploads and streaming files to disk

## Benchmark

`multipart-parser` is designed to be as efficient as possible, only operating on streams of data and never buffering in common usage. This design yields exceptional performance when handling multipart payloads of any size. In most benchmarks, `multipart-parser` is as fast or faster than `busboy`.

Important: Benchmarking can be tricky, and results vary greatly depending on platform, parameters, and other factors. So take these results with a grain of salt. The main point of this library is to be portable between JavaScript runtimes. To this end, we run the benchmarks on three major open source JavaScript runtimes: Node.js, Bun, and Deno. These benchmarks are only intended to show that multipart-parser is fast enough to get the job done wherever you run it.

The results of running the benchmarks on my laptop:

```
> @mjackson/multipart-parser@0.1.1 bench:node /Users/michael/Projects/multipart-parser
> node --import tsimp/import ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Date: 8/1/2024, 5:47:52 PM
Node.js v20.15.1
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.02 ms ± 0.07' │ '1.48 ms ± 0.31' │ '0.35 ms ± 0.13' │ '15.14 ms ± 1.60' │
│ busboy           │ '0.03 ms ± 0.08' │ '4.26 ms ± 0.08' │ '0.25 ms ± 0.02' │ '43.25 ms ± 2.45' │
│ @fastify/busboy  │ '0.03 ms ± 0.07' │ '1.11 ms ± 0.06' │ '0.54 ms ± 0.62' │ '11.11 ms ± 1.17' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘

> @mjackson/multipart-parser@0.1.1 bench:bun /Users/michael/Projects/multipart-parser
> bun run ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Date: 8/1/2024, 5:49:56 PM
Bun 1.1.21
┌──────────────────┬────────────────┬────────────────┬─────────────────┬─────────────────┐
│                  │ 1 small file   │ 1 large file   │ 100 small files │ 5 large files   │
├──────────────────┼────────────────┼────────────────┼─────────────────┼─────────────────┤
│ multipart-parser │ 0.01 ms ± 0.07 │ 1.16 ms ± 0.17 │ 0.17 ms ± 0.10  │ 11.37 ms ± 1.25 │
│           busboy │ 0.03 ms ± 0.14 │ 3.29 ms ± 0.10 │ 0.34 ms ± 0.15  │ 33.09 ms ± 2.06 │
│  @fastify/busboy │ 0.03 ms ± 0.12 │ 6.92 ms ± 1.79 │ 0.58 ms ± 0.13  │ 67.20 ms ± 3.01 │
└──────────────────┴────────────────┴────────────────┴─────────────────┴─────────────────┘

> @mjackson/multipart-parser@0.1.1 bench:deno /Users/michael/Projects/multipart-parser
> deno --unstable-sloppy-imports run --allow-sys ./bench/runner.ts

Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Date: 8/1/2024, 5:52:49 PM
Deno 1.45.5
┌──────────────────┬──────────────────┬───────────────────┬──────────────────┬────────────────────┐
│ (idx)            │ 1 small file     │ 1 large file      │ 100 small files  │ 5 large files      │
├──────────────────┼──────────────────┼───────────────────┼──────────────────┼────────────────────┤
│ multipart-parser │ "0.03 ms ± 0.27" │ "1.16 ms ± 0.99"  │ "0.11 ms ± 0.46" │ "10.71 ms ± 0.98"  │
│ busboy           │ "0.03 ms ± 0.26" │ "2.85 ms ± 0.99"  │ "0.28 ms ± 0.70" │ "29.11 ms ± 2.57"  │
│ @fastify/busboy  │ "0.05 ms ± 0.31" │ "11.38 ms ± 0.93" │ "0.73 ms ± 0.96" │ "115.56 ms ± 8.07" │
└──────────────────┴──────────────────┴───────────────────┴──────────────────┴────────────────────┘
```

I'd encourage you to run the benchmarks yourself. You'll probably get different results!

```sh
$ pnpm run bench
```

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.
