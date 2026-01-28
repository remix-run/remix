# `form-data-middleware` CHANGELOG

This is the changelog for [`form-data-middleware`](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware). It follows [semantic versioning](https://semver.org/).

## v0.1.3

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`@remix-run/fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)
  - [`@remix-run/form-data-parser@0.15.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.15.0)

## v0.1.2

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.1.1 (2025-12-06)

- Explicitly set `context.formData` in all `POST` cases, even when the request body is invalid

## v0.1.0 (2025-11-19)

Initial release extracted from `@remix-run/fetch-router` v0.9.0.

See the [README](https://github.com/remix-run/remix/blob/main/packages/form-data-middleware/README.md) for more details.
