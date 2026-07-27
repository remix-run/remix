Added config-backed MySQL adapter construction, connection-scoped migration locking, and database wiping for `remix db`. Existing `mysql2` pools and connections remain supported for applications that own the driver lifecycle, but wiping requires config-backed construction (see #11608).

`wipe()` throws when no database name can be resolved from the connection config instead of guessing one. Failed migration runs destroy the reserved connection instead of returning a dirty session to the pool, and re-entering `withMigrationLock()` from a migration callback throws instead of deadlocking.
