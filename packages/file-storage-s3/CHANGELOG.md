# `file-storage-s3` CHANGELOG

This is the changelog for [`file-storage-s3`](https://github.com/remix-run/remix/tree/main/packages/file-storage-s3). It follows [semantic versioning](https://semver.org/).

## v1.1.0

### Minor Changes

- `storage.set()` now streams files to S3 instead of reading the whole file into memory first. Files larger than one part are sent with an S3 multipart upload, so memory use stays at about two parts per upload no matter how large the file is. Smaller files are still sent with a single `PUT`. Any `File`-shaped object works, including streaming sources that can only be read with `stream()` and don't know their size up front, which are sent to S3 as they're read. ([#12070](https://github.com/remix-run/remix/pull/12070))

  Use the new `partSize` option to set the part size, which defaults to 8 MiB and must be at least 5 MiB, the S3 minimum. If a multipart upload fails, it is aborted so S3 does not keep the uploaded parts. Consider also adding a bucket lifecycle rule that removes incomplete multipart uploads, in case a process exits before it can abort one.

  ```ts
  let storage = createS3FileStorage({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    bucket: 'my-app-uploads',
    region: 'us-east-1',
    partSize: 16 * 1024 * 1024,
  })
  ```

  `storage.put()` uses the same upload path, but it still holds the whole file in memory because it returns a `File` with the stored contents. Use `set()` for large files.

## v1.0.0

### Major Changes

- First stable release.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@1.0.0`](https://github.com/remix-run/remix/releases/tag/file-storage@1.0.0)

## v0.1.6

### Patch Changes

- Declare package modules as side-effect-free.

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.8`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.8)

## v0.1.5

### Patch Changes

- Reject empty S3 object keys and keys with period-only path segments instead of sending bucket-level requests or resolving them to a different object URL.

## v0.1.4

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.7`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.7)

## v0.1.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.6`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.6)

## v0.1.2

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.5`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.5)

## v0.1.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.4`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.4)

## v0.1.0

### Minor Changes

- #### Unreleased

  Initial release of `@remix-run/file-storage-s3`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`file-storage@0.13.3`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.3)

## Unreleased

### Minor Changes

- Initial release of `@remix-run/file-storage-s3`.
