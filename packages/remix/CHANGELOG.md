# `remix` CHANGELOG

This is the changelog for [`remix`](https://github.com/remix-run/remix/tree/main/packages/remix). It follows [semantic versioning](https://semver.org/).

## v3.0.0-alpha.4

### Pre-release Changes

- BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `remix/data-table` instead.

  `remix/data-table/sql-helpers` remains available for adapter-facing SQL utilities.

- Add `remix/cors-middleware` to re-export the CORS middleware APIs from `@remix-run/cors-middleware`.

- Update `remix/component` and `remix/component/server` to re-export the latest `@remix-run/component` frame-navigation APIs.

  `remix/component` now exposes `navigate(href, { src, target, history })`, `link(href, { src, target, history })`, `run({ loadModule, resolveFrame })`, and the `handle.frames.top` and `handle.frames.get(name)` helpers, while `remix/component/server` re-exports the SSR frame source APIs including `frameSrc`, `topFrameSrc`, and `ResolveFrameContext`.

- Add browser-origin and CSRF protection middleware APIs to `remix`.

  - `remix/cop-middleware` exposes `cop(options)` for browser-focused cross-origin protection
    using `Sec-Fetch-Site` with `Origin` fallback, trusted origins, and configurable bypasses.
  - `remix/csrf-middleware` exposes `csrf(options)` and `getCsrfToken(context)` for
    session-backed CSRF tokens plus origin validation.
  - Apps can use either middleware independently or layer `cop()`, `session()`, and `csrf()`
    together when they want both browser-origin filtering and token-backed protection.

- Bumped `@remix-run/*` dependencies:
  - [`async-context-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.1.4)
  - [`component@0.6.0`](https://github.com/remix-run/remix/releases/tag/component@0.6.0)
  - [`compression-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.4)
  - [`cop-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/cop-middleware@0.1.0)
  - [`cors-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/cors-middleware@0.1.0)
  - [`csrf-middleware@0.1.0`](https://github.com/remix-run/remix/releases/tag/csrf-middleware@0.1.0)
  - [`data-schema@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-schema@0.2.0)
  - [`data-table@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.0)
  - [`data-table-mysql@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table-mysql@0.2.0)
  - [`data-table-postgres@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table-postgres@0.2.0)
  - [`data-table-sqlite@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table-sqlite@0.2.0)
  - [`fetch-router@0.18.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.18.0)
  - [`form-data-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.2.0)
  - [`logger-middleware@0.1.4`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.4)
  - [`method-override-middleware@0.1.5`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.5)
  - [`route-pattern@0.19.1`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.19.1)
  - [`session-middleware@0.2.0`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.2.0)
  - [`static-middleware@0.4.5`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.5)

## v3.0.0-alpha.3

### Pre-release Changes

- Added `package.json` `exports`:

  - `remix/data-schema` to re-export APIs from `@remix-run/data-schema`
  - `remix/data-schema/checks` to re-export APIs from `@remix-run/data-schema/checks`
  - `remix/data-schema/coerce` to re-export APIs from `@remix-run/data-schema/coerce`
  - `remix/data-schema/lazy` to re-export APIs from `@remix-run/data-schema/lazy`
  - `remix/data-table` to re-export APIs from `@remix-run/data-table`
  - `remix/data-table-mysql` to re-export APIs from `@remix-run/data-table-mysql`
  - `remix/data-table-postgres` to re-export APIs from `@remix-run/data-table-postgres`
  - `remix/data-table-sqlite` to re-export APIs from `@remix-run/data-table-sqlite`
  - `remix/fetch-router/routes` to re-export APIs from `@remix-run/fetch-router/routes`
  - `remix/file-storage-s3` to re-export APIs from `@remix-run/file-storage-s3`
  - `remix/session-storage-memcache` to re-export APIs from `@remix-run/session-storage-memcache`
  - `remix/session-storage-redis` to re-export APIs from `@remix-run/session-storage-redis`

- Remove the root export from the `remix` package so you will no longer import anything from `remix` and will instead always import from a sub-path such as `remix/fetch-router` or `remix/component`

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

### Pre-release Changes

- Added `package.json` `exports`:

  - `remix/route-pattern/specificity` to re-export APIs from `@remix-run/route-pattern/specificity`

- Bumped `@remix-run/*` dependencies:
  - [`async-context-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/async-context-middleware@0.1.2)
  - [`component@0.4.0`](https://github.com/remix-run/remix/releases/tag/component@0.4.0)
  - [`compression-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/compression-middleware@0.1.2)
  - [`fetch-router@0.16.0`](https://github.com/remix-run/remix/releases/tag/fetch-router@0.16.0)
  - [`form-data-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/form-data-middleware@0.1.3)
  - [`form-data-parser@0.15.0`](https://github.com/remix-run/remix/releases/tag/form-data-parser@0.15.0)
  - [`interaction@0.5.0`](https://github.com/remix-run/remix/releases/tag/interaction@0.5.0)
  - [`logger-middleware@0.1.2`](https://github.com/remix-run/remix/releases/tag/logger-middleware@0.1.2)
  - [`method-override-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/method-override-middleware@0.1.3)
  - [`route-pattern@0.18.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.18.0)
  - [`session-middleware@0.1.3`](https://github.com/remix-run/remix/releases/tag/session-middleware@0.1.3)
  - [`static-middleware@0.4.3`](https://github.com/remix-run/remix/releases/tag/static-middleware@0.4.3)

## v3.0.0-alpha.1

### Pre-release Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v3.0.0-alpha.0

### Major Changes

- Initial alpha release of `remix` package for Remix 3
