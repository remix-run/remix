# data-table-postgres

`data-table-postgres` is the PostgreSQL adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).

Use this when you want the `data-table` query API on top of `pg` with native PostgreSQL behavior for `RETURNING`, savepoints, and upsert.

## Features

- **Native PostgreSQL integration** via `pg`
- **Works with `remix/data-table`** query, relations, writes, and transactions APIs
- **Native capabilities enabled by default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`

## Installation

```sh
pnpm add remix pg
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

Once connected, use `db.query(...)`, relations, and transactions from `remix/data-table` exactly as documented in the core package.

## Advanced Usage

### Transaction Options

Transaction options are passed through to the adapter as hints:

```ts
await db.transaction(
  async (transactionDatabase) => transactionDatabase.exec('select 1'),
  {
    isolationLevel: 'serializable',
    readOnly: false,
  },
)
```

### Capability Overrides For Testing

You can override capabilities to verify fallback paths in tests.

```ts
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let adapter = createPostgresDatabaseAdapter(pool, {
  capabilities: {
    returning: false,
  },
})
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and validation
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
