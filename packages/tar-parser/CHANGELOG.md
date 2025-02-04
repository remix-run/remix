# `tar-parser` CHANGELOG

This is the changelog for [`tar-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/tar-parser). It follows [semantic versioning](https://semver.org/).

## HEAD

- Add `Promise<void>` to `TarEntryHandler` return type

## v0.2.1 (2025-01-24)

- Add support for environments that do not support `ReadableStream.prototype[Symbol.asyncIterator]` (i.e. Safari), see #46

## v0.2.0 (2025-01-07)

- Fix a bug that hangs the process when trying to read zero-length entries.

## v0.1.0 (2024-12-06)

- Initial release
