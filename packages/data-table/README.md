# data-table

Typed relational query toolkit for JavaScript runtimes.

## Features

- **One API Across Databases**: Same query and relation APIs across PostgreSQL, MySQL, and SQLite adapters
- **Two Complementary Query Styles**: Use the chainable query builder for advanced queries or high-level database helpers for common CRUD
- **Type-Safe Reads**: Typed `select`, relation loading, and predicate keys
- **Validated Writes and Filters**: Values are parsed with your `remix/data-schema` definitions
- **Relation-First Queries**: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`, and nested eager loading
- **Safe Scoped Writes**: `update`/`delete` with `orderBy`/`limit` run safely in a transaction
- **Raw SQL Escape Hatch**: Execute SQL directly with `db.exec(sql\`...\`)`

`data-table` gives you two complementary APIs:

- **Query Builder API** for expressive joins, aggregates, eager loading, and scoped writes
- **Database Helper API** for common CRUD flows (`find`, `create`, `update`, `delete`)

Both APIs are type-safe and validate values using your `remix/data-schema` definitions.

## Installation

```sh
npm i remix
npm i pg
# or
npm i mysql2
# or
npm i better-sqlite3
```

## Setup

Define tables once, then create a database with an adapter.

```ts
import { Pool } from 'pg'
import * as s from 'remix/data-schema'
import { createDatabase, createTable, hasMany } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let users = createTable({
  name: 'users',
  columns: {
    id: s.string(),
    email: s.string(),
    role: s.enum_(['customer', 'admin']),
    created_at: s.number(),
  },
})

let orders = createTable({
  name: 'orders',
  columns: {
    id: s.string(),
    user_id: s.string(),
    status: s.enum_(['pending', 'processing', 'shipped', 'delivered']),
    total: s.number(),
    created_at: s.number(),
  },
})

let userOrders = hasMany(users, orders)

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
let db = createDatabase(createPostgresDatabaseAdapter(pool))
```

## Query Builder API

Use `db.query(Table)` when you need joins, custom shape selection, eager loading, or aggregate logic.

```ts
import { eq, ilike } from 'remix/data-table'

let recentPendingOrders = await db
  .query(orders)
  .join(users, eq(orders.user_id, users.id))
  .where({ status: 'pending' })
  .where(ilike(users.email, '%@example.com'))
  .select({
    orderId: orders.id,
    customerEmail: users.email,
    total: orders.total,
    placedAt: orders.created_at,
  })
  .orderBy(orders.created_at, 'desc')
  .limit(20)
  .all()
```

Load relations with relation-scoped filtering and ordering:

```ts
let customers = await db
  .query(users)
  .where({ role: 'customer' })
  .with({
    recentOrders: userOrders.where({ status: 'shipped' }).orderBy('created_at', 'desc').limit(3),
  })
  .all()

// customers[0].recentOrders is fully typed
```

Run scoped writes safely with the same chainable API:

```ts
await db
  .query(orders)
  .where({ status: 'pending' })
  .orderBy('created_at', 'asc')
  .limit(100)
  .update({ status: 'processing' })
```

## Database Helper API (High-Level CRUD)

Use these helpers for common operations without building a full query chain.

### Read helpers

```ts
import { or } from 'remix/data-table'

let user = await db.find(users, 'u_001')

let firstPending = await db.findOne(orders, {
  where: { status: 'pending' },
  orderBy: ['created_at', 'asc'],
})

let page = await db.findMany(orders, {
  where: or({ status: 'pending' }, { status: 'processing' }),
  orderBy: [
    ['status', 'asc'],
    ['created_at', 'desc'],
  ],
  limit: 50,
  offset: 0,
})
```

`where` accepts the same single-table object/predicate inputs as `query().where(...)`, and `orderBy` uses tuple form:

- `['column', 'asc' | 'desc']`
- `[['columnA', 'asc'], ['columnB', 'desc']]`

### Create helpers

```ts
// Default: metadata (affectedRows/insertId)
let createResult = await db.create(users, {
  id: 'u_002',
  email: 'sam@example.com',
  role: 'customer',
  created_at: Date.now(),
})

// Return a typed row (with optional relations)
let createdUser = await db.create(
  users,
  {
    id: 'u_003',
    email: 'pat@example.com',
    role: 'customer',
    created_at: Date.now(),
  },
  {
    returnRow: true,
    with: { recentOrders: userOrders.orderBy('created_at', 'desc').limit(1) },
  },
)

// Bulk insert metadata
let createManyResult = await db.createMany(orders, [
  { id: 'o_101', user_id: 'u_002', status: 'pending', total: 24.99, created_at: Date.now() },
  { id: 'o_102', user_id: 'u_003', status: 'pending', total: 48.5, created_at: Date.now() },
])

// Return inserted rows (requires adapter RETURNING support)
let insertedRows = await db.createMany(
  orders,
  [{ id: 'o_103', user_id: 'u_003', status: 'pending', total: 12, created_at: Date.now() }],
  { returnRows: true },
)
```

### Update and delete helpers

```ts
let updatedUser = await db.update(users, 'u_003', { role: 'admin' })

let updateManyResult = await db.updateMany(
  orders,
  { status: 'processing' },
  {
    where: { status: 'pending' },
    orderBy: ['created_at', 'asc'],
    limit: 25,
  },
)

let deletedUser = await db.delete(users, 'u_002')

let deleteManyResult = await db.deleteMany(orders, {
  where: { status: 'delivered' },
  orderBy: [['created_at', 'asc']],
  limit: 200,
})
```

Return behavior:

- `find`/`findOne` -> row or `null`
- `findMany` -> rows
- `create` -> `WriteResult` by default, row when `returnRow: true`
- `createMany` -> `WriteResult` by default, rows when `returnRows: true` (RETURNING adapters only)
- `update` -> updated row or `null`
- `updateMany`/`deleteMany` -> `WriteResult`
- `delete` -> `boolean`

## Transactions

```ts
await db.transaction(async (tx) => {
  let user = await tx.create(
    users,
    { id: 'u_010', email: 'new@example.com', role: 'customer', created_at: Date.now() },
    { returnRow: true },
  )

  await tx.create(orders, {
    id: 'o_500',
    user_id: user.id,
    status: 'pending',
    total: 79,
    created_at: Date.now(),
  })
})
```

## Raw SQL Escape Hatch

```ts
import { rawSql, sql } from 'remix/data-table'

await db.exec(sql`select * from users where id = ${'u_001'}`)
await db.exec(rawSql('update users set role = ? where id = ?', ['admin', 'u_001']))
```

## Related Packages

- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Schema definitions and parsing used by `data-table`
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
