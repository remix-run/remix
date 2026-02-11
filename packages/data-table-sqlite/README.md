# data-table-sqlite

`data-table-sqlite` is the SQLite adapter for [`remix/data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table).

Use this when you want the same relational API from `remix/data-table` with a fast local SQLite database (`better-sqlite3`).

## Features

- **SQLite integration** via `better-sqlite3`
- **Works with `remix/data-table`** query, relation loading, writes, and transactions APIs
- **Native capabilities enabled by default**:
  - `returning: true`
  - `savepoints: true`
  - `upsert: true`

## Installation

```sh
pnpm add remix better-sqlite3
```

## Usage

```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

This is a good fit for local development, embedded deployments, and single-node services where SQLite is preferred.

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
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
