# `multipart-parser` CHANGELOG

This is the changelog for [`multipart-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser). It follows [semantic versioning](https://semver.org/).

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

- Switch dependency from `fetch-super-headers` to `@mjackson/headers`
- Use `for await...of` to iterate over `ReadableStream` internally. This will also cancel the stream when the loop exits from e.g. an error in a user-defined `part` handler.
