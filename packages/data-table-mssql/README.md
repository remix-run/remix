# data-table-mssql

MSSQL adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).
Use this package when you want `data-table` APIs backed by `mssql`.

## Features

- **Native `mssql` Integration**: Works with `ConnectionPool`
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **MSSQL Capabilities Enabled By Default**:
  - `returning: false`
  - `savepoints: true`
  - `upsert: true`

## Installation

```sh
npm i remix mssql
```

## Usage

```ts
import sql from 'mssql'
import { createDatabase } from 'remix/data-table'
import { createMssqlDatabaseAdapter } from 'remix/data-table-mssql'

let pool = await sql.connect(process.env.DATABASE_URL)

let db = createDatabase(createMssqlDatabaseAdapter(pool))
```

Use `db.query(...)`, relation loading, and transactions from `remix/data-table`.

## Adapter Capabilities

`data-table-mssql` reports this capability set by default:

- `returning: false`
- `savepoints: true`
- `upsert: true`

### `returning` On MSSQL

MSSQL does not support the `RETURNING` clause used by Postgres and SQLite.
When `returning` is `false` (the default), operations like
`db.create(table, values, { returnRow: true })` issue a follow-up `SELECT` to
fetch the created row.

MSSQL _does_ support the `OUTPUT` clause which can serve a similar role. If you
enable the capability override the adapter will use `OUTPUT inserted.*` /
`OUTPUT deleted.*` instead of a follow-up query:

```ts
let adapter = createMssqlDatabaseAdapter(pool, {
  capabilities: { returning: true },
})
```

## Advanced Usage

### Transaction Options

Transaction options are passed through to the adapter as hints.

```ts
await db.transaction(async (txDb) => txDb.exec('select 1'), {
  isolationLevel: 'serializable',
  readOnly: false,
})
```

### Savepoints

MSSQL uses `SAVE TRANSACTION` / `ROLLBACK TRANSACTION` instead of the standard
`SAVEPOINT` / `ROLLBACK TO SAVEPOINT` syntax. Additionally, MSSQL does not
support `RELEASE SAVEPOINT`, so `releaseSavepoint` is a no-op in this adapter.
All other savepoint operations work as expected.

### Capability Overrides For Testing

You can override capabilities to verify fallback paths in tests.

```ts
import { createMssqlDatabaseAdapter } from 'remix/data-table-mssql'

let adapter = createMssqlDatabaseAdapter(pool, {
  capabilities: {
    returning: true,
  },
})
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - Postgres adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
