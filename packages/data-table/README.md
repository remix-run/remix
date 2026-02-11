# data-table

`data-table` is a relational data toolkit for JavaScript runtimes. It gives you a single query API that works across PostgreSQL, MySQL, SQLite, and an in-memory adapter for tests.

If you want Drizzle/ActiveRecord-style ergonomics with explicit schemas, typed relations, and predictable runtime behavior across adapters, this package is designed for that.

## Features

- **One API across databases**: same query builder and relation API across adapters
- **Type-safe reads**: typed `select`, typed relation loading, typed predicate keys
- **Validated writes and filters**: values are parsed with your `remix/data-schema` definitions
- **Relation-first querying**: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`, nested eager loading
- **Safe write behavior**: scoped `update`/`delete` with `orderBy`/`limit` execute safely in a transaction
- **Escape hatch included**: execute raw SQL when needed with `db.exec(sql\`...\`)`

## Installation

Install the umbrella package and your SQL driver:

```sh
pnpm add remix
# and one or more drivers
pnpm add pg
# or
pnpm add mysql2
# or
pnpm add better-sqlite3
```

## Usage

The core flow is:

1. Define tables and relations once
2. Create a database with an adapter
3. Query and write using one consistent API

```ts
import * as s from 'remix/data-schema'
import { Pool } from 'pg'
import { createDatabase, createTable, eq, timestamps } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let Accounts = createTable({
  name: 'accounts',
  columns: {
    id: s.number(),
    email: s.string(),
    status: s.string(),
    ...timestamps(),
  },
  timestamps: true,
})

let Projects = createTable({
  name: 'projects',
  columns: {
    id: s.number(),
    account_id: s.number(),
    name: s.string(),
    archived: s.boolean(),
  },
})

let Tasks = createTable({
  name: 'tasks',
  columns: {
    id: s.number(),
    project_id: s.number(),
    title: s.string(),
    state: s.string(),
  },
})

let AccountProjects = Accounts.hasMany(Projects)
let ProjectTasks = Projects.hasMany(Tasks)

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
let db = createDatabase(createPostgresDatabaseAdapter(pool))

let accounts = await db
  .query(Accounts)
  .where({ status: 'active' })
  .with({
    projects: AccountProjects.where({ archived: false }).with({
      tasks: ProjectTasks.where({ state: 'open' }),
    }),
  })
  .all()

await db
  .query(Accounts)
  .where(eq('accounts.id', 1))
  .update({ status: 'inactive' }, { returning: ['id', 'status'] })

// accounts[0].projects and accounts[0].projects[0].tasks are typed
```

Why this matters in practice:

- You can move between adapters without rewriting query code
- Relation loading is explicit and typed, which makes refactors safer
- Invalid write/filter values fail early with useful validation errors

## Advanced Usage

### Connect With Different Adapters

```ts
import { createDatabase } from 'remix/data-table'
import { createMysqlDatabaseAdapter } from 'remix/data-table-mysql'
import { createPool } from 'mysql2/promise'

let mysqlPool = createPool(process.env.DATABASE_URL as string)
let db = createDatabase(createMysqlDatabaseAdapter(mysqlPool))
```

```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

```ts
import { createDatabase, createMemoryDatabaseAdapter } from 'remix/data-table'

let db = createDatabase(
  createMemoryDatabaseAdapter({
    accounts: [{ id: 1, email: 'owner@example.com', status: 'active' }],
  }),
)
```

### Query Composition (Join, Select, Grouping)

```ts
import { eq } from 'remix/data-table'

let rows = await db
  .query(Accounts)
  .join(Projects, eq('accounts.id', 'projects.account_id'))
  .where(eq('projects.archived', false))
  .select({
    accountId: 'accounts.id',
    accountEmail: 'accounts.email',
    projectName: 'projects.name',
  })
  .orderBy('projects.name', 'asc')
  .all()
```

### Scoped Writes With `orderBy`/`limit`/`offset`

When you scope `update`/`delete` with ordering/limits, `data-table` first resolves the targeted primary keys and then applies the write inside a transaction.

```ts
await db
  .query(Accounts)
  .where({ status: 'pending' })
  .orderBy('id', 'asc')
  .limit(100)
  .update({ status: 'active' })
```

### Transactions

```ts
await db.transaction(async (outerTransaction) => {
  await outerTransaction
    .query(Accounts)
    .insert({ id: 20, email: 'x@example.com', status: 'active' })

  await outerTransaction
    .transaction(async (innerTransaction) => {
      await innerTransaction
        .query(Accounts)
        .insert({ id: 21, email: 'y@example.com', status: 'active' })

      throw new Error('rollback inner only')
    })
    .catch(() => undefined)
})
```

### Returning Behavior On Adapters Without Native `RETURNING`

Some adapters (for example MySQL) do not support SQL `RETURNING`. In those cases, `data-table` uses fallback reads.

For composite primary keys, include all key columns in insert/upsert values when requesting `returning`, so rows can be re-identified safely.

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

### Raw SQL Escape Hatch

```ts
import { rawSql, sql } from 'remix/data-table'

await db.exec(sql`select * from accounts where id = ${42}`)
await db.exec(rawSql('update accounts set status = ? where id = ?', ['active', 42]))
```

## Related Packages

- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and parsing used by `data-table`
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
