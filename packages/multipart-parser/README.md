# multipart-parser

Fast streaming multipart parsing for JavaScript. `multipart-parser` processes multipart bodies incrementally so large uploads can be handled without buffering the entire multipart payload in memory.

## Features

- **File Upload Parsing** - Parse file uploads (`multipart/form-data`) with automatic field and file detection
- **Full Multipart Support** - Support for all `multipart/*` content types (mixed, alternative, related, etc.)
- **Convenient API** - `MultipartPart` API with `arrayBuffer`, `bytes`, `text`, `size`, and metadata access
- **Built-in Limits** - Header, per-part, part-count, and aggregate-size limits to prevent abuse
- **Node.js Support** - First-class Node.js support with native `http.IncomingMessage` compatibility
- **Runtime Demos** - [Demos for every major runtime](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos)

## Installation

```sh
npm i remix
```

## Usage

The most common use case for `multipart-parser` is handling file uploads when you're building a web server. For this case, the `parseMultipartRequest` function is your friend. It automatically validates the request is `multipart/form-data`, extracts the multipart boundary from the `Content-Type` header, parses all fields and files in the `request.body` stream, and gives each one to you as a `MultipartPart` object with a rich API for accessing its metadata and content.

`MultipartPart.filename` is untrusted client input from `Content-Disposition`, including decoded `filename*` values when supplied. The parser does not sanitize filenames for filesystem use. Do not use `part.filename`, or a `File.name` derived from it, directly as a filesystem path. Generate a storage name in your application; see [Filename Safety](https://github.com/remix-run/remix/tree/main/packages/headers#filename-safety).

```ts
import { MultipartParseError, parseMultipartRequest } from 'remix/multipart-parser'

async function handleRequest(request: Request): Promise<void> {
  try {
    for await (let part of parseMultipartRequest(request)) {
      if (part.isFile) {
        // Access file data in multiple formats
        let buffer = part.arrayBuffer // ArrayBuffer
        console.log(`File received: ${part.filename} (${buffer.byteLength} bytes)`)
        console.log(`Content type: ${part.mediaType}`)
        console.log(`Field name: ${part.name}`)
        console.log(`Content-Type header: ${part.headers['content-type']}`)

        // Save under an application-generated name, independent of part.filename
        let storageName = crypto.randomUUID()
        await saveFile(storageName, part.bytes)
      } else {
        let text = part.text // string
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
} from 'remix/multipart-parser/node'

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

## Node.js Bindings

The main module (`import {} from 'remix/multipart-parser'`) assumes you're working with [the fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) (`Request`, `ReadableStream`, etc). Support for these interfaces was added to Node.js by the [undici](https://github.com/nodejs/undici) project in [version 16.5.0](https://nodejs.org/en/blog/release/v16.5.0).

If however you're building a server for Node.js that relies on node-specific APIs like `http.IncomingMessage`, `stream.Readable`, and `buffer.Buffer` (ala Express or `http.createServer`), `multipart-parser` ships with an additional module that works directly with these APIs.

```ts
import * as http from 'node:http'
import { MultipartParseError, parseMultipartRequest } from 'remix/multipart-parser/node'

let server = http.createServer(async (req, res) => {
  try {
    for await (let part of parseMultipartRequest(req)) {
      // ...
    }
  } catch (error) {
    if (error instanceof MultipartParseError) {
      console.error('Failed to parse multipart request:', error.message)
    } else {
      console.error('An unexpected error occurred:', error)
    }
  }
})

server.listen(8080)
```

## Low-level API

If you're working directly with multipart boundaries and buffers/streams of multipart data that are not necessarily part of a request, `multipart-parser` provides a low-level `parseMultipart()` API that you can use directly:

```ts
import { parseMultipart } from 'remix/multipart-parser'

let message = new Uint8Array(/* ... */)
let boundary = '----WebKitFormBoundary56eac3x'

for (let part of parseMultipart(message, { boundary })) {
  // ...
}
```

In addition, the `parseMultipartStream` function provides an `async` generator interface for multipart data in a `ReadableStream`:

```ts
import { parseMultipartStream } from 'remix/multipart-parser'

let message = new ReadableStream(/* ... */)
let boundary = '----WebKitFormBoundary56eac3x'

for await (let part of parseMultipartStream(message, { boundary })) {
  // ...
}
```

For direct control over chunk delivery, use `MultipartParser`. Consume all parts yielded by `write()` for every chunk, then call `finish()` at EOF to validate completion.

```ts
import { MultipartParser } from 'remix/multipart-parser'

let parser = new MultipartParser(boundary)

for await (let chunk of chunks) {
  for (let part of parser.write(chunk)) {
    await handlePart(part)
  }
}

parser.finish()
```

`write()` yields the final part when both closing hyphens arrive. A malformed closing suffix can cause a subsequent `write()` or `finish()` to throw after that part was delivered. Processing a part does not guarantee that the entire message is valid. Empty multipart messages yield no parts.

## Future API

**Future APIs are not stable.** The `remix/multipart-parser/future` entrypoint may change in any release, but it is a good indication of where this package will land in its next major release.

`remix/multipart-parser/future` exports a streaming `parseMultipartRequest()` and `parseMultipartStream()`. Each `MultipartPart` is yielded as soon as its headers arrive, and its content streams from the request body as you read it, so large files are never buffered in memory.

```ts
import { parseMultipartRequest } from 'remix/multipart-parser/future'

for await (let part of parseMultipartRequest(request, { maxFileSize: 100 * 1024 * 1024 })) {
  if (part.isFile) {
    // Stream the file to storage under an application-generated name
    await storage.put(crypto.randomUUID(), part.body)
  } else {
    console.log(part.name, await part.text())
  }
}
```

Read each part's content once, with `part.body`, `await part.bytes()`, `await part.text()`, or `for await...of`, before continuing to the next part. Content you don't read is discarded when you continue, and breaking out of the loop cancels the request body.

The future entrypoint does not include `parseMultipart()`, `MultipartParser`, or Node.js bindings. Its error classes are the same as the stable entrypoint's, so `instanceof` checks work with either.

## Demos

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos) contains a few working demos of how you can use this library:

- [`demos/bun`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/bun) - using multipart-parser in Bun
- [`demos/cf-workers`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/cf-workers) - using multipart-parser in a Cloudflare Worker and storing file uploads in R2
- [`demos/deno`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/deno) - using multipart-parser in Deno
- [`demos/node`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser/demos/node) - using multipart-parser in Node.js

## Benchmarks

`multipart-parser` operates on streams of data and rarely buffers in common usage, so it stays fast for multipart payloads of any size. The tables below compare the average time to parse each message, plus or minus one standard deviation, with [`multipasta`](https://github.com/tim-smart/multipasta), [`busboy`](https://github.com/mscdex/busboy), and [`@fastify/busboy`](https://github.com/fastify/busboy) on Node.js, Bun, and Deno. Small files are 1 KB and large files are 10 to 50 MB, with 100 MB across the five large files. Adversarial files are filled with sequences that almost match the boundary, which forces extra work during boundary search. Lower is better.

To run the benchmarks and update these results:

```sh
pnpm run bench
pnpm run bench:update-readme
```

Set `BENCH_RUNTIMES`, such as `BENCH_RUNTIMES=node,bun`, to update the results for a subset of runtimes.

<!-- benchmarks:start -->

Last updated: 2026-11-25

Environment: Darwin 25.6.0, Apple M5 Pro

Versions: `multipart-parser@1.1.2`, `multipasta@0.2.5`, `busboy@1.6.0`, `@fastify/busboy@3.0.0` (`multipart-parser` at commit `8a8adc7b70`)

### Node.js v24.18.0

| Message                     | `multipart-parser` | `multipart-parser/future` |   `multipasta` |        `busboy` | `@fastify/busboy` |
| --------------------------- | -----------------: | ------------------------: | -------------: | --------------: | ----------------: |
| 1 small file                |     0.01 ms ± 0.02 |            0.01 ms ± 0.10 | 0.01 ms ± 0.04 |  0.04 ms ± 0.15 |    0.03 ms ± 0.08 |
| 1 large file                |     0.70 ms ± 0.02 |            0.76 ms ± 0.04 | 0.73 ms ± 0.05 |  2.06 ms ± 0.12 |    0.93 ms ± 0.07 |
| 100 small files             |     0.03 ms ± 0.01 |            0.06 ms ± 0.02 | 0.10 ms ± 0.01 |  0.29 ms ± 0.03 |    0.50 ms ± 0.21 |
| 5 large files               |     7.09 ms ± 0.05 |            7.56 ms ± 0.05 | 7.13 ms ± 0.13 | 20.22 ms ± 0.17 |    9.21 ms ± 0.16 |
| 1 large file (adversarial)  |     0.39 ms ± 0.06 |            0.37 ms ± 0.04 | 0.62 ms ± 0.27 |  0.46 ms ± 0.02 |    0.41 ms ± 0.04 |
| 5 large files (adversarial) |     4.21 ms ± 0.25 |            4.13 ms ± 0.19 | 6.48 ms ± 0.45 |  4.72 ms ± 0.11 |    4.49 ms ± 0.15 |

### Bun 1.4.4

| Message                     | `multipart-parser` | `multipart-parser/future` |   `multipasta` |        `busboy` | `@fastify/busboy` |
| --------------------------- | -----------------: | ------------------------: | -------------: | --------------: | ----------------: |
| 1 small file                |     0.01 ms ± 0.03 |            0.01 ms ± 0.04 | 0.01 ms ± 0.05 |  0.05 ms ± 0.24 |    0.03 ms ± 0.10 |
| 1 large file                |     0.47 ms ± 0.02 |            0.49 ms ± 0.02 | 0.66 ms ± 0.02 |  2.29 ms ± 0.10 |    0.64 ms ± 0.44 |
| 100 small files             |     0.02 ms ± 0.00 |            0.04 ms ± 0.00 | 0.13 ms ± 0.01 |  0.16 ms ± 0.02 |    0.24 ms ± 0.07 |
| 5 large files               |     4.89 ms ± 0.08 |            5.11 ms ± 0.10 | 6.85 ms ± 0.51 | 23.33 ms ± 0.94 |    5.85 ms ± 0.35 |
| 1 large file (adversarial)  |     0.34 ms ± 0.01 |            0.38 ms ± 0.02 | 0.62 ms ± 0.27 |  0.86 ms ± 0.02 |    0.41 ms ± 0.02 |
| 5 large files (adversarial) |     3.38 ms ± 0.21 |            3.69 ms ± 0.25 | 4.90 ms ± 0.40 |  8.95 ms ± 0.54 |    4.10 ms ± 0.34 |

### Deno 2.9.6

| Message                     | `multipart-parser` | `multipart-parser/future` |   `multipasta` |        `busboy` | `@fastify/busboy` |
| --------------------------- | -----------------: | ------------------------: | -------------: | --------------: | ----------------: |
| 1 small file                |     0.01 ms ± 0.02 |            0.02 ms ± 0.04 | 0.01 ms ± 0.05 |  0.03 ms ± 0.17 |    0.03 ms ± 0.09 |
| 1 large file                |    10.88 ms ± 0.24 |           10.35 ms ± 0.65 | 0.73 ms ± 0.03 |  2.12 ms ± 0.13 |   13.53 ms ± 1.23 |
| 100 small files             |     0.14 ms ± 0.01 |            0.17 ms ± 0.02 | 0.10 ms ± 0.01 |  0.14 ms ± 0.02 |    0.48 ms ± 0.13 |
| 5 large files               |   108.76 ms ± 1.39 |           97.34 ms ± 1.78 | 7.19 ms ± 0.10 | 20.87 ms ± 0.20 |  123.61 ms ± 0.43 |
| 1 large file (adversarial)  |    17.12 ms ± 0.12 |           17.02 ms ± 0.11 | 0.68 ms ± 0.09 |  1.08 ms ± 0.02 |   17.29 ms ± 0.18 |
| 5 large files (adversarial) |   174.43 ms ± 3.28 |          170.42 ms ± 0.77 | 6.92 ms ± 0.23 | 10.86 ms ± 0.12 |  172.93 ms ± 0.98 |

<!-- benchmarks:end -->

## Related Packages

- [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser) - Uses `multipart-parser` internally to parse multipart requests and generate `FileUpload`s for storage
- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Used internally to parse `Content-Disposition` and `Content-Type` metadata for each `MultipartPart`

## Credits

Thanks to Jacob Ebey who gave me several code reviews on this project prior to publishing.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
