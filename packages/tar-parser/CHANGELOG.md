# `tar-parser` CHANGELOG

This is the changelog for [`tar-parser`](https://github.com/remix-run/remix/tree/main/packages/tar-parser). It follows [semantic versioning](https://semver.org/).

## v0.8.0

### Minor Changes

- BREAKING CHANGE: `parseTarHeader()`, `parseTar()`, and `TarParser` now default to `pathPolicy: 'relative'`, throwing `TarParseError` for empty entry names or link targets, absolute paths, Windows drive prefixes, backslashes, and embedded NULs. Entry names cannot contain `..` path components. Symlink targets are checked relative to the link's parent directory, and hard-link targets relative to the archive root; `..` components are allowed only when resolution stays within the archive. Valid paths retain their spelling, including nested paths, `./` prefixes, and trailing directory slashes. Applications that need to inspect or process unrestricted archive paths can opt into `pathPolicy: 'preserve'`:

  ```diff
  -await parseTar(archive, handleEntry)
  +await parseTar(archive, { pathPolicy: 'preserve' }, handleEntry)
  ```

  The same option works with `parseTarHeader()` and `new TarParser()`. It does not disable archive limits or header structure validation. Path validation applies after ustar prefixes and GNU/PAX overrides, before an entry reaches the handler. GNU long names and link targets now omit their terminating NUL under either policy. Extractors must still enforce containment on their destination filesystem, including when existing or archived symlinks are present.

- BREAKING CHANGE: `parseTar()` and `TarParser` now default to limits of 2 MiB per entry body, 20 MiB of total archive input, and 5,000 entries, where previously none were limited. Applications processing larger archives must configure `maxEntrySize`, `maxTotalSize`, and `maxEntries` to raise the applicable limits, or set any limit to `Infinity` to disable it:

  ```diff
  -await parseTar(archive, handleEntry)
  +await parseTar(
  +  archive,
  +  { maxEntrySize: Infinity, maxTotalSize: Infinity, maxEntries: Infinity },
  +  handleEntry,
  +)
  ```

  The entry size and count limits include PAX/GNU metadata entries and are checked before reading their bodies or invoking entry handlers. Padding and end markers do not count as entries. The total size limit counts all input bytes, including headers, padding, and metadata, after any upstream decompression. Exceeding a limit throws the exported `MaxEntrySizeExceededError`, `MaxTotalSizeExceededError`, or `MaxEntriesExceededError`, all extending `TarParseError`.

  Global PAX metadata now applies to subsequent entries even without a local PAX header, so global sizes are parsed and checked against the entry limit. Local PAX values continue to take precedence.

### Patch Changes

- Buffer `TarEntry` content using the bytes received, validate octal, base-256, and PAX entry sizes, and reject unfinished body readers when archive parsing fails.

- Reduce allocation and copying when GNU or PAX metadata arrives in small chunks. Metadata buffering grows with the bytes received and continues to honor the configured archive limits.

## v0.7.1

### Patch Changes

- Fix parsing tar entries whose file body ends exactly at a chunk boundary.

## v0.7.0 (2025-11-20)

- Update dev dependencies to use `@remix-run/fs` instead of `@remix-run/lazy-file/fs`.

## v0.6.0 (2025-11-04)

- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.5.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v0.4.0 (2025-07-24)

- Renamed package from `@mjackson/tar-parser` to `@remix-run/tar-parser`

## v0.3.0 (2025-06-06)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.2.2 (2025-02-04)

- Add `Promise<void>` to `TarEntryHandler` return type

## v0.2.1 (2025-01-24)

- Add support for environments that do not support `ReadableStream.prototype[Symbol.asyncIterator]` (i.e. Safari), see #46

## v0.2.0 (2025-01-07)

- Fix a bug that hangs the process when trying to read zero-length entries.

## v0.1.0 (2024-12-06)

- Initial release
