# data-table-mysql

MySQL adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).
Use this package when you want `data-table` APIs backed by `mysql2`.

## Features

- **Native `mysql2` Integration**: Works with `mysql2/promise` connection pools
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **Adapter-Owned Compiler**: SQL compilation lives in this adapter, with optional shared pure helpers from `data-table`
- **Migration DDL Support**: Compiles and executes `DataMigrationOperation` operations for `remix/data-table/migrations`
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
import { createPool } from 'mysql2/promise'
import { createDatabase } from 'remix/data-table'
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'

let pool = createPool(process.env.DATABASE_URL as string)
let db = createDatabase(createMysqlDatabaseAdapter(pool))
```

Use `db.query(...)`, relation loading, and transactions from `remix/data-table`.

## Adapter Capabilities

`data-table-mysql` reports this capability set by default:

- `returning: false`
- `savepoints: true`
- `upsert: true`
- `transactionalDdl: false`
- `migrationLock: true`

## Advanced Usage

### Capability Overrides For Testing

Capability overrides are mainly for tests where you want to force or disable specific behavior
checks. In production, keep defaults so adapter behavior matches MySQL behavior.

```ts
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'

let adapter = createMysqlDatabaseAdapter(pool, {
  capabilities: {
    upsert: false,
  },
})
```

### `returning` On MySQL

MySQL does not natively support SQL `RETURNING`. In this adapter, using `returning` on write
operations throws `DataTableQueryError`.

Use write metadata (`affectedRows`, `insertId`) on MySQL, or switch adapters when returned rows
are required.

```ts
import { DataTableQueryError } from 'remix/data-table'

try {
  await db
    .query(Accounts)
    .insert({ email: 'a@example.com', status: 'active' }, { returning: ['id'] })
} catch (error) {
  if (error instanceof DataTableQueryError) {
    // insert() returning is not supported by this adapter
  }
}
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
