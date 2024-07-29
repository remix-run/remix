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
CPU: Apple M2 Pro
Node.js v20.15.1
Date: 7/29/2024, 2:15:40 PM
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ multipart-parser │ '0.02 ms ± 0.15' │ '1.61 ms ± 0.07' │ '0.36 ms ± 0.13' │ '17.22 ms ± 1.03' │
│ busboy           │ '0.03 ms ± 0.09' │ '4.09 ms ± 0.21' │ '0.22 ms ± 0.03' │ '45.37 ms ± 2.76' │
│ @fastify/busboy  │ '0.03 ms ± 0.07' │ '2.33 ms ± 0.44' │ '0.40 ms ± 0.05' │ '27.02 ms ± 2.39' │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┘
```
