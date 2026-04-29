# `data-schema` CHANGELOG

This is the changelog for [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema). It follows [semantic versioning](https://semver.org/).

## v0.3.0

### Minor Changes

- Add `Schema.transform()` for mapping validated schema outputs to new values and output types.

## v0.2.0

### Minor Changes

- Add `@remix-run/data-schema/form-data` with `object`, `field`, `fields`, `file`, and `files`
  helpers for validating `FormData` and `URLSearchParams` with `parse()` and `parseSafe()`.

### Patch Changes

- Remove unnecessary `as const` from `enum_()` examples in docs and tests since the `const` type parameter already preserves literal type inference.

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/data-schema`.

## v0.1.0

### Minor Changes

- Initial release.
