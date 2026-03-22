BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement` and `sql` from `remix/data-table` instead.

BREAKING CHANGE: Remove the `remix/data-table/operators` and `remix/data-table/sql-helpers` exports. Import operators from `remix/data-table`, and treat adapter-only contracts as internal implementation details.

`remix/data-table` now exports the `Database` class as a runtime value. You can construct a database directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.

BREAKING CHANGE: `remix/data-table` no longer exports `QueryBuilder`. Import `Query` and `query` from `remix/data-table`, then execute query objects with `db.exec(...)`. `db.query(table)` has been removed, and terminal methods like `first()`, `count()`, `insert()`, and `update()` now always return `Query` objects instead of executing immediately.

BREAKING CHANGE: `remix/data-table` now exposes only the end-user root API: database creation, `table`/`column`, relations, public operators, `Query`/`query`, `sql`, error classes, the core table/query SQL types, and the common relation/transaction option types. The database CRUD helper surface, query plumbing types, metadata getters, `fail(...)`, `timestamps()`, `rawSql(...)`, and low-level adapter contracts are no longer exported.

BREAKING CHANGE: `remix/data-table/migrations` now keeps only `createMigration(...)`, `createMigrationRegistry(...)`, `createMigrationRunner(...)`, and the core migration runner types and options. Import `column` and `table` from `remix/data-table` when authoring migrations.

Added `package.json` `exports`:
- `remix/data-table/adapter` to re-export APIs from `@remix-run/data-table/adapter`
