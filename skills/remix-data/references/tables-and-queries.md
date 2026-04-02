# Tables and Queries

Use `remix/data-table` for table definitions, column types, relations, CRUD operations, query
building, transactions, lifecycle hooks, and raw SQL.

## Table Definitions

Define tables in `app/data/schema.ts`:

```ts
import { column as c, table } from 'remix/data-table'
import type { TableRow } from 'remix/data-table'

export const books = table({
  name: 'books',
  columns: {
    id: c.integer(),
    slug: c.text(),
    title: c.text(),
    author: c.text(),
    price: c.decimal(10, 2),
    genre: c.text(),
    in_stock: c.boolean(),
  },
})

export type Book = TableRow<typeof books>
```

### Column Types

```ts
c.integer()
c.text()
c.boolean()
c.decimal(precision, scale)
c.varchar(length)
c.uuid()
c.enum(['value1', 'value2'])
```

### Composite Primary Keys

```ts
export const orderItems = table({
  name: 'order_items',
  primaryKey: ['order_id', 'book_id'],
  columns: {
    order_id: c.integer(),
    book_id: c.integer(),
    quantity: c.integer(),
  },
})
```

## Relations

Define relations between tables to enable eager loading:

```ts
import { belongsTo, hasMany } from 'remix/data-table'
import type { TableRowWith } from 'remix/data-table'

export const itemsByOrder = hasMany(orders, orderItems)
export const bookForOrderItem = belongsTo(orderItems, books)

export const orderItemsWithBook = itemsByOrder
  .orderBy('book_id', 'asc')
  .with({ book: bookForOrderItem })

export type Order = TableRowWith<typeof orders, { items: OrderItem[] }>
export type OrderItem = TableRowWith<
  typeof itemsByOrder.targetTable,
  { book: TableRow<typeof bookForOrderItem.targetTable> | null }
>
```

Available relation helpers: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`.

Relations are chainable: `.orderBy(...)`, `.where(...)`, `.limit(...)`, `.with(...)`.

## Database Setup

```ts
import { createDatabase } from 'remix/data-table'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'
import BetterSqlite3 from 'better-sqlite3'

const sqlite = new BetterSqlite3('db/app.sqlite')
sqlite.pragma('foreign_keys = ON')
const adapter = createSqliteDatabaseAdapter(sqlite)

export const db = createDatabase(adapter)
```

Adapters: `remix/data-table-sqlite`, `remix/data-table-postgres`, `remix/data-table-mysql`.

## CRUD Helpers

### Read

```ts
let book = await db.find(books, bookId)
let firstPending = await db.findOne(orders, {
  where: { status: 'pending' },
  orderBy: ['created_at', 'asc'],
})
let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
let count = await db.count(books)
```

`where` accepts object predicates or operator helpers:

```ts
import { ilike, or } from 'remix/data-table'

let results = await db.findMany(books, {
  where: ilike('genre', genre),
})

let page = await db.findMany(orders, {
  where: or({ status: 'pending' }, { status: 'processing' }),
  orderBy: [['status', 'asc'], ['created_at', 'desc']],
  limit: 50,
  offset: 0,
})
```

Load relations with `with`:

```ts
let order = await db.find(orders, orderId, {
  with: { items: orderItemsWithBook },
})
```

### Create

```ts
await db.create(books, { slug: 'new-book', title: 'New Book', price: 19.99 })

let created = await db.create(
  books,
  { slug: 'new-book', title: 'New Book', price: 19.99 },
  { returnRow: true },
)

await db.createMany(books, [
  { slug: 'book-1', title: 'Book 1', price: 9.99 },
  { slug: 'book-2', title: 'Book 2', price: 14.99 },
])
```

### Update and Delete

```ts
let updated = await db.update(books, bookId, { price: 24.99 })
await db.updateMany(orders, { status: 'processing' }, {
  where: { status: 'pending' },
  limit: 25,
})

await db.delete(books, bookId)
await db.deleteMany(orders, {
  where: { status: 'delivered' },
  limit: 200,
})
```

## Query Builder

Use `db.query(table)` for more complex queries:

```ts
let genres = await db.query(books)
  .select('genre')
  .distinct()
  .orderBy('genre', 'asc')
  .all()
```

Use `query(table)` from `remix/data-table` for standalone reusable queries:

```ts
import { eq, query } from 'remix/data-table'

let pendingOrders = query(orders)
  .join(users, eq(orders.user_id, users.id))
  .where({ status: 'pending' })
  .select({ orderId: orders.id, email: users.email, total: orders.total })
  .orderBy(orders.created_at, 'desc')
  .limit(20)

let results = await db.exec(pendingOrders)
```

Terminal operations: `.all()`, `.first()`, `.update(values)`, `.delete()`.

## Transactions

Wrap related writes in a transaction for atomicity:

```ts
let order = await db.transaction(async (tx) => {
  let created = await tx.create(orders, {
    user_id: user.id,
    total,
    shipping_address_json: JSON.stringify(address),
  }, { returnRow: true })

  await tx.createMany(orderItems, items.map((item) => ({
    order_id: created.id,
    book_id: item.bookId,
    title: item.title,
    unit_price: item.price,
    quantity: item.quantity,
  })))

  return await tx.find(orders, created.id, {
    with: { items: orderItemsWithBook },
  })
})
```

`tx` has the same API as `db`. The transaction rolls back if the callback throws.

## Lifecycle Hooks

Add hooks to table definitions for normalization, validation, and read-time shaping:

```ts
export const books = table({
  name: 'books',
  columns: { /* ... */ },
  beforeWrite({ value }) {
    let next = { ...value }
    if (typeof next.slug === 'string') {
      next.slug = next.slug.trim().toLowerCase().replace(/\s+/g, '-')
    }
    return { value: next }
  },
  validate({ operation, value }) {
    let issues = []
    if (operation === 'create' && !value.title) {
      issues.push({ message: 'Title is required.', path: ['title'] })
    }
    return issues.length > 0 ? { issues } : { value }
  },
  afterRead({ value }) {
    if (typeof value.cover_url === 'string' && value.cover_url.trim() === '') {
      return { value: { ...value, cover_url: '/images/placeholder.jpg' } }
    }
    return { value }
  },
})
```

Hook execution order for writes: `beforeWrite` → `validate` → execute → `afterWrite`.

Other hooks: `beforeDelete`, `afterDelete`, `afterRead`.

Use `fail(message, path?)` from `remix/data-table` as a shorthand for returning `{ issues: [...] }`.

## Raw SQL

Use `sql` for parameterized raw queries and `rawSql` for pre-built strings:

```ts
import { sql, rawSql } from 'remix/data-table'

let result = await db.exec(sql`select * from users where email = ${email}`)
await db.exec(rawSql('update users set role = ? where id = ?', ['admin', 'u_001']))
```

## Context Token

Controllers access the database through the `Database` context token:

```ts
import { Database } from 'remix/data-table'

async function index({ get }) {
  let db = get(Database)
  let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
}
```

The `Database` token is set by the `loadDatabase()` middleware. See
[../SKILL.md](../SKILL.md) for the middleware pattern.
