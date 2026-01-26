# `multipart-parser` CHANGELOG

This is the changelog for [`multipart-parser`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser). It follows [semantic versioning](https://semver.org/).

## v0.14.2

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.14.1

### Patch Changes

- Update `@remix-run/headers` peer dependency to use the new header parsing methods.

## v0.14.0 (2025-11-26)

- Move `@remix-run/headers` to `peerDependencies`

## v0.13.0 (2025-11-04)

- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.12.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v0.11.0 (2025-07-24)

- Renamed package from `@mjackson/multipart-parser` to `@remix-run/multipart-parser`

## v0.10.1 (2025-06-13)

- Add doc comments on custom error classes

## v0.10.0 (2025-06-13)

This release represents a major refactoring and simplification of this library from a `async`/promise-based architecture to a generator that suspends the parser as parts are found.

This is a reversion to the generator-based interface used before `v0.8` when I switched to a promise interface to get around deadlock issues with consuming part streams inside a `yield` suspension point. The deadlock occurred when trying to read `part.body` inside a `yield`, because the parser was suspended and wouldn't emit any more bytes to the stream while the consumer was waiting for the stream to complete.

With this release, I realized that instead of getting rid of the generator, which is actually a fantastic interface for a streaming parser, I should've gotten rid of the `part.body` stream instead and replaced it with a `part.content` property that contains all the content for that part. This gives us a better parser interface and also makes error handling simpler when e.g. the parser's `maxFileSize` is exceeded. This also makes the parser easier to use because you don't have to e.g. `await part.text()` anymore, and you have access to `part.size` up front.

- BREAKING CHANGE: `parseMultipart` and `parseMultipartRequest` are now generators that `yield` `MultipartPart` objects as they are parsed
- BREAKING CHANGE: `parseMultipart` no longer parses streams, use `parseMultipartStream` instead
- BREAKING CHANGE: `parser.parse()` is removed
- BREAKING CHANGE: `part.body`, `part.bodyUsed` are removed
- BREAKING CHANGE: `part.arrayBuffer`, `part.bytes`, `part.text` are now sync getters instead of `async` methods
- BREAKING CHANGE: Default `maxFileSize` is now 2MiB, same as PHP's default [`upload_max_filesize`](https://www.php.net/manual/en/ini.core.php#ini.upload-max-filesize)

New APIs:

- `parseMultipartStream(stream, options)` is a generator that parses a stream of data
- `parser.write(chunk)` and `parser.finish()` are low-level APIs for running the parser directly
- `part.content` is a `Uint8Array[]` of all content in that part
- `part.isText` is `true` if the part originates from a text field
- `part.size` is the total size of the content in bytes

If you're upgrading, check the README for current usage recommendations. Here's a high-level taste of the before/after of this release.

```ts
import { parseMultipartRequest } from '@remix-run/multipart-parser'

// before
await parseMultipartRequest(request, async (part) => {
  let buffer = await part.arrayBuffer()
  // ...
})

// after
for await (let part of parseMultipartRequest(request)) {
  let buffer = part.arrayBuffer
  // ...
}
```

## v0.9.0 (2025-06-10)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.8.2 (2025-02-04)

- Add `Promise<void>` to `MultipartPartHandler` return type

## v0.8.1 (2025-01-27)

- Fix bad publish that left a `workspace:^` version identifier in package.json

## v0.8.0 (2025-01-24)

This release improves error handling and simplifies some of the internals of the parser.

- BREAKING CHANGE: Change `parseMultipartRequest` and `parseMultipart` interfaces from `for await...of` to `await` + callback API.

```ts
import { parseMultipartRequest } from '@remix-run/multipart-parser'

// before
for await (let part of parseMultipartRequest(request)) {
  // ...
}

// after
await parseMultipartRequest(request, (part) => {
  // ...
})
```

This change greatly simplifies the implementation of `parseMultipartRequest`/`parseMultipart` and fixes a subtle bug that did not properly catch parse errors when `maxFileSize` was exceeded (see #28).

- Add `MaxHeaderSizeExceededError` and `MaxFileSizeExceededError` to make it easier to have finer-grained error handling.

```ts
import * as http from 'node:http'
import {
  MultipartParseError,
  MaxFileSizeExceededError,
  parseMultipartRequest,
} from '@remix-run/multipart-parser/node'

const tenMb = 10 * Math.pow(2, 20)

const server = http.createServer(async (req, res) => {
  try {
    await parseMultipartRequest(req, { maxFileSize: tenMb }, (part) => {
      // ...
    })
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      res.writeHead(413)
      res.end(error.message)
    } else if (error instanceof MultipartParseError) {
      res.writeHead(400)
      res.end('Invalid multipart request')
    } else {
      console.error(error)
      res.writeHead(500)
      res.end('Internal Server Error')
    }
  }
})
```

## v0.7.3 (2025-01-24)

- Add support for environments that do not support `ReadableStream.prototype[Symbol.asyncIterator]` (i.e. Safari), see #46

## v0.7.2 (2024-12-12)

- Fix dependency on `headers` in package.json

## v0.7.1 (2024-12-07)

- Re-export everything from `multipart-parser/node`. If you're using `multipart-parser/node`, you should `import` everything from there. Don't import anything from `multipart-parser`.

- ## v0.7.0 (2024-11-14)

- Added CommonJS build

## v0.6.3 (2024-09-05)

- Moved to a new monorepo

## v0.6.2 (2024-08-19)

- Provide correct type for `part.arrayBuffer()`
- `part.isFile` now correctly detects `part.mediaType === 'application/octet-stream'`

## v0.6.1 (2024-08-18)

- More small performance improvements

## v0.6.0 (2024-08-17)

- BREAKING: Removed some low-level API (`parser.push()` and `parser.reset()`) that was duplicating higher-level API. Use `parser.parse()` instead.
- Added `parser.maxHeaderSize` and `parser.maxFileSize` properties
- Small performance improvements when parsing large files

## v0.5.0 (2024-08-15)

- Change default `maxFileSize` from 10 MB to `Infinity`
- Simplify internal buffer management and search, which leads to more consistent chunk flow when handling large file uploads

## v0.4.2 (2024-08-13)

- Fix bug where max file size exceeded error would crash Node.js servers (https://github.com/mjackson/multipart-parser/issues/8)

## v0.4.1 (2024-08-12)

- Add `type` keyword to `MultipartParserOptions` export for Deno (https://github.com/mjackson/multipart-parser/pull/11)

## v0.4.0 (2024-08-12)

- Switch dependency from `fetch-super-headers` to `@remix-run/headers`
- Use `for await...of` to iterate over `ReadableStream` internally. This will also cancel the stream when the loop exits from e.g. an error in a user-defined `part` handler.
