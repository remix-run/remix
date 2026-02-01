# `static-middleware` CHANGELOG

This is the changelog for [`static-middleware`](https://github.com/remix-run/remix/tree/main/packages/static-middleware). It follows [semantic versioning](https://semver.org/).

## v0.4.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`@remix-run/fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)

## v0.4.2

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.4.1

### Patch Changes

- Update `@remix-run/fs` peer dependency to use new `openLazyFile()` API

## v0.4.0 (2025-11-25)

- BREAKING CHANGE: Replace `mrmime` dependency with `@remix-run/mime` for MIME type detection which is now a peer dependency.

- Add support for `acceptRanges` function to conditionally enable HTTP Range requests based on the file being served:

  ```ts
  // Enable ranges only for large files
  staticFiles('./public', {
    acceptRanges: (file) => file.size > 10 * 1024 * 1024,
  })

  // Enable ranges only for videos
  staticFiles('./public', {
    acceptRanges: (file) => file.type.startsWith('video/'),
  })
  ```

## v0.3.0 (2025-11-25)

- BREAKING CHANGE: Now uses `@remix-run/response` for file and HTML responses instead of `@remix-run/fetch-router/response-helpers`. The `@remix-run/response` package is now a peer dependency.
- Add `listFiles` option to generate a directory listing when a directory is requested.

  ```ts
  staticFiles('./public', { listFiles: true })
  ```

## v0.2.0 (2025-11-20)

- Read the request method from `context.method` instead of `context.request.method`, so it's compatible with the [`method-override` middleware](https://github.com/remix-run/remix/tree/main/packages/method-override-middleware)
- Add `@remix-run/fs` as a peer dependency. This package now imports from `@remix-run/fs` instead of `@remix-run/lazy-file/fs`.
- Add `index` option to configure which files to serve when a directory is requested. When a request targets a directory, the middleware will try each index file in order until one is found. Defaults to `['index.html', 'index.htm']`. Supports boolean shortcuts: `true` for defaults, `false` to disable.

  ```ts
  // Serve index.html from directories by default
  staticFiles('./public')

  // Custom index files
  staticFiles('./public', {
    index: ['default.html', 'home.html'],
  })

  // Disable index file serving
  staticFiles('./public', { index: false })
  staticFiles('./public', { index: [] })
  ```

## v0.1.0 (2025-11-19)

Initial release extracted from `@remix-run/fetch-router` v0.9.0.

See the [README](https://github.com/remix-run/remix/blob/main/packages/static-middleware/README.md) for more details.
