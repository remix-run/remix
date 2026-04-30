# data-table

Typed relational query toolkit for JavaScript runtimes.

## Features

- **One API Across Databases**: Same query and relation APIs across PostgreSQL, MySQL, and SQLite adapters
- **One Query API**: Build reusable `Query` objects with `query(table)` and execute them with `db.exec(...)`, or use `db.query(table)` as shorthand
- **Type-Safe Reads**: Typed `select`, relation loading, and predicate keys
- **Optional Runtime Validation**: Add `validate(context)` at the table level for create/update validation and coercion
- **Relation-First Queries**: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`, and nested eager loading
- **Safe Scoped Writes**: `update`/`delete` with `orderBy`/`limit` run safely in a transaction
- **First-Class Migrations**: Plain SQL `up.sql`/`down.sql` files with a journaling runner and dry-run planning
- **Raw SQL Escape Hatch**: Execute SQL directly with `db.exec(sql\`...\`)`

`data-table` gives you two complementary APIs:

- [**Query Objects**](#query-objects) for expressive joins, aggregates, eager loading, and scoped writes
- [**CRUD Helpers**](#crud-helpers) for common create/read/update/delete flows (`find`, `create`, `update`, `delete`)

Both APIs are type-safe. Runtime validation is opt-in with table-level `validate(context)`.

## Installation

```sh
npm i remix
npm i pg
# or
npm i mysql2
# or
# use the SQLite client built into your runtime
```

## Setup

Define tables once, then create a database with an adapter.

```ts
import { Pool } from 'pg'
import { column as c, createDatabase, hasMany, query, table } from 'remix/data-table'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'

let users = table({
  name: 'users',
  columns: {
    id: c.uuid(),
    email: c.varchar(255),
    role: c.enum(['customer', 'admin']),
    created_at: c.integer(),
  },
})

let orders = table({
  name: 'orders',
  columns: {
    id: c.uuid(),
    user_id: c.uuid(),
    status: c.enum(['pending', 'processing', 'shipped', 'delivered']),
    total: c.decimal(10, 2),
    created_at: c.integer(),
  },
})

let userOrders = hasMany(users, orders)

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
let db = createDatabase(createPostgresDatabaseAdapter(pool))
```

## Query Objects

Use `query(table)` when you want to build a standalone reusable query object. Execute it later with `db.exec(query)`. Use `db.query(table)` when you want the same chainable `Query` already bound to a database instance.

### Standalone Query Builder

`query(table)` is the primary query-builder API. It gives you an unbound `Query` value that can be composed, stored, reused, and executed against any compatible database instance.

```ts
import { eq, ilike, query } from 'remix/data-table'

let pendingOrdersForExampleUsers = query(orders)
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

let recentPendingOrders = await db.exec(pendingOrdersForExampleUsers)
```

Unbound queries stay lazy until you pass them to `db.exec(...)`:

```ts
let shippedCustomerQuery = query(users)
  .where({ role: 'customer' })
  .with({
    recentOrders: userOrders.where({ status: 'shipped' }).orderBy('created_at', 'desc').limit(3),
  })

let customers = await db.exec(shippedCustomerQuery)

// customers[0].recentOrders is fully typed
```

The same standalone query builder also handles terminal read and write operations:

```ts
let nextPendingOrder = await db.exec(
  query(orders).where({ status: 'pending' }).orderBy('created_at', 'asc').first(),
)

await db.exec(
  query(orders)
    .where({ status: 'pending' })
    .orderBy('created_at', 'asc')
    .limit(100)
    .update({ status: 'processing' }),
)
```

### Bound Query Shorthand

If you already have a `db` instance in hand and do not need a standalone query value, `db.query(table)` returns the same query builder already bound to that database:

```ts
let recentPendingOrders = await db
  .query(orders)
  .where({ status: 'pending' })
  .orderBy('created_at', 'desc')
  .limit(20)
  .all()
```

## CRUD Helpers

`data-table` provides helpers for common create/read/update/delete operations. Use these helpers for common operations without building a full query chain.

### Read operations

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

`createMany`/`insertMany` throw when every row in the batch is empty (no explicit values).

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

`db.update(...)` throws when the target row cannot be found.

Return behavior:

- `find`/`findOne` -> row or `null`
- `findMany` -> rows
- `create` -> `WriteResult` by default, row when `returnRow: true`
- `createMany` -> `WriteResult` by default, rows when `returnRows: true` (not supported in MySQL because it doesn't support `RETURNING`)
- `update` -> updated row (throws when target row is missing)
- `updateMany`/`deleteMany` -> `WriteResult`
- `delete` -> `boolean`

### Validation and Lifecycle

Validation is optional and table-scoped. Define `validate(context)` to validate/coerce write
payloads, and add lifecycle callbacks when you need custom read/write/delete behavior.

```ts
import { column as c, fail, table } from 'remix/data-table'

let payments = table({
  name: 'payments',
  columns: {
    id: c.uuid(),
    amount: c.decimal(10, 2),
  },
  beforeWrite({ value }) {
    return {
      value: {
        ...value,
        amount: typeof value.amount === 'string' ? value.amount.trim() : value.amount,
      },
    }
  },
  validate({ operation, value }) {
    if (operation === 'create' && typeof value.amount === 'string') {
      let amount = Number(value.amount)

      if (!Number.isFinite(amount)) {
        return fail('Expected a numeric amount', ['amount'])
      }

      return { value: { ...value, amount } }
    }

    return { value }
  },
  beforeDelete({ where }) {
    if (where.length === 0) {
      return fail('Refusing unscoped delete')
    }
  },
  afterRead({ value }) {
    if (!('amount' in value)) {
      return { value }
    }

    return {
      value: {
        ...value,
        // Example read-time shaping
        amount:
          typeof value.amount === 'number' ? Math.round(value.amount * 100) / 100 : value.amount,
      },
    }
  },
})
```

Use `fail(...)` in hooks when you want to return issues without manually building `{ issues: [...] }`.

Validation and lifecycle semantics:

- Write order is `beforeWrite -> validate -> timestamp/default touch -> execute -> afterWrite`
- `validate` runs for writes (`create`, `createMany`, `insert`, `insertMany`, `update`, `updateMany`, `upsert`)
- Hook context includes `{ operation: 'create' | 'update', tableName, value }`
- Write payloads are partial objects
- Unknown columns fail validation before and after hook processing
- `beforeDelete` can veto deletes by returning `{ issues }`
- `afterDelete` runs after successful deletes with `affectedRows`
- `afterRead` runs for each loaded row (root rows, eager-loaded relation rows, and write-returning rows)
- `afterRead` receives the current read shape, which may be partial/projection rows; guard field access accordingly
- Predicate values (`where`, `having`, join predicates) are not runtime-validated
- Lifecycle callbacks are synchronous; returning a Promise throws a validation error
- Callback validation errors include `metadata.source` (`beforeWrite`, `validate`, `beforeDelete`, `afterRead`, etc.) for easier debugging
- Callbacks do not introduce implicit transactions (use `db.transaction(...)` when you need rollback guarantees)

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

## Migrations

`data-table` ships a SQL-first migration system under `remix/data-table/migrations`. Each migration
is a directory containing hand-written `up.sql` and (optionally) `down.sql`. The runner journals
applied migrations, detects checksum drift, and wraps each migration in a transaction when the
adapter supports transactional DDL.

### Example Setup

```txt
app/
  db/
    migrations/
      20260228090000_create_users/
        up.sql
        down.sql
      20260301113000_add_user_status/
        up.sql
        down.sql
    migrate.ts
```

- Keep migration directories in one parent directory (for example `app/db/migrations`).
- Each directory is named `YYYYMMDDHHmmss_<slug>`.
- `up.sql` is required. `down.sql` is optional (omit for irreversible migrations).
- Scripts may contain multiple statements. `id` and `name` are inferred from the directory name.

### Migration File Example

`20260228090000_create_users/up.sql`:

```sql
create table users (
  id serial primary key,
  email varchar(255) not null unique,
  created_at timestamptz not null default now()
);

create unique index users_email_idx on users (email);
```

`20260228090000_create_users/down.sql`:

```sql
drop index if exists users_email_idx;
drop table if exists users;
```

### Multi-Statement Driver Configuration

The runner sends each migration to the adapter as a single multi-statement script. Make sure the
underlying driver accepts multiple statements:

- `better-sqlite3`: works out of the box (`db.exec`).
- `pg`: works out of the box when no parameter array is passed.
- `mysql2`: requires `multipleStatements: true` on the connection/pool.

```ts
import { createPool } from 'mysql2/promise'

let pool = createPool({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
})
```

### Runner Script Example

In `app/db/migrate.ts`:

```ts
import path from 'node:path'
import { Pool } from 'pg'
import { createPostgresDatabaseAdapter } from 'remix/data-table-postgres'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'

let directionArg = process.argv[2] ?? 'up'
let direction = directionArg === 'down' ? 'down' : 'up'
let to = process.argv[3]

let pool = new Pool({ connectionString: process.env.DATABASE_URL })
let adapter = createPostgresDatabaseAdapter(pool)
let migrations = await loadMigrations(path.resolve('app/db/migrations'))
let runner = createMigrationRunner(adapter, migrations)

try {
  let result = direction === 'up' ? await runner.up({ to }) : await runner.down({ to })
  console.log(direction + ' complete', {
    applied: result.applied.map((entry) => entry.id),
    reverted: result.reverted.map((entry) => entry.id),
  })
} finally {
  await pool.end()
}
```

Use `journalTable` if you want a custom migrations journal table name:

```ts
let runner = createMigrationRunner(adapter, migrations, {
  journalTable: 'app_migrations',
})
```

Run it with your runtime, for example:

```sh
node ./app/db/migrate.ts up
node ./app/db/migrate.ts up 20260301113000
node ./app/db/migrate.ts down
node ./app/db/migrate.ts down 20260228090000
```

Use `step` for bounded rollforward/rollback behavior instead of a target id:

```ts
await runner.up({ step: 1 })
await runner.down({ step: 1 })
```

`to` and `step` are mutually exclusive within a single run.

Use `dryRun` to inspect the SQL plan without applying or journaling anything:

```ts
let plan = await runner.up({ dryRun: true })
for (let script of plan.sql) {
  console.log(script)
}
```

### Transaction Modes

By default each migration is wrapped in a transaction when the adapter supports transactional DDL.
Override per migration with a directive on the first non-blank line of `up.sql`:

```sql
-- data-table/transaction: none
create index concurrently users_email_active_idx on users (email) where status = 'active';
```

Supported modes:

- `auto` (default): wrap when the adapter supports transactional DDL.
- `required`: wrap; the runner throws if the adapter cannot support it.
- `none`: never wrap. Use this for statements like postgres `CREATE INDEX CONCURRENTLY` that
  cannot run inside a transaction.

You can also set `transaction` directly on a `MigrationDescriptor` when registering migrations
programmatically.

### Programmatic Registration

For non-filesystem runtimes, register migrations directly:

```ts
import { createMigrationRegistry, createMigrationRunner } from 'remix/data-table/migrations'

let registry = createMigrationRegistry()
registry.register({
  id: '20260228090000',
  name: 'create_users',
  up: 'create table users (id serial primary key, email text not null);',
  down: 'drop table users;',
})

let runner = createMigrationRunner(adapter, registry)
await runner.up()
```

## Raw SQL Escape Hatch

```ts
import { rawSql, sql } from 'remix/data-table'

await db.exec(sql`select * from users where id = ${'u_001'}`)
await db.exec(rawSql('update users set role = ? where id = ?', ['admin', 'u_001']))
```

Use `sql` when you need raw SQL plus safe value interpolation:

```ts
import { sql } from 'remix/data-table'

let email = input.email
let minCreatedAt = input.minCreatedAt

let result = await db.exec(sql`
  select id, email
  from users
  where email = ${email}
    and created_at >= ${minCreatedAt}
`)
```

`sql` keeps values parameterized per adapter dialect, so you can avoid manual string concatenation.

## Related Packages

- [`data-schema`](https://github.com/remix-run/remix/tree/main/packages/data-schema) - Optional schema parsing you can use inside table-level `validate(...)` hooks
- [`data-table-postgres`](https://github.com/remix-run/remix/tree/main/packages/data-table-postgres) - PostgreSQL adapter
- [`data-table-mysql`](https://github.com/remix-run/remix/tree/main/packages/data-table-mysql) - MySQL adapter
- [`data-table-sqlite`](https://github.com/remix-run/remix/tree/main/packages/data-table-sqlite) - SQLite adapter

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
