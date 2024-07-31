# multipart-parser

`multipart-parser` is a fast, efficient parser for multipart streams. It can be used in any JavaScript environment (not just node.js) for a variety of use cases including:

- Handling file uploads (`multipart/form-data` requests)
- Parsing `multipart/mixed` messages (email attachments, API responses, etc.)
- Parsing email messages with both plain text and HTML versions (`multipart/alternative`)

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

See [the node-server example](/examples/node-server) for a working demo of how you can handle file uploads in node.js.

## Benchmark

`multipart-parser` is designed to be as efficient as possible, only operating on streams of data and never buffering in common usage. This design yields exceptional performance when handling multipart payloads of any size. In most benchmarks, `multipart-parser` is as fast or faster than `busboy`.

To run the benchmarks yourself:

```sh
$ pnpm run bench
```

The results of running the benchmarks on my laptop:

```
Platform: Darwin (23.5.0)
CPU: Apple M2 Pro
Node.js v20.15.1
Date: 7/31/2024, 1:38:33 PM
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.02 ms ± 0.11' │ '1.33 ms ± 0.08' │ '0.35 ms ± 0.13' │ '15.18 ms ± 1.83' │
│ busboy           │ '0.03 ms ± 0.09' │ '2.75 ms ± 0.32' │ '0.22 ms ± 0.03' │ '31.22 ms ± 1.37' │
│ @fastify/busboy  │ '0.04 ms ± 0.08' │ '2.01 ms ± 0.28' │ '0.39 ms ± 0.04' │ '26.68 ms ± 1.32' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘
```

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.
