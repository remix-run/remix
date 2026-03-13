# `data-table` CHANGELOG

This is the changelog for [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table). It follows [semantic versioning](https://semver.org/).

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Rename adapter operation contracts and fields.

  `AdapterStatement` becomes `DataManipulationOperation`, and `statement` becomes `operation`.

  Add separate adapter execution methods for DML and migration/DDL operations: `execute` for `DataManipulationOperation` requests and `migrate` for `DataMigrationOperation` requests.

  Add adapter introspection methods with optional transaction context: `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)`.

- BREAKING CHANGE: Remove the `@remix-run/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `@remix-run/data-table` instead.

  `@remix-run/data-table/sql-helpers` remains available as the adapter-facing SQL helper module.

- BREAKING CHANGE: Rename the top-level table-definition helper from `createTable(...)` to `table(...)` and switch column definitions to `column(...)` builders. Runtime validation is now optional and table-scoped via `validate({ operation, tableName, value })`.

  Remove `~standard` table-schema compatibility and `getTableValidationSchemas(...)`, and stop runtime validation/coercion for predicate values.

- Add a first-class migration system under `remix/data-table/migrations` with:

  - `createMigration(...)` and timestamp-based migration loading
  - chainable `column` builders plus schema APIs for create, alter, drop, and index work
  - `createMigrationRunner(adapter, migrations)` for `up`, `down`, `status`, and `dryRun`
  - migration journaling, checksum tracking, and optional Node loading from `remix/data-table/migrations/node`

  Migration callbacks now use split handles: `{ db, schema }`.

  - `db` is the immediate data runtime (`query/create/update/delete/exec/transaction`)
  - `schema` owns migration operations like `createTable`, `alterTable`, `plan`, and introspection

  Migration-time DDL, DML, and introspection now share the same transaction token when migration transactions are enabled. In `dryRun`, schema introspection (`schema.hasTable` / `schema.hasColumn`) reads live adapter/database state and does not simulate pending dry-run operations.

  Add public subpath exports for migrations, Node migration loading, SQL helpers, operators, and SQL builders. SQL compilation stays adapter-owned, while shared SQL compiler helpers remain available from `remix/data-table/sql-helpers`.

- Add optional table lifecycle callbacks for write/delete/read flows: `beforeWrite`, `afterWrite`, `beforeDelete`, `afterDelete`, and `afterRead`.

  Add `fail(...)` as a helper for returning structured validation/lifecycle issues from `validate(...)`, `beforeWrite(...)`, and `beforeDelete(...)`.

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
