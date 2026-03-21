BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `remix/data-table` instead.

BREAKING CHANGE: Remove the `remix/data-table/operators` and `remix/data-table/sql-helpers` exports. Import operators from `remix/data-table`, and treat adapter-only contracts as internal implementation details.

`remix/data-table` now exports the `Database` class as a runtime value. You can construct a database directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.

BREAKING CHANGE: `remix/data-table` no longer exports `QueryBuilder`. Import `Query` and `query` from `remix/data-table`, then execute unbound queries with `db.exec(...)`. `db.exec(...)` now accepts only raw SQL or `Query` values, and unbound terminal methods like `first()`, `count()`, `insert()`, and `update()` return `Query` objects instead of separate command descriptor types. `db.query(table)` remains available as shorthand and now returns the same bound `Query` class.

BREAKING CHANGE: `remix/data-table` now exposes only the end-user root API: database creation, `table`/`column`, relations, public operators, `Query`/`query`, raw SQL helpers, error classes, and the `Table`, `TableRow`, `Predicate`, `WhereInput`, and `SqlStatement` types. Query plumbing types, metadata getters, `fail(...)`, `timestamps()`, and low-level adapter contracts are no longer exported.

BREAKING CHANGE: `remix/data-table/migrations` now keeps only `createMigration(...)`, `createMigrationRegistry(...)`, `createMigrationRunner(...)`, and the core migration runner types. Import `column` and `table` from `remix/data-table` when authoring migrations.

BREAKING CHANGE: `remix/data-table-mysql`, `remix/data-table-postgres`, and `remix/data-table-sqlite` now export only their `create*DatabaseAdapter(...)` factory and options type.

Added `package.json` `exports`:

- `remix/auth-middleware` to re-export APIs from `@remix-run/auth-middleware`
- `remix/auth` to re-export APIs from `@remix-run/auth`
