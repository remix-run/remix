# Migrations and Seeding

Use `remix/data-table/migrations` for schema migrations and `remix/data-table/migrations/node` for
loading migration files from disk.

## Migration File Format

Keep migration files in `db/migrations/`. Name each file `YYYYMMDDHHmmss_description.ts`. Each file
default-exports `createMigration(...)`.

```ts
import { column as c, createMigration } from 'remix/data-table/migrations'
import { table } from 'remix/data-table'

export default createMigration({
  async up({ schema }) {
    let users = table({
      name: 'users',
      columns: {
        id: c.integer().primaryKey().autoIncrement(),
        email: c.text().notNull().unique(),
        name: c.text().notNull(),
        role: c.text().notNull(),
        created_at: c.integer().notNull(),
      },
    })
    await schema.createTable(users)
    await schema.createIndex(users, 'email', { unique: true })
  },
  async down({ schema }) {
    await schema.dropTable('users', { ifExists: true })
  },
})
```

### Migration Column Builders

Migration columns use a builder API with constraints that runtime `table(...)` columns do not need:

```ts
c.integer().primaryKey().autoIncrement()
c.text().notNull().unique()
c.decimal(10, 2).notNull()
c.integer().notNull().references('users', 'id', 'fk_name').onDelete('cascade')
c.boolean().notNull()
c.varchar(255).notNull()
c.timestamp({ withTimezone: true }).defaultNow()
```

Constraint methods: `.primaryKey()`, `.notNull()`, `.unique()`, `.autoIncrement()`,
`.references(table, column, name)`, `.onDelete(action)`, `.defaultNow()`.

### Schema Builder

The `schema` object in migration context provides:

```ts
await schema.createTable(tableDefinition)
await schema.dropTable('table_name', { ifExists: true })
await schema.createIndex('table_name', 'column_name', { name: 'index_name' })
await schema.createIndex('table_name', ['col_a', 'col_b'], { name: 'compound_idx' })
```

Alter tables:

```ts
await schema.alterTable(table, (t) => {
  t.addColumn('status', c.text().notNull())
  t.dropColumn('old_field')
  t.addPrimaryKey('id')
  t.addForeignKey('user_id', 'users', 'id')
  t.addForeignKey(['tenant_id', 'account_id'], 'accounts', ['tenant_id', 'id'])
})
```

Introspection for conditional migration logic:

```ts
if (await schema.hasTable('legacy_users')) {
  await schema.dropTable('legacy_users')
}
if (!(await schema.hasColumn('users', 'role'))) {
  await schema.alterTable(users, (t) => t.addColumn('role', c.text().notNull()))
}
```

Execute raw SQL inside a migration:

```ts
import { sql } from 'remix/data-table'

await schema.plan(sql`update users set status = ${'active'} where status is null`)
```

## Runner Setup

In `app/data/setup.ts`, load and run migrations at startup:

```ts
import { createDatabase } from 'remix/data-table'
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createSqliteDatabaseAdapter } from 'remix/data-table-sqlite'

const adapter = createSqliteDatabaseAdapter(sqlite)
export const db = createDatabase(adapter)

export async function initializeDatabase() {
  let migrations = await loadMigrations('./db/migrations')
  let runner = createMigrationRunner(adapter, migrations)
  await runner.up()
}
```

Call `initializeDatabase()` in `server.ts` before creating the router.

### Runner Options

```ts
let runner = createMigrationRunner(adapter, migrations, {
  journalTable: 'app_migrations',
})

await runner.up()                    // apply all pending
await runner.up({ to: '20260301' }) // apply up to a specific migration
await runner.up({ step: 1 })        // apply one migration
await runner.down()                  // revert all
await runner.down({ step: 1 })      // revert one
await runner.up({ dryRun: true })    // inspect SQL without applying
```

`to` and `step` are mutually exclusive.

### Standalone Migration Script

For production or CI, create a standalone runner script:

```ts
// db/migrate.ts
import { createMigrationRunner } from 'remix/data-table/migrations'
import { loadMigrations } from 'remix/data-table/migrations/node'

let direction = process.argv[2] === 'down' ? 'down' : 'up'
let to = process.argv[3]

let migrations = await loadMigrations('./db/migrations')
let runner = createMigrationRunner(adapter, migrations)

let result = direction === 'up'
  ? await runner.up({ to })
  : await runner.down({ to })

console.log(direction + ' complete', {
  applied: result.applied.map((e) => e.id),
  reverted: result.reverted.map((e) => e.id),
})
```

```sh
node db/migrate.ts up
node db/migrate.ts down 20260228090000
```

### Non-Filesystem Runtimes

Register migrations manually when filesystem loading is not available:

```ts
import { createMigrationRegistry, createMigrationRunner } from 'remix/data-table/migrations'
import createUsers from './db/migrations/20260228090000_create_users.ts'

let registry = createMigrationRegistry()
registry.register({ id: '20260228090000', name: 'create_users', migration: createUsers })

let runner = createMigrationRunner(adapter, registry)
await runner.up()
```

## Seeding

There is no separate seed package. Seed data inline in the initialization function using `db.count`
guards and `db.createMany`:

```ts
export async function initializeDatabase() {
  let migrations = await loadMigrations('./db/migrations')
  let runner = createMigrationRunner(adapter, migrations)
  await runner.up()

  if (await db.count(books) === 0) {
    await db.createMany(books, [
      { slug: 'intro-to-remix', title: 'Intro to Remix', price: 19.99 },
      { slug: 'advanced-patterns', title: 'Advanced Patterns', price: 29.99 },
    ])
  }

  if (await db.count(users) === 0) {
    await db.createMany(users, [
      {
        email: 'admin@example.com',
        password_hash: await hashPassword('admin123'),
        name: 'Admin',
        role: 'admin',
        created_at: Date.now(),
      },
    ])
  }
}
```

Guard each table independently with `db.count(table) === 0` so seeds are idempotent. The
initialization function runs at startup before the server accepts requests.

## Alignment Between Migration DDL and Runtime Schema

Migration files and `app/data/schema.ts` define the same tables and columns but serve different
purposes:

- **Migrations** are the source of DDL — they create, alter, and drop tables in the database.
- **Runtime schema** (`app/data/schema.ts`) defines the table handles, column types, relations, and
  lifecycle hooks that `data-table` uses for queries and writes.

Keep them aligned by convention. When adding a column, write the migration first, then add the
column to the runtime table definition.
