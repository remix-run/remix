# data-table-sqlite

SQLite adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table). Use this package when you want `data-table` APIs backed by a synchronous SQLite client.

## Features

- **Native Runtime SQLite Support**: Opens a configured filename with Node's `node:sqlite` or Bun's `bun:sqlite`, or uses a compatible synchronous SQLite client
- **Full `data-table` API Support**: Queries, relations, writes, and transactions
- **Adapter-Owned Compiler**: SQL compilation lives in this adapter, with optional shared pure helpers from `data-table`
- **Multi-Statement Migrations**: `executeScript()` runs `up.sql` / `down.sql` files via `Database.exec()`
- **SQLite Capabilities Enabled By Default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`
  - `transactionalDdl: true`
  - `migrationLock: false`

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

let db = createDatabase(
  createSqliteDatabaseAdapter({
    filename: 'app.db',
  }),
)
```

The config-backed adapter uses `node:sqlite` in Node.js and `bun:sqlite` in Bun. It supports `db.wipe()` and `db.reset()` because the adapter can close and reopen the database file.

You may also pass an existing synchronous client when your application owns its lifecycle:

```ts
import { Database } from 'bun:sqlite'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

Destructive lifecycle methods are unavailable when you pass an existing client.

This is a good fit for local development, embedded deployments, and single-node services. Import any driver-specific types you need directly from your runtime's SQLite module.

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
import { DatabaseSync } from 'node:sqlite'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table/sqlite'

let sqlite = new DatabaseSync(':memory:')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema parsing and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
