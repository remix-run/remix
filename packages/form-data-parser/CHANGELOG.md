# `form-data-parser` CHANGELOG

This is the changelog for [`form-data-parser`](https://github.com/remix-run/remix/tree/main/packages/form-data-parser). It follows [semantic versioning](https://semver.org/).

## v1.1.0

### Minor Changes

- Add a `@remix-run/form-data-parser/future` entrypoint where `parseFormData()` streams file uploads to your upload handler instead of buffering them. Future APIs are not stable and may change in any release, but they are a good indication of where this package will land in its next major release. ([#12030](https://github.com/remix-run/remix/pull/12030))

  The future `FileUpload` is yielded as soon as the part's headers arrive, and its contents stream from the request body as you read them, so you can write a large upload to storage without holding it in memory. It has the same shape as `File`, with these differences:
  - Its contents can be read once, and only while the upload handler is running
  - `size` throws until the contents have been read
  - `slice()` is not supported

  If the upload handler returns a `FileUpload` without reading it, or there is no upload handler, `parseFormData()` reads it into a regular `File` and puts that in the `FormData`.

  ```ts
  import { parseFormData } from '@remix-run/form-data-parser/future'

  let formData = await parseFormData(request, async (fileUpload) => {
    let storageKey = crypto.randomUUID()
    await fileStorage.set(storageKey, fileUpload)
    return storageKey
  })
  ```

  Streaming makes large uploads faster and keeps memory flat, because the upload handler can start writing a file as soon as its first bytes arrive instead of after the whole file has been buffered. Measured on Node.js 24.18 with an Apple M5 Pro, as the median of 7 runs that each use a fresh process, with an upload handler that streams each file to storage:

  | Request                     | Total time (stable → future) | Time until the upload handler is called | Peak memory growth   |
  | --------------------------- | ---------------------------- | --------------------------------------- | -------------------- |
  | 1 × 100 MiB file            | 67.7 ms → 36.6 ms            | 45.4 ms → 0.2 ms                        | 396 MiB → 29 MiB     |
  | 5 × 20 MiB files            | 60.2 ms → 36.3 ms            | 9.5 ms → 0.2 ms                         | 165 MiB → 19 MiB     |
  | 10 fields and an 8 KiB file | 0.58 ms → 0.52 ms            | 0.51 ms → 0.42 ms                       | No measurable change |

  `ParseFormDataOptions`, `FormDataParseError`, `MaxFilesExceededError`, and the re-exported multipart parser errors are shared with the stable entrypoint, so `instanceof` checks work with either.

  If your app handles file uploads, please give `@remix-run/form-data-parser/future` a try and tell us how it goes in [GitHub Discussions](https://github.com/remix-run/remix/discussions). We'd especially like to hear about anything that breaks, behaves unexpectedly, or feels awkward, since that feedback will shape the next major release.

### Patch Changes

- Fixed a memory leak when streaming uploaded files on Node.js versions before 24.20.0 and 26.6.0. Reading a `FileUpload` with `file.stream()`, including when saving it with `writeFile` from `@remix-run/fs` or the filesystem backend of `@remix-run/file-storage`, kept every uploaded file in memory for the life of the process because of a Node.js bug (https://github.com/nodejs/node/issues/63574). `FileUpload` now streams its contents in slices, so uploaded files are freed once they are no longer referenced. ([#12029](https://github.com/remix-run/remix/pull/12029))

- Bumped `@remix-run/*` dependencies:
  - [`headers@1.0.1`](https://github.com/remix-run/remix/releases/tag/headers@1.0.1)
  - [`multipart-parser@1.1.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@1.1.0)

## v1.0.0

### Major Changes

- First stable release.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`headers@1.0.0`](https://github.com/remix-run/remix/releases/tag/headers@1.0.0)
  - [`multipart-parser@1.0.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@1.0.0)

## v0.17.7

### Patch Changes

- Declare package modules as side-effect-free.

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.21.3`](https://github.com/remix-run/remix/releases/tag/headers@0.21.3)
  - [`multipart-parser@0.16.6`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.6)

## v0.17.6

### Patch Changes

- Apply upload handlers and parser limits consistently for mixed-case form media types. Reject unsupported media types before reading the request body, including on Bun, so they cannot bypass parser limits.

- Bumped `@remix-run/*` dependencies:
  - [`headers@0.21.2`](https://github.com/remix-run/remix/releases/tag/headers@0.21.2)
  - [`multipart-parser@0.16.5`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.5)

## v0.17.5

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.16.4`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.4)

## v0.17.4

### Patch Changes

- Apply `maxParts` and `maxTotalSize` limits when parsing `application/x-www-form-urlencoded` requests with `parseFormData()`, so urlencoded submissions can no longer bypass the same field count and total body size protections used for multipart forms.

## v0.17.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.16.3`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.3)

## v0.17.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.16.2`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.2)

## v0.17.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.16.1`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.1)

## v0.17.0

### Minor Changes

- BREAKING CHANGE: Errors thrown or rejected by a `parseFormData()` upload handler now propagate directly instead of being wrapped in a `FormDataParseError`.

### Patch Changes

- Preserve non-ASCII multipart field names and filenames when parsing `multipart/form-data` requests.

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.16.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.16.0)

## v0.16.0

### Minor Changes

- BREAKING CHANGE: `parseFormData()` now enforces finite default multipart `maxParts` and `maxTotalSize` limits and surfaces multipart limit failures directly instead of treating them as generic parse noise.

  Apps that intentionally accept large multipart submissions may need to raise these limits explicitly.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`multipart-parser@0.15.0`](https://github.com/remix-run/remix/releases/tag/multipart-parser@0.15.0)

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

- Export `FormDataParseError` and `MaxFilesExceededError`
- Re-export `MultipartParseError`, `MaxHeaderSizeExceededError`, and `MaxFileSizeExceededError` from multipart parser

## v0.9.0 (2025-06-13)

This release updates to `multipart-parser` 0.10.0 and removes the restrictions on checking the `size` and/or `slice`ing `FileUpload` objects.

- `FileUpload` is now a normal subclass of `File` with all the same functionality (instead of just implementing the same interface)
- Add `maxFiles` option to `parseFormData` to allow limiting the number of files uploaded in a single request
- BREAKING CHANGE: `parseFormData()` now defaults to `maxFiles = 20`; set `maxFiles` explicitly to allow larger batch uploads.

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
