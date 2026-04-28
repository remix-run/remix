Added `executeScript(sql, transaction?)` to satisfy the `DatabaseAdapter` contract introduced for SQL-file migrations. Multi-statement scripts run via `better-sqlite3`'s native `db.exec`.
