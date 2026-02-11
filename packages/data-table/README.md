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

Install Remix + your database driver of choice:

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

`data-table` ships with support for the following databases:

- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

It also ships with an in-memory adapter useful in testing and development.

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
await db.transaction(async (outerTx) => {
  await outerTx.query(Accounts).insert({ id: 20, email: 'x@example.com', status: 'active' })

  await outerTx
    .transaction(async (innerTx) => {
      await innerTx.query(Accounts).insert({ id: 21, email: 'y@example.com', status: 'active' })

      throw new Error('rollback inner only')
    })
    .catch(() => undefined)
})
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
