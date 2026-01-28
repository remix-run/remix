# `form-data-parser` CHANGELOG

This is the changelog for [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser). It follows [semantic versioning](https://semver.org/).

## v0.15.0

### Minor Changes

- Bump multipart-parser dependency to 0.14.2

## v0.14.0 (2025-11-05)

- Build using `tsc` instead of `esbuild`. This means modules in the `dist` directory now mirror the layout of modules in the `src` directory.

## v0.13.0 (2025-11-04)

- Throw `FormDataParseError` when the request body is malformed multipart/form-data. The underlying `MultipartParseError` is its `cause`.

## v0.12.0 (2025-10-22)

- BREAKING CHANGE: Removed CommonJS build. This package is now ESM-only. If you need to use this package in a CommonJS project, you will need to use dynamic `import()`.

## v0.11.0 (2025-10-05)

- Make `options` optional in `parseFormData` signature
- Export `ParseFormDataOptions` type

## v0.10.1 (2025-07-24)

- Update to `@remix-run/multipart-parser` v0.11.0

## v0.10.0 (2025-07-24)

- Renamed package from `@mjackson/form-data-parser` to `@remix-run/form-data-parser`

## v0.9.1 (2025-06-13)

- Export `FormDataParserError` and `MaxFilesExceededError`
- Re-export `MultipartParseError`, `MaxHeaderSizeExceededError`, and `MaxFileSizeExceededError` from multipart parser

## v0.9.0 (2025-06-13)

This release updates to `multipart-parser` 0.10.0 and removes the restrictions on checking the `size` and/or `slice`ing `FileUpload` objects.

- `FileUpload` is now a normal subclass of `File` with all the same functionality (instead of just implementing the same interface)
- Add `maxFiles` option to `parseFormData` to allow limiting the number of files uploaded in a single request

```ts
let formData = await parseFormData(request, { maxFiles: 5 })
let file = formData.get('file-upload')
let size = file.size // This is ok now!
```

## v0.8.0 (2025-06-10)

- Add `/src` to npm package, so "go to definition" goes to the actual source
- Use one set of types for all built files, instead of separate types for ESM and CJS
- Build using esbuild directly instead of tsup

## v0.7.0 (2025-01-25)

- BREAKING CHANGE: Override `parseFormData` signature so the upload handler is always last in the argument list. `parserOptions` are now an optional 2nd arg.

```ts
import { parseFormData } from '@remix-run/form-data-parser'

// before
await parseFormData(
  request,
  (fileUpload) => {
    // ...
  },
  { maxFileSize },
)

// after
await parseFormData(request, { maxFileSize }, (fileUpload) => {
  // ...
})
```

- Upgrade [`multipart-parser`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser) to v0.8 to fix an issue where errors would crash the process when `maxFileSize` was exceeded (see #28)
- Add a [demo of how to use `form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser/demos/node) together with [`file-storage`](https://github.com/remix-run/remix/tree/main/packages/file-storage) to handle multipart uploads on Node.js
- Expand `FileUploadHandler` interface to support returning `Blob` from the upload handler, which is the superclass of `File`

## v0.6.0 (2025-01-15)

- Allow upload handlers to run in parallel. Fixes #44

## v0.5.1 (2024-12-12)

- Fix dependency on `headers` in package.json

## v0.5.0 (2024-11-14)

- Added CommonJS build

## v0.4.0 (2024-09-05)

- Allow passing `MultipartParserOptions` as optional 3rd arg to `parseFormData()`

## v0.3.0 (2024-09-05)

- Make `FileUpload` implement the `File` interface instead of extending `File` (fixes https://github.com/mjackson/form-data-parser/issues/4)
- Allow returning `null` from an upload handler, so it allows `return fileStorage.get(key)` without type errors

## v0.2.0 (2024-08-28)

- Add missing `FileUpload` export 🤦‍♂️

## v0.1.0 (2024-08-24)

- Initial release
