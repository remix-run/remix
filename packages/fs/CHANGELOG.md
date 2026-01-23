# `fs` CHANGELOG

This is the changelog for [`fs`](https://github.com/remix-run/remix/tree/main/packages/fs). It follows [semantic versioning](https://semver.org/).

## v0.4.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.4.0

### Minor Changes

- BREAKING CHANGE: Renamed `openFile()` to `openLazyFile()`, removed `getFile()`

  Since `LazyFile` no longer extends `File`, the function name now explicitly reflects the return type. The `getFile()` alias has also been removed—use `openLazyFile()` instead.

  **Migration:**

  ```ts
  import { openLazyFile } from '@remix-run/fs'

  let lazyFile = openLazyFile('./document.pdf')

  // Streaming
  let response = new Response(lazyFile.stream())

  // For non-streaming APIs that require a complete File (e.g. FormData)
  formData.append('file', await lazyFile.toFile())
  ```

  **Note:** `.toFile()` and `.toBlob()` read the entire file into memory. Only use these for non-streaming APIs that require a complete `File` or `Blob` (e.g. `FormData`). Always prefer `.stream()` if possible.

## v0.3.0 (2025-11-26)

- Move `@remix-run/lazy-file` and `@remix-run/mime` to `peerDependencies`

## v0.2.0 (2025-11-25)

- Replaced `mrmime` dependency with `@remix-run/mime` for MIME type detection

## v0.1.0 (2025-11-20)

Initial release with filesystem utilities extracted from `@remix-run/lazy-file/fs`.

See the [README](https://github.com/remix-run/remix/blob/main/packages/fs/README.md) for more details.
