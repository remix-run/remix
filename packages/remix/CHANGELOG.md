# `remix` CHANGELOG

This is the changelog for [`remix`](https://github.com/remix-run/remix/tree/main/packages/remix). It follows [semantic versioning](https://semver.org/).

## v3.0.0-alpha.3

### Minor Changes

- Added `package.json` `exports`:

  - `remix/fetch-router/routes` to re-export APIs from `@remix-run/fetch-router/routes`

- Added `package.json` `exports`:

  - `remix/data-schema` to re-export APIs from `@remix-run/data-schema`
  - `remix/data-schema/checks` to re-export APIs from `@remix-run/data-schema/checks`
  - `remix/data-schema/coerce` to re-export APIs from `@remix-run/data-schema/coerce`
  - `remix/data-schema/lazy` to re-export APIs from `@remix-run/data-schema/lazy`

- Added `package.json` `exports`:

  - `remix/data-table` to re-export APIs from `@remix-run/data-table`
  - `remix/data-table-mysql` to re-export APIs from `@remix-run/data-table-mysql`
  - `remix/data-table-postgres` to re-export APIs from `@remix-run/data-table-postgres`
  - `remix/data-table-sqlite` to re-export APIs from `@remix-run/data-table-sqlite`

- Added `package.json` `exports`:

  - `remix/session-storage-memcache` to re-export APIs from `@remix-run/session-storage-memcache`

- Added `package.json` `exports`:

  - `remix/session-storage-redis` to re-export APIs from `@remix-run/session-storage-redis`

- Added `package.json` `exports`:

  - `remix/file-storage-s3` to re-export APIs from `@remix-run/file-storage-s3`

- Remove the root export from the `remix` package so you will no longer import anything from `remix` and will instead always import from a sub-path such as `remix/fetch-router` or `remix/component`

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`async-context-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.1.3)
  - [`component@0.5.0`](https://github.com/remix-run/remix/releases/tag/component@0.5.0)
  - [`compression-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.3)
  - [`data-schema@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.1.0)
  - [`data-table@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.1.0)
  - [`data-table-mysql@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.1.0)
  - [`data-table-postgres@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.1.0)
  - [`data-table-sqlite@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.1.0)
  - [`fetch-router@0.17.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.17.0)
  - [`file-storage@0.13.3`](https://github.com/remix-run/remix/releases/tag/file-storage@0.13.3)
  - [`file-storage-s3@0.1.0`](https://github.com/remix-run/remix/releases/tag/file-storage-s3@0.1.0)
  - [`form-data-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.1.4)
  - [`fs@0.4.2`](https://github.com/remix-run/remix/releases/tag/fs@0.4.2)
  - [`lazy-file@5.0.2`](https://github.com/remix-run/remix/releases/tag/lazy-file@5.0.2)
  - [`logger-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.3)
  - [`method-override-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.4)
  - [`mime@0.4.0`](https://github.com/remix-run/remix/releases/tag/mime@0.4.0)
  - [`response@0.3.2`](https://github.com/remix-run/remix/releases/tag/response@0.3.2)
  - [`route-pattern@0.19.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.19.0)
  - [`session-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.1.4)
  - [`session-storage-memcache@0.1.0`](https://github.com/remix-run/remix/releases/tag/session-storage-memcache@0.1.0)
  - [`session-storage-redis@0.1.0`](https://github.com/remix-run/remix/releases/tag/session-storage-redis@0.1.0)
  - [`static-middleware@0.4.4`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.4)

## v3.0.0-alpha.2

### Minor Changes

- Bumped `@remix-run/*` dependencies:

  - [`@remix-run/async-context-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.1.2)
  - [`@remix-run/component@0.4.0`](https://github.com/remix-run/remix/releases/tag/component@0.4.0)
  - [`@remix-run/compression-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.2)
  - [`@remix-run/fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)
  - [`@remix-run/form-data-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.1.3)
  - [`@remix-run/form-data-parser@0.15.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.15.0)
  - [`@remix-run/interaction@0.5.0`](https://github.com/remix-run/remix/releases/tag/interaction@0.5.0)
  - [`@remix-run/logger-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.2)
  - [`@remix-run/method-override-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.3)
  - [`@remix-run/route-pattern@0.18.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.18.0)
  - [`@remix-run/session-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.1.3)
  - [`@remix-run/static-middleware@0.4.3`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.3)

- Added `package.json` `exports`:

  - `remix/route-pattern/specificity` to re-export APIs from `@remix-run/route-pattern/specificity`

## v3.0.0-alpha.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v3.0.0-alpha.0

### Major Changes

- Initial alpha release of `remix` package for Remix 3
