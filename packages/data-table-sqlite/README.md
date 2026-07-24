# data-table-sqlite

SQLite database implementation for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table), backed by a synchronous SQLite client.

## Features

- **Native Runtime SQLite Support**: Opens a configured filename with Node's `node:sqlite` or Bun's `bun:sqlite`, or uses a compatible synchronous SQLite client
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **SQLite Compiler**: SQL compilation is handled automatically for SQLite
- **Multi-Statement Migrations**: `executeScript()` runs `up.sql` / `down.sql` files via `Database.exec()`
- **SQLite Capabilities Enabled By Default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`
  - `transactionalDdl: true`
  - `migrationLock: false`

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createSqliteDatabase } from 'remix/data-table/sqlite'

let db = createSqliteDatabase({
  filename: 'app.db',
  foreignKeys: true,
})
```

The config-backed database uses `node:sqlite` in Node.js and `bun:sqlite` in Bun. It supports `db.wipe()` and `db.reset()` because it can close and reopen the database file. Call `db.close()` during application shutdown to release the connection and its file handle.

Foreign key enforcement defaults to off on every runtime. When `foreignKeys` is enabled, the database restores foreign key enforcement each time it opens the connection, including after destructive lifecycle operations.

The database also applies `pragma busy_timeout = 5000` whenever it opens the connection, so writes wait for a locked database instead of failing immediately with `SQLITE_BUSY`. Use `busyTimeout` to override the timeout in milliseconds (`0` disables the wait).

You may also pass an existing synchronous client when your application owns its lifecycle:

```ts
import { Database } from 'bun:sqlite'
import { createSqliteDatabase } from 'remix/data-table/sqlite'

let sqlite = new Database('app.db')
let db = createSqliteDatabase(sqlite)

// Leaves the supplied client open.
db.close()

// The application closes the client it owns.
sqlite.close()
```

Destructive lifecycle methods are unavailable when you pass an existing client.

This is a good fit for local development, embedded deployments, and single-node services. Import any driver-specific types you need directly from your runtime's SQLite module.

## Database Capabilities

`data-table-sqlite` reports this capability set by default:

- `returning: true`
- `savepoints: true`
- `upsert: true`
- `transactionalDdl: true`
- `migrationLock: false`

## Advanced Usage

### Destructive Lifecycle And Locking

`db.wipe()` and `db.reset()` assume a single process owns the database file. Stop other processes before wiping: on POSIX systems another process keeps writing to the deleted inode, and on Windows an open handle blocks deletion entirely. Wiping removes the `-wal`, `-shm`, and `-journal` sidecar files along with the main database file so a freshly created database never associates with stale sidecars.

SQLite migrations run without a cross-process migration lock (`migrationLock: false`), so run migrations from one process at a time.

`filename` resolves against the current working directory — for `remix db` commands, wherever you invoke the CLI. Prefer absolute paths or paths derived from `import.meta.dirname`.

### In-Memory Database For Tests

```ts
import { DatabaseSync } from 'node:sqlite'
import { createSqliteDatabase } from 'remix/data-table/sqlite'

let sqlite = new DatabaseSync(':memory:')
let db = createSqliteDatabase(sqlite)
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL database implementation
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL database implementation

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
