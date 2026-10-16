# multipart-parser

Fast streaming multipart parsing for JavaScript. `multipart-parser` processes multipart bodies incrementally so large uploads can be handled without buffering the entire multipart payload in memory.

## Features

- **File Upload Parsing** - Parse file uploads (`multipart/form-data`) with automatic field and file detection
- **Full Multipart Support** - Support for all `multipart/*` content types (mixed, alternative, related, etc.)
- **Streaming Parts** - Each part is yielded as soon as its headers arrive, with its content streamed as you read it
- **Convenient API** - `MultipartPart` API with `body`, `bytes()`, `text()`, `for await...of`, and metadata access
- **Built-in Limits** - Header, per-part, part-count, and aggregate-size limits to prevent abuse
- **Runtime Demos** - [Demos for every major runtime](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos)

## Installation

```sh
npm i remix
```

## Usage

The most common use case for `multipart-parser` is handling file uploads when you're building a web server. For this case, the `parseMultipartRequest` function is your friend. It automatically validates the request is `multipart/form-data`, extracts the multipart boundary from the `Content-Type` header, parses all fields and files in the `request.body` stream, and gives each one to you as a `MultipartPart` object with a rich API for accessing its metadata and content.

Each part is yielded as soon as its headers arrive, and its content is streamed from the request as you read it, so large uploads never need to be held in memory. A part's content can be read once, with `part.body` (a `ReadableStream`), `part.bytes()`, `part.text()`, or `for await (let chunk of part)`.

`MultipartPart.filename` is untrusted client input from `Content-Disposition`, including decoded `filename*` values when supplied. The parser does not sanitize filenames for filesystem use. Do not use `part.filename`, or a `File.name` derived from it, directly as a filesystem path. Generate a storage name in your application; see [Filename Safety](https://github.com/remix-run/remix/tree/main/packages/headers#filename-safety).

```ts
import { MultipartParseError, parseMultipartRequest } from 'remix/multipart-parser'

async function handleRequest(request: Request): Promise<void> {
  try {
    for await (let part of parseMultipartRequest(request)) {
      if (part.isFile) {
        console.log(`File received: ${part.filename}`)
        console.log(`Content type: ${part.mediaType}`)
        console.log(`Field name: ${part.name}`)
        console.log(`Content-Type header: ${part.headers['content-type']}`)

        // Stream the file to storage under an application-generated name,
        // independent of part.filename
        await saveFile(crypto.randomUUID(), part.body)
      } else {
        let text = await part.text()
        console.log(`Field received: ${part.name} = ${JSON.stringify(text)}`)
      }
    }
  } catch (error) {
    if (error instanceof MultipartParseError) {
      console.error('Failed to parse multipart request:', error.message)
    } else {
      console.error('An unexpected error occurred:', error)
    }
  }
}
```

Parts arrive in order, so read each part's content before continuing the loop. When you continue to the next part, the parser waits for a read you started to finish and discards any content you didn't read. A part's content can't be read after that.

## Part Headers

Each `MultipartPart` exposes decoded part headers as a plain object keyed by lower-case header name. Values are strings, and repeated headers are joined with `, `. Multipart part headers are parsed metadata from the request body, not native `Headers` objects, so access them with bracket notation:

```ts
for await (let part of parseMultipartRequest(request)) {
  let contentDisposition = part.headers['content-disposition']
  let contentType = part.headers['content-type']

  console.log(contentDisposition, contentType)
}
```

## Size Limits

A common use case when handling file uploads is limiting the overall shape of incoming multipart bodies so malicious clients cannot force unbounded growth in memory. Use `maxFileSize` to limit each part, `maxParts` to limit how many parts are accepted, and `maxTotalSize` to limit aggregate part content across the entire request. `multipart-parser` applies finite defaults for each of these limits.

```ts
import {
  MultipartParseError,
  MaxFileSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  parseMultipartRequest,
} from 'remix/multipart-parser'

const oneMb = Math.pow(2, 20)
const limits = {
  maxFileSize: 10 * oneMb,
  maxParts: 100,
  maxTotalSize: 25 * oneMb,
}

async function handleRequest(request: Request): Promise<Response> {
  try {
    for await (let part of parseMultipartRequest(request, limits)) {
      // ...
    }
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      return new Response('File size limit exceeded', { status: 413 })
    } else if (error instanceof MaxPartsExceededError) {
      return new Response('Too many multipart parts', { status: 413 })
    } else if (error instanceof MaxTotalSizeExceededError) {
      return new Response('Multipart request is too large', { status: 413 })
    } else if (error instanceof MultipartParseError) {
      return new Response('Failed to parse multipart request', { status: 400 })
    } else {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}
```

## Node.js

`parseMultipartRequest` works with the fetch API's `Request`. If you're using Node.js's `http` module, use [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) to handle requests as `Request` objects.

## Low-level API

If you're working directly with multipart boundaries and streams of multipart data that are not necessarily part of a request, use `parseMultipartStream`:

```ts
import { parseMultipartStream } from 'remix/multipart-parser'

let message = new ReadableStream(/* ... */)
let boundary = '----WebKitFormBoundary56eac3x'

for await (let part of parseMultipartStream(message, { boundary })) {
  // ...
}
```

The final part is yielded when its closing boundary arrives. A malformed closing suffix causes the parser to throw after that part was delivered, so processing a part does not guarantee that the entire message is valid. Empty multipart messages yield no parts.

## Demos

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos) contains a few working demos of how you can use this library:

- [`demos/bun`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/bun) - using multipart-parser in Bun
- [`demos/cf-workers`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/cf-workers) - using multipart-parser in a Cloudflare Worker and storing file uploads in R2
- [`demos/deno`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/deno) - using multipart-parser in Deno
- [`demos/node`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/node) - using multipart-parser in Node.js

## Benchmark

`multipart-parser` is designed to be as efficient as possible, streaming part content as it is read instead of buffering it. This design yields excellent performance when handling multipart payloads of any size. In benchmarks, `multipart-parser` is as fast or faster than `busboy`, and it is the fastest of the parsers tested on messages with many parts or with boundary-like content.

The results of running the benchmarks on my laptop:

```
> @remix-run/multipart-parser@1.0.0 bench:node
> node ./bench/runner.ts

Platform: Darwin (25.6.0)
CPU: Apple M5 Pro
Date: 10/16/2026, 11:12:36 AM
Node.js v24.18.0
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┬───────────────────┬────────────────────────────┬─────────────────────────────┐
│ (index)          │ 1 small file     │ 1 large file     │ 100 small files  │ 5 large files     │ 1 large file (adversarial) │ 5 large files (adversarial) │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┼────────────────────────────┼─────────────────────────────┤
│ multipart-parser │ '0.02 ms ± 0.09' │ '0.76 ms ± 0.05' │ '0.07 ms ± 0.02' │ '7.58 ms ± 0.06'  │ '0.31 ms ± 0.05'           │ '3.63 ms ± 0.23'            │
│ multipasta       │ '0.01 ms ± 0.04' │ '0.70 ms ± 0.02' │ '0.10 ms ± 0.01' │ '7.24 ms ± 0.34'  │ '0.64 ms ± 0.28'           │ '6.51 ms ± 0.59'            │
│ busboy           │ '0.04 ms ± 0.15' │ '1.99 ms ± 0.14' │ '0.15 ms ± 0.03' │ '19.42 ms ± 0.16' │ '0.42 ms ± 0.02'           │ '4.16 ms ± 0.08'            │
│ @fastify/busboy  │ '0.03 ms ± 0.08' │ '0.81 ms ± 0.07' │ '0.29 ms ± 0.15' │ '7.91 ms ± 0.06'  │ '0.51 ms ± 0.04'           │ '5.15 ms ± 0.15'            │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┴───────────────────┴────────────────────────────┴─────────────────────────────┘

> @remix-run/multipart-parser@1.0.0 bench:bun
> bun run ./bench/runner.ts

Platform: Darwin (25.6.0)
CPU: Apple M5 Pro
Date: 10/16/2026, 11:12:55 AM
Bun 1.3.14
┌──────────────────┬────────────────┬────────────────┬─────────────────┬─────────────────┬────────────────────────────┬─────────────────────────────┐
│                  │ 1 small file   │ 1 large file   │ 100 small files │ 5 large files   │ 1 large file (adversarial) │ 5 large files (adversarial) │
├──────────────────┼────────────────┼────────────────┼─────────────────┼─────────────────┼────────────────────────────┼─────────────────────────────┤
│ multipart-parser │ 0.02 ms ± 0.06 │ 0.71 ms ± 0.03 │ 0.05 ms ± 0.01  │ 6.86 ms ± 0.44  │ 0.25 ms ± 0.01             │ 2.46 ms ± 0.14              │
│       multipasta │ 0.01 ms ± 0.05 │ 0.66 ms ± 0.02 │ 0.15 ms ± 0.01  │ 6.50 ms ± 0.20  │ 0.48 ms ± 0.16             │ 4.86 ms ± 0.44              │
│           busboy │ 0.03 ms ± 0.11 │ 2.30 ms ± 0.10 │ 0.18 ms ± 0.02  │ 22.40 ms ± 0.28 │ 0.84 ms ± 0.01             │ 8.45 ms ± 0.12              │
│  @fastify/busboy │ 0.03 ms ± 0.11 │ 0.70 ms ± 0.04 │ 0.26 ms ± 0.04  │ 6.69 ms ± 0.28  │ 0.85 ms ± 0.04             │ 8.50 ms ± 0.65              │
└──────────────────┴────────────────┴────────────────┴─────────────────┴─────────────────┴────────────────────────────┴─────────────────────────────┘
```

## Related Packages

- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Uses `multipart-parser` internally to parse multipart requests and generate `FileUpload`s for storage
- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Used internally to parse `Content-Disposition` and `Content-Type` metadata for each `MultipartPart`

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
