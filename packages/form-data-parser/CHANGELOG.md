# `form-data-parser` CHANGELOG

This is the changelog for [`form-data-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/form-data-parser). It follows [semantic versioning](https://semver.org/).

## v0.7.0 (2025-01-25)

- BREAKING CHANGE: Override `parseFormData` signature so the upload handler is always last in the argument list. `parserOptions` are now an optional 2nd arg.

```ts
import { parseFormData } from '@mjackson/form-data-parser';

// before
await parseFormData(
  request,
  (fileUpload) => {
    // ...
  },
  { maxFileSize },
);

// after
await parseFormData(request, { maxFileSize }, (fileUpload) => {
  // ...
});
```

- Upgrade [`multipart-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/multipart-parser) to v0.8 to fix an issue where errors would crash the process when `maxFileSize` was exceeded (see #28)
- Add an [example of how to use `form-data-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/form-data-parser/examples/node) together with [`file-storage`](https://github.com/mjackson/remix-the-web/tree/main/packages/file-storage) to handle multipart uploads on Node.js
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
