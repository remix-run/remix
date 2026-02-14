# data-table

Relational query toolkit for JavaScript runtimes. `data-table` gives you one typed API for
PostgreSQL, MySQL, and SQLite adapters.

## Features

- **One API Across Databases**: Same query and relation APIs across adapters
- **Type-Safe Reads**: Typed `select`, relation loading, and predicate keys
- **Validated Writes and Filters**: Values are parsed with your `remix/data-schema` definitions
- **Relation-First Queries**: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`, and nested eager loading
- **Safe Scoped Writes**: `update`/`delete` with `orderBy`/`limit` run safely in a transaction
- **Raw SQL Escape Hatch**: Execute SQL directly with `db.exec(sql\`...\`)`

## Installation

Install Remix and a database driver:

```sh
npm i remix
npm i pg
# or
npm i mysql2
# or
npm i better-sqlite3
```

## Usage

Define your tables and relations once, then query through an adapter-backed database.

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

## Advanced Usage

### Adapter Setup

`data-table` ships with support for the following databases:

- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

For tests, you can use a SQLite in-memory database.

```ts
import Database from 'better-sqlite3'
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

let sqlite = new Database(':memory:')
sqlite.exec(
  'create table accounts (id integer primary key, email text not null, status text not null)',
)

let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

### Query Composition

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

### Scoped Writes

When you scope `update`/`delete` with ordering or limits, `data-table` first resolves target
primary keys, then applies the write in a transaction.

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
