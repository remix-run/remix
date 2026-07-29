# data-table-postgres

PostgreSQL database implementation for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table), backed by `pg`.

## Features

- **Native `pg` Integration**: Creates a pool from `pg` configuration or uses an existing pool or client
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **PostgreSQL Compiler**: SQL compilation is handled automatically for PostgreSQL
- **Multi-Statement Migrations**: `executeScript()` runs `up.sql` / `down.sql` files natively via `pg`
- **Postgres Capabilities Enabled By Default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`
  - `transactionalDdl: true`
  - `migrationLock: true`

## Installation

```sh
npm i remix pg
```

## Usage

```ts
import { createPostgresDatabase } from 'remix/data-table/postgres'

let db = createPostgresDatabase({
  connectionString: process.env.DATABASE_URL,
})
```

Use `db.query(...)`, relation loading, and transactions from `remix/data-table`. Import any driver-specific types you need directly from `pg`.

Config-backed databases support `db.wipe()` and `db.reset()`. Call `await db.close()` during application shutdown to close the internally created pool. You may pass an existing `pg` pool or client when your application owns the driver lifecycle; `db.close()` leaves supplied clients alone, and destructive lifecycle methods are unavailable in that mode. `db.wipe()` requires a database name resolvable from the connection config (`database`, the path of `connectionString`, or the `PGDATABASE` environment variable) and throws when none is present.

Migration runs reserve one connection for the PostgreSQL advisory lock, migration SQL, and journal updates. Lock acquisition waits up to 60 seconds (via `lock_timeout`) and fails with an error instead of blocking forever. After a successful run the connection is unlocked and returned to the pool; if the migration or unlock fails, the reserved connection is destroyed instead of being reused, so a dirty session can never leak back into the pool. Nested migration lock acquisition throws instead of deadlocking.

## Database Capabilities

`data-table-postgres` reports this capability set by default:

- `returning: true`
- `savepoints: true`
- `upsert: true`
- `transactionalDdl: true`
- `migrationLock: true`

## Advanced Usage

### Transaction Options

Transaction options are passed through to PostgreSQL as hints.

```ts
await db.transaction(async (txDb) => txDb.exec('select 1'), {
  isolationLevel: 'serializable',
  readOnly: false,
})
```

## Running integration tests locally

To start a local Postgres container matching CI:

```sh
podman run --name postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=remix \
  -p 5432:5432 \
  -d postgres:16
```

Then run:

```sh
REMIX_DATA_TABLE_POSTGRES_TEST_URL=postgres://postgres:postgres@127.0.0.1:5432/remix \
pnpm test src/lib/adapter.integration.test.ts
```

Remove the container when you are done:

```sh
podman rm -f postgres
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL database implementation
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite database implementation

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
