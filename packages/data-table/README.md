# data-table

Typed relational query toolkit for JavaScript runtimes.

## Features

- **One API Across Databases**: Same query and relation APIs across PostgreSQL, MySQL, and SQLite adapters
- **One Execution Model**: Build `Query` objects with `query(table)` and execute them with `db.exec(...)`
- **Type-Safe Reads**: Typed `select`, relation loading, and predicate keys
- **Optional Runtime Validation**: Add `validate(context)` at the table level for create/update validation and coercion
- **Relation-First Queries**: `hasMany`, `hasOne`, `belongsTo`, `hasManyThrough`, and nested eager loading
- **Safe Scoped Writes**: `update`/`delete` with `orderBy`/`limit` run safely in a transaction
- **First-Class Migrations**: Up/down migrations with schema builders, runner controls, and dry-run planning
- **Raw SQL Escape Hatch**: Execute SQL directly with `db.exec(sql\`...\`)`

`data-table` has one mental model:

- build query objects with `query(table)`
- execute them with `db.exec(...)`
- use `sql` when you need a raw SQL escape hatch

Runtime validation is opt-in with table-level `validate(context)`.

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

`query(table)` is the primary API. It gives you a composable `Query` value that stays lazy until you pass it to `db.exec(...)`.

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

Relation loading stays on the query object:

```ts
let shippedCustomerQuery = query(users)
  .where({ role: 'customer' })
  .with({
    recentOrders: userOrders.where({ status: 'shipped' }).orderBy('created_at', 'desc').limit(3),
  })

let customers = await db.exec(shippedCustomerQuery)

// customers[0].recentOrders is fully typed
```

Common single-row and list reads use the same model:

```ts
let user = await db.exec(query(users).find('u_001'))

let firstPending = await db.exec(
  query(orders).where({ status: 'pending' }).orderBy('created_at', 'asc').first(),
)

let page = await db.exec(
  query(orders)
    .where({ status: 'pending' })
    .orderBy('created_at', 'desc')
    .limit(50)
    .offset(0)
    .all(),
)
```

Writes also go through `query(table)` plus `db.exec(...)`:

```ts
let createResult = await db.exec(
  query(users).insert({
    id: 'u_002',
    email: 'sam@example.com',
    role: 'customer',
    created_at: Date.now(),
  }),
)

let createdUserResult = await db.exec(
  query(users).insert(
    {
      id: 'u_003',
      email: 'pat@example.com',
      role: 'customer',
      created_at: Date.now(),
    },
    { returning: '*' },
  ),
)

let createdUser = 'row' in createdUserResult ? createdUserResult.row : null

await db.exec(
  query(orders)
    .where({ status: 'pending' })
    .orderBy('created_at', 'asc')
    .limit(100)
    .update({ status: 'processing' }),
)
```

Use `returning: '*'` or a column list when you want rows back from a write and your adapter supports `RETURNING`.

### Validation and Lifecycle

Validation is optional and table-scoped. Define `validate(context)` to validate/coerce write
payloads, and add lifecycle callbacks when you need custom read/write/delete behavior.

```ts
import { column as c, table } from 'remix/data-table'

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
        return {
          issues: [{ message: 'Expected a numeric amount', path: ['amount'] }],
        }
      }

      return { value: { ...value, amount } }
    }

    return { value }
  },
  beforeDelete({ where }) {
    if (where.length === 0) {
      return {
        issues: [{ message: 'Refusing unscoped delete' }],
      }
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

Return `{ issues: [...] }` from hooks when you need to reject a write or delete.

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

`data-table` includes a first-class migration system under `remix/data-table/migrations`.
Migrations are adapter-driven: adapters execute SQL for their dialect/runtime, and SQL compilation
stays inside each adapter package.

### Example Setup

```txt
app/
  db/
    migrations/
      20260228090000_create_users.ts
      20260301113000_add_user_status.ts
    migrate.ts
```

- Keep migration files in one directory (for example `app/db/migrations`).
- Name each file as `YYYYMMDDHHmmss_name.ts` (or `.js`, `.mjs`, `.cjs`, `.cts`).
- Each file must `default` export `createMigration(...)`; `id` and `name` are inferred from filename.

### Migration File Example

```ts
import { column as c, table } from 'remix/data-table'
import { createMigration } from 'remix/data-table/migrations'

let users = table({
  name: 'users',
  columns: {
    id: c.integer().primaryKey(),
    email: c.varchar(255).notNull().unique(),
    created_at: c.timestamp({ withTimezone: true }).defaultNow(),
  },
})

export default createMigration({
  async up({ db, schema }) {
    await schema.createTable(users)
    await schema.createIndex(users, 'email', { unique: true })

    if (db.adapter.dialect === 'sqlite') {
      await db.exec('pragma foreign_keys = on')
    }
  },
  async down({ schema }) {
    await schema.dropTable(users, { ifExists: true })
  },
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

Use `step` when you want bounded rollforward/rollback behavior instead of a target id:

```ts
await runner.up({ step: 1 })
await runner.down({ step: 1 })
```

`to` and `step` are mutually exclusive. Use one or the other for a given run.

Use `dryRun` to compile and inspect the SQL plan without applying migrations:

```ts
let dryRunResult = await runner.up({ dryRun: true })
console.log(dryRunResult.sql)
```

When migration transactions are enabled, migration-time `schema.createTable(...)`, `db.exec(...)`,
query-builder data operations, and `schema.hasTable(...)` / `schema.hasColumn(...)` all run in the same
adapter transaction context.

You can also pass a pre-built SQL statement into `schema.plan(...)` when authoring migrations:

```ts
import { sql } from 'remix/data-table'

await schema.plan(sql`update users set status = ${'active'} where status is null`)
```

You can run lightweight schema checks inside a migration with `schema.hasTable(...)` and
`schema.hasColumn(...)` when you need defensive conditional behavior. Methods that take a table name
accept either a string (`'app.users'`) or a `table(...)` object.

In `dryRun` mode, introspection methods still check the live database state. They do not simulate
tables/columns from pending operations in the current dry-run plan.

For key-oriented migration APIs, single-column and compound forms are both supported:

```ts
await schema.alterTable(users, (table) => {
  table.addPrimaryKey('id')
  table.addForeignKey('account_id', 'accounts', 'id')
  table.addForeignKey(['tenant_id', 'account_id'], 'accounts', ['tenant_id', 'id'])
})
```

Constraint and index names are optional in migration APIs. When omitted, `data-table` generates
deterministic names for primary keys, uniques, foreign keys, checks, and indexes.

This is useful when you want to:

- Review generated SQL in CI before deploying
- Verify migration ordering and target/step selection
- Audit dialect-specific SQL differences across adapters

For non-filesystem runtimes, register migrations manually:

```ts
import { createMigrationRegistry, createMigrationRunner } from 'remix/data-table/migrations'
import createUsers from './db/migrations/20260228090000_create_users.ts'

let registry = createMigrationRegistry()
registry.register({ id: '20260228090000', name: 'create_users', migration: createUsers })

// adapter from createPostgresDatabaseAdapter/createMysqlDatabaseAdapter/createSqliteDatabaseAdapter
let runner = createMigrationRunner(adapter, registry)
await runner.up()
```

## Raw SQL Escape Hatch

```ts
import { sql } from 'remix/data-table'

await db.exec(sql`select * from users where id = ${'u_001'}`)
await db.exec('update users set role = ? where id = ?', ['admin', 'u_001'])
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
