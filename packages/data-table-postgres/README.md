# data-table-postgres

PostgreSQL adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).
Use this package when you want `data-table` APIs backed by `pg`.

## Features

- **Native `pg` Integration**: Works with `pg` `Pool` and `PoolClient` instances
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **Adapter-Owned Compiler**: SQL compilation lives in this adapter, with optional shared pure helpers from `data-table`
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
import { Pool } from 'pg'
import { createDatabase } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

let db = createDatabase(createPostgresDatabaseAdapter(pool))
```

Use `db.query(...)`, relation loading, and transactions from `remix/data-table`.
Import any driver-specific types you need directly from `pg`.

## Adapter Capabilities

`data-table-postgres` reports this capability set by default:

- `returning: true`
- `savepoints: true`
- `upsert: true`
- `transactionalDdl: true`
- `migrationLock: true`

## Advanced Usage

### Transaction Options

Transaction options are passed through to the adapter as hints.

```ts
await db.transaction(async (txDb) => txDb.exec('select 1'), {
  isolationLevel: 'serializable',
  readOnly: false,
})
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
