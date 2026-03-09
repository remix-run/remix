# `data-table` CHANGELOG

This is the changelog for [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table). It follows [semantic versioning](https://semver.org/).

## v0.1.0

### Minor Changes

- Add support for cross-schema column resolution

- Initial release of `@remix-run/data-table`.

- Make `createTable()` results Standard Schema-compatible so tables can be used directly with `parse()`/`parseSafe()` from `remix/data-schema`.

  Table parsing now mirrors write validation semantics used by `create()`/`update()`: partial objects are accepted, provided values are parsed via column schemas, and unknown columns are rejected.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-schema@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.1.0)

## v0.1.0

### Minor Changes

- Initial release.
