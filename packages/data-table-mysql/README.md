# data-table-mysql

`data-table-mysql` is the MySQL adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).

Use this when you want one relational query API across environments while running on MySQL (`mysql2`).

## Features

- **MySQL integration** via `mysql2`
- **Works with `remix/data-table`** query, relation loading, writes, and transactions APIs
- **Predictable capability defaults**:
  - `returning: false`
  - `savepoints: true`
  - `upsert: true`

## Installation

```sh
pnpm add remix mysql2
```

## Usage

```ts
import { createPool } from 'mysql2/promise'
import { createDatabase } from 'remix/data-table'
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'

let pool = createPool(process.env.DATABASE_URL as string)
let db = createDatabase(createMysqlDatabaseAdapter(pool))
```

Once connected, use `db.query(...)`, relation APIs, and transaction APIs from `remix/data-table`.

## Advanced Usage

### Capability Overrides For Testing

Capability overrides are mainly for tests where you want to force or disable specific behavior checks.
In production, keep the defaults so adapter capabilities match actual MySQL behavior.

```ts
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'

let adapter = createMysqlDatabaseAdapter(pool, {
  capabilities: {
    upsert: false,
  },
})
```

### `returning` On MySQL

MySQL does not natively support SQL `RETURNING`. In this adapter, `returning` on write operations throws `DataTableQueryError`.

Use write metadata (`affectedRows`, `insertId`) on MySQL, or switch to an adapter with native `RETURNING` support when returned rows are required.

```ts
import { DataTableQueryError } from 'remix/data-table'

try {
  await db.query(Accounts).insert({ email: 'a@example.com', status: 'active' }, { returning: ['id'] })
} catch (error) {
  if (error instanceof DataTableQueryError) {
    // insert() returning is not supported by this adapter
  }
}
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
