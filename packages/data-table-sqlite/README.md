# data-table-sqlite

SQLite adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).
Use this package when you want `data-table` APIs backed by `better-sqlite3`.

## Features

- **Native `better-sqlite3` Integration**: Works well for local and embedded deployments
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **Adapter-Owned Compiler**: SQL compilation lives in this adapter, with optional shared pure helpers from `data-table`
- **Migration DDL Support**: Compiles and executes `DataMigrationOperation` operations for `remix/data-table/migrations`
- **SQLite Capabilities Enabled By Default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`
  - `transactionalDdl: true`
  - `migrationLock: false`

## Installation

```sh
npm i remix better-sqlite3
```

## Usage

```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

This is a good fit for local development, embedded deployments, and single-node services.

## Adapter Capabilities

`data-table-sqlite` reports this capability set by default:

- `returning: true`
- `savepoints: true`
- `upsert: true`
- `transactionalDdl: true`
- `migrationLock: false`

## Advanced Usage

### In-Memory Database For Tests

```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database(':memory:')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

### Capability Overrides For Fallback Testing

```ts
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let adapter = createSqliteDatabaseAdapter(sqlite, {
  capabilities: {
    returning: false,
  },
})
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
