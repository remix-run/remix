# data-table-mysql

MySQL database implementation for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table), backed by `mysql2`.

## Features

- **Native `mysql2` Integration**: Creates a pool from `mysql2` configuration or uses an existing pool or connection
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **MySQL Compiler**: SQL compilation is handled automatically for MySQL
- **Multi-Statement Migrations**: `executeScript()` runs `up.sql` / `down.sql` files via `mysql2` (requires `multipleStatements: true`)
- **MySQL Capabilities Enabled By Default**:
  - `returning: false`
  - `savepoints: true`
  - `upsert: true`
  - `transactionalDdl: false`
  - `migrationLock: true`

## Installation

```sh
npm i remix mysql2
```

## Usage

```ts
import { createMysqlDatabase } from 'remix/data-table/mysql'

let db = createMysqlDatabase({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
})
```

Use `db.query(...)`, relation loading, and transactions from `remix/data-table`. Import any driver-specific types you need directly from `mysql2/promise`.

## Database Capabilities

`data-table-mysql` reports this capability set by default:

- `returning: false`
- `savepoints: true`
- `upsert: true`
- `transactionalDdl: false`
- `migrationLock: true`

## Advanced Usage

### Multi-Statement Migrations

`remix/data-table/migrations` sends each migration as a single multi-statement SQL script. mysql2 only accepts multi-statement scripts when the connection is created with `multipleStatements: true`:

```ts
import { createMysqlDatabase } from 'remix/data-table/mysql'

let db = createMysqlDatabase({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
})
```

Config-backed databases support `db.wipe()` and `db.reset()`. Call `await db.close()` during application shutdown to close the internally created pool. You may pass an existing `mysql2` pool or connection when your application owns the driver lifecycle; `db.close()` leaves supplied clients alone, and destructive lifecycle methods are unavailable in that mode. `db.wipe()` requires a database name in the connection config (`database`, or the path of a connection URI) and throws when none is present.

Migration runs reserve one connection for the MySQL named lock, migration SQL, and journal updates. Lock acquisition waits up to 60 seconds and fails with an error instead of allowing the migration to proceed. After a successful run the connection is unlocked and returned to the pool; if the migration or unlock fails, the reserved connection is destroyed instead of being reused, so a dirty session can never leak back into the pool. Nested migration lock acquisition throws instead of deadlocking.

### `returning` On MySQL

MySQL does not natively support SQL `RETURNING`. Using `returning` on write operations therefore throws `DataTableQueryError`.

Use write metadata (`affectedRows`, `insertId`) on MySQL, or switch databases when returned rows are required.

```ts
import { DataTableQueryError } from 'remix/data-table'

try {
  await db
    .query(Accounts)
    .insert({ email: 'a@example.com', status: 'active' }, { returning: ['id'] })
} catch (error) {
  if (error instanceof DataTableQueryError) {
    // insert() returning is not supported by MySQL
  }
}
```

## Running integration tests locally

To start a local MySQL container matching CI:

```sh
podman run --name mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=remix \
  -p 3306:3306 \
  -d mysql:8
```

Then run:

```sh
REMIX_DATA_TABLE_MYSQL_TEST_URL=mysql://root:root@127.0.0.1:3306/remix \
pnpm test src/lib/adapter.integration.test.ts
```

Remove the container when you are done:

```sh
podman rm -f mysql
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL database implementation
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite database implementation

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
