# `@remix-run/data-table`

A relational query toolkit for JavaScript runtimes that composes:

- typed tables (from `@remix-run/data-schema`)
- typed relation loading (`hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`)
- validated writes
- a runtime-agnostic adapter interface

You write one query API and swap adapters for PostgreSQL, MySQL, SQLite, or memory.

## Install

```sh
pnpm add @remix-run/data-table @remix-run/data-schema
```

Then install one adapter:

```sh
pnpm add @remix-run/data-table-postgres pg
# or
pnpm add @remix-run/data-table-mysql mysql2
# or
pnpm add @remix-run/data-table-sqlite better-sqlite3
```

## Connect To A Database

### PostgreSQL

```ts
import { Pool } from 'pg'
import { createDatabase } from '@remix-run/data-table'
import { createPostgresDatabaseAdapter } from '@remix-run/data-table-postgres'

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

let db = createDatabase(createPostgresDatabaseAdapter(pool))
```

### MySQL

```ts
import { createPool } from 'mysql2/promise'
import { createDatabase } from '@remix-run/data-table'
import { createMysqlDatabaseAdapter } from '@remix-run/data-table-mysql'

let pool = createPool(process.env.DATABASE_URL as string)
let db = createDatabase(createMysqlDatabaseAdapter(pool))
```

### SQLite

```ts
import Database from 'better-sqlite3'
import { createDatabase } from '@remix-run/data-table'
import { createSqliteDatabaseAdapter } from '@remix-run/data-table-sqlite'

let sqlite = new Database('app.db')
let db = createDatabase(createSqliteDatabaseAdapter(sqlite))
```

### Memory (tests, prototyping, adapter reference)

```ts
import { createDatabase, createMemoryDatabaseAdapter } from '@remix-run/data-table'

let db = createDatabase(
  createMemoryDatabaseAdapter({
    accounts: [{ id: 1, email: 'owner@example.com', status: 'active' }],
  }),
)
```

## Define Tables And Relations

```ts
import * as s from '@remix-run/data-schema'
import { createTable, timestamps } from '@remix-run/data-table'

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

let Profiles = createTable({
  name: 'profiles',
  columns: {
    id: s.number(),
    account_id: s.number(),
    display_name: s.string(),
  },
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

let Memberships = createTable({
  name: 'memberships',
  primaryKey: ['organization_id', 'account_id'],
  columns: {
    organization_id: s.number(),
    account_id: s.number(),
    role: s.string(),
  },
})

let AccountProjects = Accounts.hasMany(Projects)
let AccountProfile = Accounts.hasOne(Profiles)
let ProjectAccount = Projects.belongsTo(Accounts)
let ProjectTasks = Projects.hasMany(Tasks)
let AccountTasks = Accounts.hasManyThrough(Tasks, { through: AccountProjects })
```

## Query Examples

### Basic reads

```ts
let all = await db.query(Accounts).all()
let first = await db.query(Accounts).where({ status: 'active' }).first()
let byId = await db.query(Accounts).find(1)
let membership = await db.query(Memberships).find({
  organization_id: 42,
  account_id: 7,
})
```

### Filtering and predicates

```ts
import { and, between, eq, ilike, inList, notNull, or } from '@remix-run/data-table'

let rows = await db
  .query(Accounts)
  .where(
    and(
      ilike('email', '%@example.com'),
      or(eq('status', 'active'), eq('status', 'trial')),
      notNull('id'),
      between('id', 1, 1000),
      inList('status', ['active', 'trial']),
    ),
  )
  .orderBy('id', 'desc')
  .limit(25)
  .offset(0)
  .all()
```

### Select, distinct, joins, groupBy, having

For relation traversal, prefer `.with(...)` and declared relations. `join(...)` is a lower-level API for adding join clauses directly.

```ts
import { eq } from '@remix-run/data-table'

let rows = await db
  .query(Accounts)
  .select('id', 'email')
  .distinct()
  .join(Projects, eq('projects.archived', false))
  .groupBy('id', 'email')
  .having(eq('status', 'active'))
  .all()
```

### Count and exists

```ts
let activeCount = await db.query(Accounts).where({ status: 'active' }).count()
let hasArchived = await db.query(Projects).where({ archived: true }).exists()
```

### Eager loading relations

```ts
let accounts = await db
  .query(Accounts)
  .with({
    profile: AccountProfile,
    projects: AccountProjects.where({ archived: false }).orderBy('id', 'asc'),
    tasks: AccountTasks.where({ state: 'open' }).orderBy('id', 'asc'),
  })
  .all()

// Typed relation data
let firstAccount = accounts[0]
let projectCount = firstAccount.projects.length
let maybeProfileName = firstAccount.profile?.display_name
let firstTaskTitle = firstAccount.tasks[0]?.title
```

### Nested eager loading

```ts
let accounts = await db
  .query(Accounts)
  .with({
    projects: AccountProjects.with({
      tasks: ProjectTasks.where({ state: 'open' }),
    }),
  })
  .all()
```

## Write Examples

### insert / insertMany

```ts
let inserted = await db
  .query(Accounts)
  .insert({ id: 1, email: 'a@example.com', status: 'active' }, { returning: ['id', 'email'] })

if ('row' in inserted) {
  inserted.row?.id
}

let batch = await db.query(Accounts).insertMany(
  [
    { id: 2, email: 'b@example.com', status: 'active' },
    { id: 3, email: 'c@example.com', status: 'inactive' },
  ],
  { returning: ['id', 'status'] },
)

if ('rows' in batch) {
  batch.rows.length
}
```

### update / delete

```ts
let updated = await db
  .query(Accounts)
  .where({ status: 'inactive' })
  .update({ status: 'active' }, { returning: ['id', 'status'] })

let deleted = await db
  .query(Accounts)
  .where({ id: 3 })
  .delete({ returning: ['id'] })
```

### Scoped writes with order/limit/offset

When you combine `orderBy`/`limit`/`offset` with `update` or `delete`, data-table scopes the write to the selected primary keys first, then applies the write in a transaction.

```ts
await db
  .query(Accounts)
  .where({ status: 'pending' })
  .orderBy('id', 'asc')
  .limit(100)
  .update({ status: 'active' })
```

### upsert

```ts
let result = await db.query(Accounts).upsert(
  { id: 1, email: 'a@example.com', status: 'inactive' },
  {
    conflictTarget: ['id'],
    returning: ['id', 'status'],
  },
)

if ('row' in result) {
  result.row?.status
}
```

### Runtime validation + timestamp behavior

- Values are validated with the `@remix-run/data-schema` definitions from `createTable`.
- With `timestamps: true`, writes populate `created_at` and `updated_at`.
- You can disable timestamp touching per write with `{ touch: false }`.

```ts
await db
  .query(Accounts)
  .insert({ id: 10, email: 'ops@example.com', status: 'active' }, { touch: false })
```

## Transactions

```ts
await db.transaction(async function (outerTransaction) {
  await outerTransaction
    .query(Accounts)
    .insert({ id: 20, email: 'x@example.com', status: 'active' })

  await outerTransaction
    .transaction(async function (innerTransaction) {
      await innerTransaction
        .query(Accounts)
        .insert({ id: 21, email: 'y@example.com', status: 'active' })

      throw new Error('rollback inner only')
    })
    .catch(function swallow() {
      return undefined
    })
})
```

Nested transactions require adapter savepoint support.

## Raw SQL Escape Hatch

```ts
import { rawSql, sql } from '@remix-run/data-table'

await db.exec(sql`select * from accounts where id = ${42}`)
await db.exec(rawSql('update accounts set status = ? where id = ?', ['active', 42]))
```

`sql` always uses `?` placeholders internally and adapters convert to dialect syntax (for example `$1` for PostgreSQL).

## Error Types

- `DataTableError` base class
- `DataTableValidationError` for schema validation issues
- `DataTableQueryError` for query capability/usage issues
- `DataTableAdapterError` wraps adapter execution failures and includes metadata (dialect + statement kind)
- `DataTableConstraintError` for constraint-related errors

## Adapter Capabilities

Adapters advertise capabilities:

- `returning`
- `savepoints`
- `ilike`
- `upsert`

data-table uses these flags to:

- choose native `RETURNING` vs fallback loading
- allow/deny nested transactions
- compile `ilike` correctly by dialect
- allow/deny `upsert()`

## API Summary

- `createTable({ name, columns, primaryKey, timestamps })`
- `createDatabase(adapter, { now? })`
- Relations: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`
- Querying: `select`, `distinct`, `where`, `join`, `leftJoin`, `rightJoin`, `fullJoin`, `groupBy`, `having`, `orderBy`, `limit`, `offset`, `with`, `all`, `first`, `find`, `count`, `exists`
- Writes: `insert`, `insertMany`, `update`, `delete`, `upsert`
- Transactions: `db.transaction(async (tx) => ...)`
- SQL escape hatch: `db.exec(sql(...))` and `db.exec(rawSql(...))`
- Built-in test/reference adapter: `createMemoryDatabaseAdapter`, `MemoryDatabaseAdapter`
