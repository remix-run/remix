# data-table-postgres

PostgreSQL adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).
Use this package when you want `data-table` APIs backed by `pg`.

## Features

- **Native `pg` Integration**: Works with `Pool` and Postgres connection strings
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **Postgres Capabilities Enabled By Default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`

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

## Adapter Capabilities

`data-table-postgres` reports this capability set by default:

- `returning: true`
- `savepoints: true`
- `upsert: true`

## Advanced Usage

### Transaction Options

Transaction options are passed through to the adapter as hints.

```ts
await db.transaction(async (txDb) => txDb.exec('select 1'), {
  isolationLevel: 'serializable',
  readOnly: false,
})
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
