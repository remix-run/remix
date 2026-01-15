# `mime` CHANGELOG

This is the changelog for [`mime`](https://github.com/remix-run/remix/tree/main/packages/mime). It follows [semantic versioning](https://semver.org/).

## v0.3.0

### Minor Changes

- Add `defineMimeType()` for registering custom MIME types. This allows adding support for file extensions not included in the defaults, or overriding existing behavior. Custom registrations take precedence over built-in types.

  ```ts
  import { defineMimeType, detectMimeType } from '@remix-run/mime'

  defineMimeType({
    extensions: 'myformat',
    mimeType: 'application/x-myformat',
  })

  detectMimeType('file.myformat') // 'application/x-myformat'
  ```

## v0.2.0 (2025-12-18)

- Add `detectContentType(extension)` function that returns a Content-Type header value with `charset` for text-based types.

- Add `mimeTypeToContentType(mimeType)` function that converts a MIME type to a Content-Type header value, adding `charset` for text-based types.

## v0.1.0 (2025-11-25)

Initial release of this package.

See the [README](https://github.com/remix-run/remix/blob/main/packages/mime/README.md) for more details.
