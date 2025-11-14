# `response` CHANGELOG

This is the changelog for [`response`](https://github.com/remix-run/remix/tree/main/packages/response). It follows [semantic versioning](https://semver.org/).

## Unreleased

- Adds "utf-8" to Content-Type of text file responses

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
