BREAKING CHANGE: Remove the `remix/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `remix/data-table` instead.

`remix/data-table/sql-helpers` remains available for adapter-facing SQL utilities.

`remix/data-table` now exports the `Database` class as a runtime value. You can construct a database directly with `new Database(adapter, options)` or keep using `createDatabase(adapter, options)`, which now delegates to the class constructor.
