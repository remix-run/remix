---
name: remix-data
description: Build the data layer of a Remix app. Use when defining schemas, validating form data, querying a database, defining table relations, writing migrations, seeding data, or wiring database access into the request pipeline.
---

# Remix Data

Use this skill for everything between a request's form submission or query and the database:
schema validation, form-data decoding, table definitions, queries, relations, transactions,
migrations, and seeding.

This skill is not about request handling or middleware composition — use `../remix-server/SKILL.md`
for that. It is not about rendering forms or UI — use `../remix-ui/SKILL.md` for that. It is not
about where files live on disk — use `../remix-project-layout/SKILL.md` for that, but note that data
code belongs in `app/data/`.

## Core Packages

Two packages own the data layer:

- **`remix/data-schema`** — validation, parsing, form-data decoding, coercion, and checks.
  Use it at the request boundary to turn raw `FormData` or `URLSearchParams` into typed values.
- **`remix/data-table`** — table definitions, columns, relations, CRUD helpers, query builder,
  transactions, and migrations. Use it to define your persistence layer and read/write rows.

They compose naturally: `data-schema` validates input from the request, then `data-table` persists
it.

## Data Flow

A typical write path through a controller action:

```ts
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Database } from 'remix/data-table'

import { books } from '../../data/schema.ts'

async function create({ get }) {
  let db = get(Database)
  let formData = get(FormData)
  let input = s.parse(bookSchema, formData)
  await db.create(books, { ...input })
}
```

1. `get(FormData)` retrieves the parsed form data from middleware context.
2. `s.parse(schema, formData)` validates and decodes it into a typed value.
3. `db.create(table, values)` persists it through the table's lifecycle hooks.

A typical read path:

```ts
async function index({ get }) {
  let db = get(Database)
  let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
  return render(<BooksPage books={allBooks} />)
}
```

## File Placement

Keep all schema, query, persistence setup, and data initialization code in `app/data/`:

- `app/data/schema.ts` — table definitions, columns, relations, row types, lifecycle hooks
- `app/data/setup.ts` — adapter creation, `db` export, migration runner, seed logic
- `db/migrations/` — migration files named `YYYYMMDDHHmmss_description.ts`

## Database Middleware

Wire the database into the request pipeline with a small middleware that sets the `Database` context
token:

```ts
import type { Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'
import { db } from '../data/setup.ts'

type SetDatabaseContextTransform = readonly [readonly [typeof Database, Database]]

export function loadDatabase(): Middleware<'ANY', {}, SetDatabaseContextTransform> {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
```

Register it in `app/router.ts` so every route action can call `get(Database)`. See
`../remix-server/SKILL.md` for middleware ordering and router setup.

## Procedure

1. Define tables and relations in `app/data/schema.ts` using `table(...)`, `column as c`, and
   relation helpers from `remix/data-table`.
2. Write a migration in `db/migrations/` using `createMigration(...)` from
   `remix/data-table/migrations` to create the DDL.
3. Set up the adapter and `db` instance in `app/data/setup.ts`, run migrations on startup, and seed
   initial data when the database is empty.
4. Wire `loadDatabase()` middleware into the router.
5. In controller actions, call `get(Database)` to access the database and import table handles from
   `app/data/schema.ts`.
6. For form submissions, define a form schema with `f.object(...)` and `f.field(...)`, then parse
   with `s.parse(schema, formData)` before writing to the database.

## Load These References As Needed

- [./references/schema-and-form-data.md](./references/schema-and-form-data.md)
  Use for `data-schema` API details: `parse`, `parseSafe`, form-data helpers (`f.object`,
  `f.field`, `f.fields`, `f.file`), checks, coercion, custom schemas, and error handling.
- [./references/tables-and-queries.md](./references/tables-and-queries.md)
  Use for `data-table` API details: table definitions, column types, relations (`hasMany`,
  `belongsTo`, `hasOne`), CRUD helpers, query builder, transactions, lifecycle hooks, and raw SQL.
- [./references/migrations-and-seeding.md](./references/migrations-and-seeding.md)
  Use for migration file format, runner setup, `loadMigrations`, `createMigrationRunner`, schema
  builder APIs, seeding patterns, and database initialization flow.

## Anti-Patterns

- Do not validate form data manually when `data-schema/form-data` already handles it.
- Do not scatter table definitions across controller files. Keep them centralized in
  `app/data/schema.ts`.
- Do not hardcode SQL strings when `data-table` CRUD helpers or query builder cover the operation.
- Do not skip migrations and create tables directly in setup code.
- Do not put database setup, adapter creation, or seed logic in `app/middleware/` or `app/utils/`.
  Keep it in `app/data/`.
- Do not duplicate validation logic between form schemas and table `validate` hooks without a clear
  reason. Form schemas validate user input shape; table hooks validate domain invariants.
