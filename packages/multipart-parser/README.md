# multipart-parser

`multipart-parser` is a fast, streaming multipart parser that works in **any JavaScript environment**, from serverless functions to traditional servers. Whether you're handling file uploads, parsing email attachments, or working with multipart API responses, `multipart-parser` has you covered.

## 🚀 Why multipart-parser?

- **Universal JavaScript** - One library that works everywhere: Node.js, Bun, Deno, Cloudflare Workers, and browsers
- **Blazing Fast** - Consistently outperforms popular alternatives like busboy in benchmarks
- **Zero Dependencies** - Lightweight and secure with no external dependencies
- **Memory Efficient** - Streaming architecture that `yield`s files as they are found in the stream
- **Type Safe** - Written in TypeScript with comprehensive type definitions
- **Standards Based** - Built on the web standard [Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) for maximum compatibility
- **Production Ready** - Battle-tested error handling with specific error types for common scenarios

## 📦 Features

- Parse file uploads (`multipart/form-data`) with automatic field and file detection
- Support for all `multipart/*` content types (mixed, alternative, related, etc.)
- Convenient `MultipartPart` API with `arrayBuffer`, `bytes`, `text`, `size`, and metadata access
- Built-in file size limiting to prevent abuse
- First-class Node.js support with native `http.IncomingMessage` compatibility
- [Examples for every major runtime](https://github.com/remix-run/remix/tree/v3/packages/multipart-parser/examples)

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @remix-run/multipart-parser
```

Or install from [JSR](https://jsr.io/):

```sh
deno add @remix-run/multipart-parser
```

## Usage

The most common use case for `multipart-parser` is handling file uploads when you're building a web server. For this case, the `parseMultipartRequest` function is your friend. It automatically validates the request is `multipart/form-data`, extracts the multipart boundary from the `Content-Type` header, parses all fields and files in the `request.body` stream, and gives each one to you as a `MultipartPart` object with a rich API for accessing its metadata and content.

```ts
import { MultipartParseError, parseMultipartRequest } from '@remix-run/multipart-parser';

async function handleRequest(request: Request): void {
  try {
    for await (let part of parseMultipartRequest(request)) {
      if (part.isFile) {
        // Access file data in multiple formats
        let buffer = part.arrayBuffer; // ArrayBuffer
        console.log(`File received: ${part.filename} (${buffer.byteLength} bytes)`);
        console.log(`Content type: ${part.mediaType}`);
        console.log(`Field name: ${part.name}`);

        // Save to disk, upload to cloud storage, etc.
        await saveFile(part.filename, part.bytes);
      } else {
        let text = part.text; // string
        console.log(`Field received: ${part.name} = ${JSON.stringify(text)}`);
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

## Limiting File Upload Size

A common use case when handling file uploads is limiting the size of uploaded files to prevent malicious users from sending very large files that may overload your server's memory and/or storage capacity. You can set a file upload size limit using the `maxFileSize` option, and return a 413 "Payload Too Large" response when you receive a request that exceeds the limit.

```ts
import {
  MultipartParseError,
  MaxFileSizeExceededError,
  parseMultipartRequest,
} from '@remix-run/multipart-parser/node';

const oneMb = Math.pow(2, 20);
const maxFileSize = 10 * oneMb;

async function handleRequest(request: Request): Promise<Response> {
  try {
    for await (let part of parseMultipartRequest(request, { maxFileSize })) {
      // ...
    }
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      return new Response('File size limit exceeded', { status: 413 });
    } else if (error instanceof MultipartParseError) {
      return new Response('Failed to parse multipart request', { status: 400 });
    } else {
      console.error(error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}
```

## Node.js Bindings

The main module (`import from "@remix-run/multipart-parser"`) assumes you're working with [the fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) (`Request`, `ReadableStream`, etc). Support for these interfaces was added to Node.js by the [undici](https://github.com/nodejs/undici) project in [version 16.5.0](https://nodejs.org/en/blog/release/v16.5.0).

If however you're building a server for Node.js that relies on node-specific APIs like `http.IncomingMessage`, `stream.Readable`, and `buffer.Buffer` (ala Express or `http.createServer`), `multipart-parser` ships with an additional module that works directly with these APIs.

```ts
import * as http from 'node:http';
import { MultipartParseError, parseMultipartRequest } from '@remix-run/multipart-parser/node';

let server = http.createServer(async (req, res) => {
  try {
    for await (let part of parseMultipartRequest(req)) {
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

If you're working directly with multipart boundaries and buffers/streams of multipart data that are not necessarily part of a request, `multipart-parser` provides a low-level `parseMultipart()` API that you can use directly:

```ts
import { parseMultipart } from '@remix-run/multipart-parser';

let message = new Uint8Array(/* ... */);
let boundary = '----WebKitFormBoundary56eac3x';

for (let part of parseMultipart(message, { boundary })) {
  // ...
}
```

In addition, the `parseMultipartStream` function provides an `async` generator interface for multipart data in a `ReadableStream`:

```ts
import { parseMultipartStream } from '@remix-run/multipart-parser';

let message = new ReadableStream(/* ... */);
let boundary = '----WebKitFormBoundary56eac3x';

for await (let part of parseMultipartStream(message, { boundary })) {
  // ...
}
```

## Examples

The [`examples` directory](https://github.com/remix-run/remix/tree/v3/packages/multipart-parser/examples) contains a few working examples of how you can use this library:

- [`examples/bun`](https://github.com/remix-run/remix/tree/v3/packages/multipart-parser/examples/bun) - using multipart-parser in Bun
- [`examples/cf-workers`](https://github.com/remix-run/remix/tree/v3/packages/multipart-parser/examples/cf-workers) - using multipart-parser in a Cloudflare Worker and storing file uploads in R2
- [`examples/deno`](https://github.com/remix-run/remix/tree/v3/packages/multipart-parser/examples/deno) - using multipart-parser in Deno
- [`examples/node`](https://github.com/remix-run/remix/tree/v3/packages/multipart-parser/examples/node) - using multipart-parser in Node.js

## Benchmark

`multipart-parser` is designed to be as efficient as possible, operating on streams of data and rarely buffering in common usage. This design yields exceptional performance when handling multipart payloads of any size. In benchmarks, `multipart-parser` is as fast or faster than `busboy`.

The results of running the benchmarks on my laptop:

```
> @remix-run/multipart-parser@0.10.1 bench:node /Users/michael/Projects/remix-the-web/packages/multipart-parser
> node --disable-warning=ExperimentalWarning ./bench/runner.ts

Platform: Darwin (24.5.0)
CPU: Apple M1 Pro
Date: 6/13/2025, 12:27:09 PM
Node.js v24.0.2
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.01 ms ± 0.03' │ '1.08 ms ± 0.08' │ '0.04 ms ± 0.01' │ '10.50 ms ± 0.38' │
│ multipasta       │ '0.02 ms ± 0.06' │ '1.07 ms ± 0.02' │ '0.15 ms ± 0.02' │ '10.46 ms ± 0.11' │
│ busboy           │ '0.06 ms ± 0.17' │ '3.07 ms ± 0.24' │ '0.24 ms ± 0.05' │ '29.85 ms ± 0.18' │
│ @fastify/busboy  │ '0.05 ms ± 0.13' │ '1.23 ms ± 0.09' │ '0.45 ms ± 0.22' │ '11.81 ms ± 0.11' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘

> @remix-run/multipart-parser@0.10.1 bench:bun /Users/michael/Projects/remix-the-web/packages/multipart-parser
> bun run ./bench/runner.ts

Platform: Darwin (24.5.0)
CPU: Apple M1 Pro
Date: 6/13/2025, 12:27:31 PM
Bun 1.2.13
┌──────────────────┬────────────────┬────────────────┬─────────────────┬─────────────────┐
│                  │ 1 small file   │ 1 large file   │ 100 small files │ 5 large files   │
├──────────────────┼────────────────┼────────────────┼─────────────────┼─────────────────┤
│ multipart-parser │ 0.01 ms ± 0.04 │ 0.86 ms ± 0.09 │ 0.04 ms ± 0.01  │ 8.32 ms ± 0.26  │
│       multipasta │ 0.02 ms ± 0.07 │ 0.87 ms ± 0.03 │ 0.25 ms ± 0.21  │ 8.27 ms ± 0.09  │
│           busboy │ 0.05 ms ± 0.17 │ 3.54 ms ± 0.10 │ 0.30 ms ± 0.03  │ 34.79 ms ± 0.38 │
│  @fastify/busboy │ 0.06 ms ± 0.18 │ 4.04 ms ± 0.08 │ 0.48 ms ± 0.06  │ 39.91 ms ± 0.37 │
└──────────────────┴────────────────┴────────────────┴─────────────────┴─────────────────┘

> @remix-run/multipart-parser@0.10.1 bench:deno /Users/michael/Projects/remix-the-web/packages/multipart-parser
> deno run --allow-sys ./bench/runner.ts

Platform: Darwin (24.5.0)
CPU: Apple M1 Pro
Date: 6/13/2025, 12:28:12 PM
Deno 2.3.6
┌──────────────────┬──────────────────┬────────────────────┬──────────────────┬─────────────────────┐
│ (idx)            │ 1 small file     │ 1 large file       │ 100 small files  │ 5 large files       │
├──────────────────┼──────────────────┼────────────────────┼──────────────────┼─────────────────────┤
│ multipart-parser │ "0.01 ms ± 0.03" │ "1.03 ms ± 0.04"   │ "0.05 ms ± 0.01" │ "10.05 ms ± 0.20"   │
│ multipasta       │ "0.02 ms ± 0.07" │ "1.04 ms ± 0.03"   │ "0.16 ms ± 0.02" │ "10.10 ms ± 0.08"   │
│ busboy           │ "0.05 ms ± 0.19" │ "3.06 ms ± 0.15"   │ "0.32 ms ± 0.05" │ "29.92 ms ± 0.24"   │
│ @fastify/busboy  │ "0.06 ms ± 0.14" │ "14.72 ms ± 11.42" │ "0.81 ms ± 0.20" │ "127.63 ms ± 35.77" │
└──────────────────┴──────────────────┴────────────────────┴──────────────────┴─────────────────────┘
```

## Related Packages

- [`form-data-parser`](https://github.com/remix-run/remix/tree/v3/packages/form-data-parser) - Uses `multipart-parser` internally to parse multipart requests and generate `FileUpload`s for storage
- [`headers`](https://github.com/remix-run/remix/tree/v3/packages/headers) - Used internally to parse HTTP headers and get metadata (filename, content type) for each `MultipartPart`

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/v3/LICENSE)
