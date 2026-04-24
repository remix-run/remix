# `data-table-mysql` CHANGELOG

This is the changelog for [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql). It follows [semantic versioning](https://semver.org/).

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**

  - `MysqlDatabaseAdapterOptions` type: removed
  - `createMysqlDatabaseAdapter` function: `options` arg removed
  - `MysqlDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities.
  If you must override capabilities, you can do so directly via mutation:

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
