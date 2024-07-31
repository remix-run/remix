# multipart-parser

`multipart-parser` is a fast, efficient parser for multipart streams. It can be used in any JavaScript environment (not just node) for a variety of use cases including:

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
      console.log(part.mediaType);

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

## Benchmark

`multipart-parser` is designed to be as efficient as possible, only operating on streams of data and never buffering in common usage. This design yields exceptional performance when handling multipart payloads of any size. In most benchmarks, `multipart-parser` is as fast or faster than `busboy`.

To run the benchmarks yourself:

```sh
$ pnpm run bench
```

The results of running the benchmarks on my laptop:

```
Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Node.js v20.15.0
Date: 7/30/2024, 7:01:45 PM
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.02 ms ± 0.10' │ '1.49 ms ± 0.06' │ '0.38 ms ± 0.17' │ '16.17 ms ± 1.66' │
│ busboy           │ '0.03 ms ± 0.09' │ '4.34 ms ± 0.21' │ '0.23 ms ± 0.03' │ '48.82 ms ± 1.30' │
│ @fastify/busboy  │ '0.03 ms ± 0.07' │ '2.13 ms ± 0.29' │ '0.40 ms ± 0.06' │ '26.67 ms ± 1.22' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘
```
