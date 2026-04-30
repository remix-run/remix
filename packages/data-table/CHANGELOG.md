# `data-table` CHANGELOG

This is the changelog for [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table). It follows [semantic versioning](https://semver.org/).

## v0.2.1

### Patch Changes

- Clarify the package description to describe general JavaScript usage instead of Remix-specific usage.

## v0.2.0

### Minor Changes

- BREAKING CHANGE: Rename adapter operation contracts and fields.

  `AdapterStatement` becomes `DataManipulationOperation`, and `statement` becomes `operation`.

  Add separate adapter execution methods for DML and migration/DDL operations: `execute` for `DataManipulationOperation` requests and `migrate` for `DataMigrationOperation` requests.

  Add adapter introspection methods with optional transaction context: `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)`.

- BREAKING CHANGE: Replace the public `QueryBuilder` API with `Query` objects that can be created with `query(table)` and executed with `db.exec(...)`.

  `db.query(table)` still provides the same chainable ergonomics, but it now returns the public `Query` class in a database-bound form instead of a separate `QueryBuilder` type. `db.exec(...)` now accepts only raw SQL or `Query` values, and unbound terminal methods like `first()`, `count()`, `exists()`, `insert()`, `update()`, and `delete()` return `Query` objects instead of separate command descriptor types.

  The incidental `QueryMethod` type export has also been removed; use `Database['query']` or `QueryForTable<table>` when you need that type shape.

- BREAKING CHANGE: Remove the `@remix-run/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `@remix-run/data-table` instead.

  `@remix-run/data-table/sql-helpers` remains available as the adapter-facing SQL helper module.

- BREAKING CHANGE: Rename the top-level table-definition helper from `createTable(...)` to `table(...)` and switch column definitions to `column(...)` builders. Runtime validation is now optional and table-scoped via `validate({ operation, tableName, value })`.

  Remove `~standard` table-schema compatibility and `getTableValidationSchemas(...)`, and stop runtime validation/coercion for predicate values.

- `@remix-run/data-table` now exports `Database` as the runtime class instead of separating the runtime implementation from a structural `Database` type. You can construct databases directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.

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

  `@remix-run/data-table/migrations` no longer exports a separate `Database` type alias. Migration callbacks still receive `context.db` as the main `Database` runtime, so if you need the type directly, import `Database` from `@remix-run/data-table` instead.

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
