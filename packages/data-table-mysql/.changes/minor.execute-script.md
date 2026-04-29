BREAKING CHANGE: removed `migrate(request)` and `compileSql(DataMigrationOperation)`

The DDL operation ADT has been removed from `@remix-run/data-table`, so this adapter no longer implements `migrate()` and `compileSql()` only accepts `DataManipulationOperation`. SQL-file migrations run through the new `executeScript(sql, transaction?)` method, which forwards to `connection.query(sql)`.

mysql2 only accepts multi-statement scripts when the underlying connection or pool was created with `multipleStatements: true`. Set that option when running migrations whose `up.sql` / `down.sql` contains more than one statement.
