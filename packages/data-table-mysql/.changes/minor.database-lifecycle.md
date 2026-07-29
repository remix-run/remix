Added `createMysqlDatabase()` with config-backed construction, connection-scoped migration locking, database wiping for `remix db`, and `close()` for releasing an internally created pool. Existing `mysql2` pools and connections remain supported for applications that own the driver lifecycle, but wiping requires config-backed construction (see #11608, #11639).

`wipe()` throws when no database name can be resolved from the connection config instead of guessing one. Failed migration runs and failed transaction startup destroy the reserved connection instead of returning a dirty session to the pool, and nested lock acquisition throws instead of deadlocking.

BREAKING CHANGE: Removed `MysqlDatabaseAdapter` and `createMysqlDatabaseAdapter()` from the public entry point. Use `createMysqlDatabase()` to get a complete MySQL-backed `Database`.
