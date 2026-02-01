# `response` CHANGELOG

This is the changelog for [`response`](https://github.com/remix-run/remix/tree/main/packages/response). It follows [semantic versioning](https://semver.org/).

## v0.3.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.3.0

### Minor Changes

- `createFileResponse()` is now generic and accepts any file-like object

  The function now accepts any object satisfying the `FileLike` interface, which includes both native `File` and `LazyFile` from `@remix-run/lazy-file`. This change supports the updated `LazyFile` class which no longer extends native `File`.

  The generic type flows through to the `digest` callback in options, so you get the exact type you passed in:

  ```ts
  // With native File - digest receives File
  createFileResponse(nativeFile, request, {
    digest: async (file) => {
      /* file is typed as File */
    },
  })

  // With LazyFile - digest receives LazyFile
  createFileResponse(lazyFile, request, {
    digest: async (file) => {
      /* file is typed as LazyFile */
    },
  })
  ```

- Add `redirect` export which is a shorthand alias for `createRedirectResponse`

### Patch Changes

- Update `@remix-run/headers` peer dependency to use the new header parsing methods.

## v0.2.1 (2025-12-18)

- `createFileResponse` now includes `charset` in Content-Type for text-based files.

## v0.2.0 (2025-11-25)

- BREAKING CHANGE: Add `@remix-run/mime` as a peer dependency. This package is used by the `createFileResponse()` response helper to determine if HTTP Range requests should be supported by default for a given MIME type.

- Add `compressResponse` helper

- The `createFileResponse()` response helper now only enables HTTP Range requests by default for non-compressible MIME types. This allows text-based assets to be compressed while still supporting resumable downloads for media files.

  To restore the previous behavior where all files support range requests:

  ```ts
  return createFileResponse(file, request, {
    acceptRanges: true,
  })
  ```

  Note: Range requests and compression are mutually exclusive. When `Accept-Ranges: bytes` is present in response headers, the `compress()` response helper and `compression()` middleware will not compress the response.

## v0.1.0 (2025-11-25)

Initial release with response helpers extracted from `@remix-run/fetch-router`.

See the [README](https://github.com/remix-run/remix/blob/main/packages/response/README.md) for more details.
