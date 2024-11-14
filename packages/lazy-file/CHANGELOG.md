## HEAD

- Added CommonJS build

## v3.2.0 (2024-09-12)

- Export `OpenFileOptions` from `lazy-file/fs`

## v3.1.0 (2024-09-04)

- Add writeFile method to `lazy-file/fs` and rename `getFile` => `openFile`
- Accept an open file descriptor or file handle in `writeFile(fd)`

## v3.0.0 (2024-08-25)

- BREAKING: Do not accept regular string argument to `LazyFile`. This more closely matches `File` behavior
- BREAKING: Move 4th `LazyFile()` argument `range` into `options.range`
- BREAKING: Renamed `LazyFileContent` interface to `LazyContent` and `content.read()` => `content.stream()`
- Added `LazyBlob` (`Blob` subclass) as a complement to `LazyFile`
- Added `LazyBlobOptions` and `LazyFileOptions` interfaces (`endings` is not supported)
- Return a `name`-less `Blob` from `file.slice()` to more closely match native `File` behavior

## v2.2.0 (2024-08-24)

- Added support for `getFile(, { lastModified })` to override `file.lastModified`
- Export `GetFileOptions` interface from `lazy-file/fs`

## v2.1.0 (2024-08-24)

- Added `getFile` helper to `lazy-file/fs` export for reading files from the local filesystem

## v2.0.0 (2024-08-23)

- BREAKING: Do not automatically propagate `name` and `lastModified` in `file.slice()`. This matches the behavior of `File` more closely
- BREAKING: Remove `LazyFile[Symbol.asyncIterator]` to match the behavior of `File` more closely
- In `slice(start, end)` make `end` default to `size` instead of `Infinity`. This more closely matches the `File` spec
- Small perf improvement when streaming content arrays with Blobs in them and ending early

## v1.1.0 (2024-08-22)

- Add ability to initialize a LazyFile with `BlobPart[]`, just like a normal `File`
- Add async iterator support to LazyFile

## v1.0.0 (2024-08-21)

- Initial release
