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

```ts
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'

let adapter = createMysqlDatabaseAdapter(pool, {
  capabilities: {
    returning: true,
  },
})
```

### `returning` Fallback Details (MySQL)

Because MySQL does not natively support SQL `RETURNING`, `remix/data-table` uses follow-up reads for `returning` requests.

For composite primary keys, include all PK values when inserting/upserting with `returning` so rows can be re-identified safely.

```ts
import * as s from 'remix/data-schema'
import { createTable } from 'remix/data-table'

let AuditEvents = createTable({
  name: 'audit_events',
  primaryKey: ['tenant_id', 'id'],
  columns: {
    tenant_id: s.number(),
    id: s.number(),
    message: s.string(),
  },
})

await db
  .query(AuditEvents)
  .insert({ tenant_id: 42, id: 9001, message: 'created' }, { returning: ['tenant_id', 'id'] })
```

## Related Packages

- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - Core query/relations API
- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and validation
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
