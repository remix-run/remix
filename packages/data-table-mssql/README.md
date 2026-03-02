# data-table-mssql

SQL Server adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).
Use this package when you want `data-table` APIs backed by `mssql`.

## Features

- **Native `mssql` Integration**: Works with `ConnectionPool` and SQL Server connection strings
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **Adapter-Owned Compiler**: SQL compilation lives in this adapter, with optional shared pure helpers from `data-table`
- **Migration DDL Support**: Compiles and executes `DataMigrationOperation` operations for `remix/data-table/migrations`
- **MSSQL Capabilities Enabled By Default**:
  - `returning: false`
  - `savepoints: true`
  - `upsert: true`
  - `transactionalDdl: true`
  - `migrationLock: true`

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
- `transactionalDdl: true`
- `migrationLock: true`

## Advanced Usage

### Transaction Options

Transaction options are passed through to the adapter as hints.

```ts
await db.transaction(async (txDb) => txDb.exec('select 1'), {
  isolationLevel: 'serializable',
})
```

> **Note:** SQL Server does not support `SET TRANSACTION READ ONLY`. The
> `readOnly` option is accepted but silently ignored.

### `returning` On MSSQL

SQL Server does not support the `RETURNING` clause used by Postgres and SQLite.
When `returning` is `false` (the default), operations like
`db.create(table, values, { returnRow: true })` issue a follow-up `SELECT` to
fetch the created row.

You can enable `OUTPUT` clause support via a capability override:

```ts
let adapter = createMssqlDatabaseAdapter(pool, {
  capabilities: { returning: true },
})
```

> **Note:** SQL Server does not allow `OUTPUT` without `INTO` on tables that
> have triggers. If your tables use triggers, keep `returning: false` (the
> default).

### Capability Overrides For Testing

You can override capabilities to verify fallback paths in tests.

```ts
import { createMssqlDatabaseAdapter } from 'remix/data-table-mssql'

let adapter = createMssqlDatabaseAdapter(pool, {
  capabilities: {
    savepoints: false,
  },
})
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - Postgres adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
