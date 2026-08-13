Added complete `createPostgresDatabase()`, `createMysqlDatabase()`, and `createSqliteDatabase()` factories through `remix/data-table/postgres`, `remix/data-table/mysql`, and `remix/data-table/sqlite`. These return the `Database` used for queries and lifecycle operations such as `migrate()`, `migrationStatus()`, `reset()`, `wipe()`, and `close()` (see #11608, #11639).

BREAKING CHANGE: Replace the removed adapter and migration-runner APIs with a concrete database and its lifecycle methods:

```diff
- import { createDatabase } from 'remix/data-table'
- import { createPostgresDatabaseAdapter } from 'remix/data-table/postgres'
+ import { createPostgresDatabase } from 'remix/data-table/postgres'

- const db = createDatabase(
-   createPostgresDatabaseAdapter({ connectionString: process.env.DATABASE_URL }),
- )
+ const db = createPostgresDatabase({
+   connectionString: process.env.DATABASE_URL,
+ })

- await migrationRunner.migrate()
+ await db.migrate(migrations)
```

Applications should use a dialect factory; database integration packages can extend `Database` with a composed `DatabaseDriver` from `remix/data-table`.
