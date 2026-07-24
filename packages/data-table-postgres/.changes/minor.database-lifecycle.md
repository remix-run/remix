Added `createPostgresDatabase()` with config-backed construction, connection-scoped migration locking, database wiping for `remix db`, and `close()` for releasing an internally created pool. Existing `pg` pools and clients remain supported for applications that own the driver lifecycle, but wiping requires config-backed construction (see #11608, #11639).

`wipe()` throws when no database name can be resolved from the connection config or `PGDATABASE` instead of guessing `postgres`. Migration lock acquisition is bounded by a 60 second `lock_timeout` and fails with an error instead of waiting forever. Failed migration runs and failed transaction startup destroy the reserved connection instead of returning a dirty session to the pool, and nested lock acquisition throws instead of deadlocking.

BREAKING CHANGE: Removed `PostgresDatabaseAdapter` and `createPostgresDatabaseAdapter()` from the public entry point. Use `createPostgresDatabase()` to get a complete PostgreSQL-backed `Database`.
