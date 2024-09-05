## v0.4.0 (2024-09-05)

- Allow passing `MultipartParserOptions` as optional 3rd arg to `parseFormData()`

## v0.3.0 (2024-09-05)

- Make `FileUpload` implement the `File` interface instead of extending `File` (fixes https://github.com/mjackson/form-data-parser/issues/4)
- Allow returning `null` from an upload handler, so it allows `return fileStorage.get(key)` without type errors

## v0.2.0 (2024-08-28)

- Add missing `FileUpload` export 🤦‍♂️

## v0.1.0 (2024-08-24)

- Initial release
