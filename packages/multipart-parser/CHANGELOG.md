# `multipart-parser` CHANGELOG

This is the changelog for [`multipart-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser). It follows [semantic versioning](https://semver.org/).

## v0.8.2 (2025-02-04)

- Add `Promise<void>` to `MultipartPartHandler` return type

## v0.8.1 (2025-01-27)

- Fix bad publish that left a `workspace:^` version identifier in package.json

## v0.8.0 (2025-01-24)

This release improves error handling and simplifies some of the internals of the parser.

- BREAKING CHANGE: Change `parseMultipartRequest` and `parseMultipart` interfaces from `for await...of` to `await` + callback API.

```ts
import { parseMultipartRequest } from '@mjackson/multipart-parser';

// before
for await (let part of parseMultipartRequest(request)) {
  // ...
}

// after
await parseMultipartRequest(request, (part) => {
  // ...
});
```

This change greatly simplifies the implementation of `parseMultipartRequest`/`parseMultipart` and fixes a subtle bug that did not properly catch parse errors when `maxFileSize` was exceeded (see #28).

- Add `MaxHeaderSizeExceededError` and `MaxFileSizeExceededError` to make it easier to have finer-grained error handling.

```ts
import * as http from 'node:http';
import {
  MultipartParseError,
  MaxFileSizeExceededError,
  parseMultipartRequest,
} from '@mjackson/multipart-parser/node';

const tenMb = 10 * Math.pow(2, 20);

const server = http.createServer(async (req, res) => {
  try {
    await parseMultipartRequest(req, { maxFileSize: tenMb }, (part) => {
      // ...
    });
  } catch (error) {
    if (error instanceof MaxFileSizeExceededError) {
      res.writeHead(413);
      res.end(error.message);
    } else if (error instanceof MultipartParseError) {
      res.writeHead(400);
      res.end('Invalid multipart request');
    } else {
      console.error(error);
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
});
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

- Switch dependency from `fetch-super-headers` to `@mjackson/headers`
- Use `for await...of` to iterate over `ReadableStream` internally. This will also cancel the stream when the loop exits from e.g. an error in a user-defined `part` handler.
