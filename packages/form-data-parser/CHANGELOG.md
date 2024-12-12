# `form-data-parser` CHANGELOG

This is the changelog for [`form-data-parser`](https://github.com/mjackson/remix-the-web/tree/main/packages/form-data-parser). It follows [semantic versioning](https://semver.org/).

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
