BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `remix/data-table` instead.

`remix/data-table/sql-helpers` remains available for adapter-facing SQL utilities.

`remix/data-table` now exports the `Database` class as a runtime value. You can construct a database directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.

BREAKING CHANGE: `remix/data-table` no longer exports `QueryBuilder`. Import `Query` and `query` from `remix/data-table`, then execute unbound queries with `db.exec(...)`. `db.query(table)` remains available as shorthand and now returns the same bound `Query` class.

`remix/data-table/migrations` no longer exports a separate `Database` type alias. Import `Database` from `remix/data-table` when you need the migration `db` type directly.
