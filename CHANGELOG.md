# lazy-file CHANGELOG

## HEAD

- Added `getFile` helper to `lazy-file/fs` export for reading files from the local filesystem

## v2.0.0 (Aug 23, 2024)

- BREAKING: Do not automatically propagate `name` and `lastModified` in `file.slice()`. This matches the behavior of `File` more closely
- BREAKING: Remove `LazyFile[Symbol.asyncIterator]` to match the behavior of `File` more closely
- In `slice(start, end)` make `end` default to `size` instead of `Infinity`. This more closely matches the `File` spec
- Small perf improvement when streaming content arrays with Blobs in them and ending early

## v1.1.0 (Aug 22, 2024)

- Add ability to initialize a LazyFile with `BlobPart[]`, just like a normal `File`
- Add async iterator support to LazyFile

## v1.0.0 (Aug 21, 2024)

- Initial release
