# `data-table-sqlite` CHANGELOG

This is the changelog for [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite). It follows [semantic versioning](https://semver.org/).

## v0.6.0

### Minor Changes

- Added `close()` to the SQLite adapter to release the underlying database connection and its file handle. Config-backed adapters keep the database file locked on Windows until closed, so callers that need to move or delete the file should close the adapter first.

- Added filename-based SQLite adapter construction, optional persistent foreign key enforcement, and database wiping for `remix db`. Existing synchronous SQLite clients remain supported for applications that own the driver lifecycle, but wiping requires config-backed construction (see #11608).

  Config-backed adapters now make the `foreignKeys` option authoritative on every runtime: enforcement defaults to off, including on Node.js where `node:sqlite` would otherwise enable it by default. They also apply a default `busy_timeout` of 5000ms (override with the new `busyTimeout` option), and `wipe()` removes `-wal`/`-shm`/`-journal` sidecar files along with the main database file. The runtime SQLite driver now loads lazily on config-backed construction, so client-backed adapters work in environments that cannot resolve `node:sqlite` or `bun:sqlite` at import time.

### Patch Changes

- Use bound parameters for compiled `limit` and `offset` clauses.

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.4.0)

## v0.5.1

### Patch Changes

- Reject stale or unknown transaction tokens before executing SQLite data operations.

## v0.5.0

### Minor Changes

- BREAKING CHANGE: removed `migrate(request)` and `compileSql(DataMigrationOperation)`

  The DDL operation ADT has been removed from `@remix-run/data-table`, so this adapter no longer implements `migrate()` and `compileSql()` only accepts `DataManipulationOperation`. SQL-file migrations run through the new `executeScript(sql, transaction?)` method, which delegates to the SQLite client's native `exec()`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.3.0)

## v0.4.1

### Patch Changes

- Normalized native SQLite write metadata and bind values so `node:sqlite`, Bun SQLite, and compatible clients consistently report affected rows and treat `undefined` writes as SQL `NULL`.

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.2.1`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.1)

## v0.4.0

### Minor Changes

- Widened `createSqliteDatabaseAdapter` to accept synchronous SQLite clients that match the shared `prepare`/`exec` surface used by Node's `node:sqlite`, Bun's `bun:sqlite`, and compatible clients. The package no longer requires `better-sqlite3` as an optional peer dependency.

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**
  - `SqliteDatabaseAdapterOptions` type: removed
  - `createSqliteDatabaseAdapter` function: `options` arg removed
  - `SqliteDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities. If you must override capabilities, you can do so directly via mutation:

  ```ts
  let adapter = createSqliteDatabaseAdapter(sqlite)
  adapter.capabilities = {
    ...adapter.capabilities,
    returning: false,
  }
  ```

## v0.2.0

### Minor Changes

- Add first-class migration execution support to the sqlite adapter. It now compiles and executes `DataMigrationOperation` plans for `remix/data-table/migrations`, including create/alter/drop table and index flows, migration journal writes, and adapter-managed DDL execution for migrations.

  Normal reads/writes continue through `execute(...)`, while migration/DDL work runs through `migrate(...)`.

  SQL compilation remains adapter-owned and can share helpers from `remix/data-table/sql-helpers`.

- Add transaction-aware migration introspection to the sqlite adapter.

  `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now accept a transaction token, validate it, and execute against the migration transaction when provided so schema checks line up with the active migration transaction.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.0)

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/data-table-sqlite`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.1.0)

## v0.1.0

### Minor Changes

- Initial release.
