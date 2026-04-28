Added `executeScript(sql, transaction?)` to satisfy the `DatabaseAdapter` contract introduced for SQL-file migrations. The adapter forwards the script via `connection.query(sql)`.

mysql2 only accepts multi-statement scripts when the underlying connection or pool was created with `multipleStatements: true`. Set that option when running migrations whose `up.sql` / `down.sql` contains more than one statement.
