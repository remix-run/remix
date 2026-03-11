BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `remix/data-table` instead.

`remix/data-table/sql-helpers` remains available for adapter-facing SQL utilities.

`remix/data-table` now exports the `Database` class as a runtime value. You can construct a database directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.

BREAKING CHANGE: `remix/data-table` no longer exports `QueryBuilder`. Import `Query` and `query` from `remix/data-table`, then execute unbound queries with `db.exec(...)`. `db.exec(...)` now accepts only raw SQL or `Query` values, and unbound terminal methods like `first()`, `count()`, `insert()`, and `update()` return `Query` objects instead of separate command descriptor types. `db.query(table)` remains available as shorthand and now returns the same bound `Query` class.

`remix/data-table/migrations` no longer exports a separate `Database` type alias. Import `Database` from `remix/data-table` when you need the migration `db` type directly.

The incidental `QueryMethod` type export has also been removed; use `Database['query']` or `QueryForTable<table>` when you need that type shape.

Added `package.json` `exports`:
- `remix/auth-middleware` to re-export APIs from `@remix-run/auth-middleware`
- `remix/auth` to re-export APIs from `@remix-run/auth`
