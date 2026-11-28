# `data-schema` CHANGELOG

This is the changelog for [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema). It follows [semantic versioning](https://semver.org/).

## v1.0.2

### Patch Changes

- `bigint()` from `remix/data-schema/coerce` now rejects strings longer than 4,096 UTF-16 code units, including surrounding whitespace, with an `Expected bigint string of at most 4096 characters` issue. This bounds the work `BigInt()` does on untrusted input such as form fields and query parameters. ([#12423](https://github.com/remix-run/remix/pull/12423))

- Fix `object()` and `record()` results missing keys that passed validation. Declared fields, passthrough fields, and keys produced by record key transforms are now always own properties of the result. ([#12373](https://github.com/remix-run/remix/pull/12373))

## v1.0.1

### Patch Changes

- Inspect typed object fields and validation metadata with `getSchemaMetadata()` from `remix/data-schema/experimental`, without running validators or default factories. This experimental export may change or be removed in patch releases. ([#12206](https://github.com/remix-run/remix/pull/12206))

- Validate native form submissions with `remix/data-schema/experimental/form`, reusing ordinary schemas, checks, and transforms. Field helpers decode native controls, repeated values, and files. `parse()` returns validated output, while `parseSafe()` failures include restorable values and grouped errors, omitting sensitive values and files. These experimental APIs may change or be removed in patch releases. ([#12206](https://github.com/remix-run/remix/pull/12206))

## v1.0.0

### Major Changes

- First stable release.

## v0.3.1

### Patch Changes

- Reduce allocations and improve throughput when validating nested schemas and arrays, while preserving stable paths for custom validators and error maps (see #11689).

## v0.3.0

### Minor Changes

- Add `Schema.transform()` for mapping validated schema outputs to new values and output types.

## v0.2.0

### Minor Changes

- Add `@remix-run/data-schema/form-data` with `object`, `field`, `fields`, `file`, and `files` helpers for validating `FormData` and `URLSearchParams` with `parse()` and `parseSafe()`.

### Patch Changes

- Remove unnecessary `as const` from `enum_()` examples in docs and tests since the `const` type parameter already preserves literal type inference.

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/data-schema`.

## v0.1.0

### Minor Changes

- Initial release.
