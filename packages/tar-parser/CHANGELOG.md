# `tar-parser` CHANGELOG

This is the changelog for [`tar-parser`](https://github.com/remix-run/remix/tree/main/packages/tar-parser). It follows [semantic versioning](https://semver.org/).

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
