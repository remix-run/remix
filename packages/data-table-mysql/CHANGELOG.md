# `data-table-mysql` CHANGELOG

This is the changelog for [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql). It follows [semantic versioning](https://semver.org/).

## v0.5.0

### Minor Changes

- Added config-backed MySQL adapter construction, connection-scoped migration locking, and database wiping for `remix db`. Existing `mysql2` pools and connections remain supported for applications that own the driver lifecycle, but wiping requires config-backed construction (see #11608).

  `wipe()` throws when no database name can be resolved from the connection config instead of guessing one. Failed migration runs destroy the reserved connection instead of returning a dirty session to the pool, and re-entering `withMigrationLock()` from a migration callback throws instead of deadlocking.

### Patch Changes

- Use bound parameters for compiled `limit` and `offset` clauses.

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.4.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.4.0)

## v0.4.0

### Minor Changes

- BREAKING CHANGE: removed `migrate(request)` and `compileSql(DataMigrationOperation)`

  The DDL operation ADT has been removed from `@remix-run/data-table`, so this adapter no longer implements `migrate()` and `compileSql()` only accepts `DataManipulationOperation`. SQL-file migrations run through the new `executeScript(sql, transaction?)` method, which forwards to `connection.query(sql)`.

  mysql2 only accepts multi-statement scripts when the underlying connection or pool was created with `multipleStatements: true`. Set that option when running migrations whose `up.sql` / `down.sql` contains more than one statement.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.3.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.3.0)

## v0.3.1

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.2.1`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.1)

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**
  - `MysqlDatabaseAdapterOptions` type: removed
  - `createMysqlDatabaseAdapter` function: `options` arg removed
  - `MysqlDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities. If you must override capabilities, you can do so directly via mutation:

  ```ts
  let adapter = createMysqlDatabaseAdapter(mysql)
  adapter.capabilities = {
    ...adapter.capabilities,
    upsert: false,
  }
  ```

## v0.2.0

### Minor Changes

- Add first-class migration execution support to the mysql adapter. It now compiles and executes `DataMigrationOperation` plans for `remix/data-table/migrations`, including create/alter/drop table and index flows, migration journal writes, and adapter-managed migration locking.

  Normal reads/writes continue through `execute(...)`, while migration/DDL work runs through `migrate(...)`.

  SQL compilation remains adapter-owned and can share helpers from `remix/data-table/sql-helpers`.

- Add transaction-aware migration introspection to the mysql adapter.

  `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now use the provided migration transaction connection when present, so planning and execution can inspect schema state inside the active migration transaction.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.2.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.2.0)

## v0.1.0

### Minor Changes

- Initial release of `@remix-run/data-table-mysql`.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`data-table@0.1.0`](https://github.com/remix-run/remix/releases/tag/data-table@0.1.0)

## v0.1.0

### Minor Changes

- Initial release.
