# multipart-parser CHANGELOG

## v0.6.2 (Aug 19, 2024)

- Provide correct type for `part.arrayBuffer()`
- `part.isFile` now correctly detects `part.mediaType === 'application/octet-stream'`

## v0.6.1 (Aug 18, 2024)

- More small performance improvements

## v0.6.0 (Aug 17, 2024)

- BREAKING: Removed some low-level API (`parser.push()` and `parser.reset()`) that was duplicating higher-level API. Use `parser.parse()` instead.
- Added `parser.maxHeaderSize` and `parser.maxFileSize` properties
- Small performance improvements when parsing large files

## v0.5.0 (Aug 15, 2024)

- Change default `maxFileSize` from 10 MB to `Infinity`
- Simplify internal buffer management and search, which leads to more consistent chunk flow when handling large file uploads

## v0.4.2 (Aug 13, 2024)

- Fix bug where max file size exceeded error would crash Node.js servers (https://github.com/mjackson/multipart-parser/issues/8)

## v0.4.1 (Aug 12, 2024)

- Add `type` keyword to `MultipartParserOptions` export for Deno (https://github.com/mjackson/multipart-parser/pull/11)

## v0.4.0 (Aug 12, 2024)

- Switch dependency from `fetch-super-headers` to `@mjackson/headers`
- Use `for await...of` to iterate over `ReadableStream` internally. This will also cancel the stream when the loop exits from e.g. an error in a user-defined `part` handler.
