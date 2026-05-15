BREAKING CHANGE: removed `migrate(request)` and `compileSql(DataMigrationOperation)`

The DDL operation ADT has been removed from `@remix-run/data-table`, so this adapter no longer implements `migrate()` and `compileSql()` only accepts `DataManipulationOperation`. SQL-file migrations run through the new `executeScript(sql, transaction?)` method, which delegates to the SQLite client's native `exec()`.
