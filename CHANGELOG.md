# `multipart-parser` CHANGELOG

## v0.4.2 (Aug 13, 2024)

- Fix bug where max file size exceeded error would crash Node.js servers (https://github.com/mjackson/multipart-parser/issues/8)

## v0.4.1 (Aug 12, 2024)

- Add `type` keyword to `MultipartParserOptions` export for Deno (https://github.com/mjackson/multipart-parser/pull/11)

## v0.4.0 (Aug 12, 2024)

- Switch dependency from `fetch-super-headers` to `@mjackson/headers`
- Use `for await...of` to iterate over `ReadableStream` internally. This will also cancel the stream when the loop exits from e.g. an error in a user-defined `part` handler.
