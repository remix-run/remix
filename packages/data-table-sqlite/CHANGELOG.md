# `data-table-sqlite` CHANGELOG

This is the changelog for [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite). It follows [semantic versioning](https://semver.org/).

## v0.3.0

### Minor Changes

- BREAKING CHANGE: Removed adapter options

  **Affected APIs**

  - `SqliteDatabaseAdapterOptions` type: removed
  - `createSqliteDatabaseAdapter` function: `options` arg removed
  - `SqliteDatabaseAdapter` constructor: `options` arg removed

  **Why**

  Adapter options existed solely for tests to override adapter capabilities.
  If you must override capabilities, you can do so directly via mutation:

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
