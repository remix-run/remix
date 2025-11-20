# `lazy-file` CHANGELOG

This is the changelog for [`lazy-file`](https://github.com/remix-run/remix/tree/main/packages/lazy-file). It follows [semantic versioning](https://semver.org/).

## Unreleased

- BREAKING CHANGE: Removed `lazy-file/fs` export. Use `@remix-run/fs` package instead.

  ```ts
  // before
  import { openFile, writeFile } from '@remix-run/lazy-file/fs'

  // after
  import { openFile, writeFile } from '@remix-run/fs'
  ```

- Replaced `mrmime` dependency with `@remix-run/mime` for MIME type detection

## v3.8.0 (2025-11-18)

- BREAKING CHANGE: `openFile()` now sets `file.name` to the `filename` argument as provided, instead of using `path.basename(filename)`. You can still override this with `options.name`.

```ts
// before
let file = openFile('./public/assets/favicon.ico')
file.name // "favicon.ico"

// after
let file = openFile('./public/assets/favicon.ico')
file.name // "./public/assets/favicon.ico"

// You can still override the name
let file = openFile('./public/assets/favicon.ico', { name: 'favicon.ico' })
file.name // "favicon.ico"
```

## v3.7.0 (2025-11-04)

- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.
- Fix type errors in TypeScript 5.7+ when using typed arrays

## v3.6.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v3.5.0 (2025-07-21)

- Renamed package from `@mjackson/lazy-file` to `@remix-run/lazy-file`

## v3.4.0 (2025-06-10)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v3.3.1 (2025-01-25)

- Handle stream errors in `lazy-file/fs`' `writeFile`. When there is an error in the stream, call `writeStream.end()` on the underlying file stream before rejecting the promise.

## v3.3.0 (2024-11-14)

- Add CommonJS build

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
