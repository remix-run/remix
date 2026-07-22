---
title: Data and Validation
description: How Remix validates inputs, defines relational data, queries databases, and runs SQL migrations.
---

The quickstart kept albums in a module-level array. In this chapter we will replace that array with validated input, typed table definitions, a SQLite database, and SQL migrations. The same request path works with PostgreSQL or MySQL when the app needs a different database.

There are two validation boundaries to keep separate. A request schema decides whether untrusted input is safe for this action to use. Table validation protects persistence rules for every caller that writes through the table. The database schema and constraints live in migrations.

## Validate every trust boundary {#validating-trust-boundaries}

Route params, query strings, form fields, JSON bodies, cookies, and external API responses all arrive from outside the app's trusted code. Parse them before business logic uses them.

The album edit action receives strings in `FormData`. Define the accepted shape at module scope:

```ts filename=app/actions/albums/edit/schema.ts
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

export const albumFormSchema = f.object({
  artist: f.field(
    s
      .string()
      .refine((value) => value.trim().length > 0, "Artist is required")
      .transform((value) => value.trim()),
  ),
  title: f.field(
    s
      .string()
      .refine((value) => value.trim().length > 0, "Title is required")
      .transform((value) => value.trim()),
  ),
  year: f.field(
    coerce
      .number()
      .refine(Number.isInteger, "Enter a whole year")
      .refine(
        (value) => value >= 1860 && value <= 2100,
        "Enter a valid release year",
      ),
  ),
});
```

Then branch on `parseSafe(...)` inside the controller's existing action:

```tsx filename=app/actions/albums/edit/controller.tsx
// Inside the actions object for routes.albums.edit:
async action(context) {
  let result = s.parseSafe(albumFormSchema, context.formData);

  if (!result.success) {
    return new Response("Invalid album data", { status: 400 });
  }

  await updateAlbum(context.params.albumId, result.value);
  // Return the redirect shown in the Forms and Mutations chapter.
},
```

The controller still owns both leaves created by `form(...)`. This excerpt changes only `action`; keep the existing `index` action that loads and renders the form.

For now the failure is a plain `400` response. The next chapter passes `result.issues` and the submitted text back to `AlbumEditPage` so the reader can correct individual fields.

`parseSafe(...)` makes invalid input an expected branch. Use `parse(...)` when invalid data means the current operation cannot recover and an exception is the appropriate boundary, such as malformed application configuration during startup.

Validation does not replace authorization or database constraints. A valid album ID may still belong to another account, and two valid requests may still race for a unique value.

## Schemas, parsing, and issues {#remix-data-schema}

`remix/data-schema` schemas accept an unknown input and produce a typed value or a list of issues. Start with primitives and combine them into the shape the action needs:

```ts
import * as s from "remix/data-schema";

const albumImportSchema = s.object({
  id: s.string(),
  title: s.string(),
  year: s.number(),
  format: s.enum_(["album", "single", "ep"]),
  notes: s.optional(s.string()),
  status: s.union([s.literal("draft"), s.literal("published")]),
});

let album = s.parse(albumImportSchema, input);
```

Object schemas strip unknown keys by default. Pass `{ unknownKeys: "error" }` when unexpected properties should reject the object, or `{ unknownKeys: "passthrough" }` when the caller must preserve them.

For tagged payloads, `variant(...)` selects a schema by one discriminator:

```ts
const albumEventSchema = s.variant("type", {
  created: s.object({
    type: s.literal("created"),
    albumId: s.string(),
  }),
  corrected: s.object({
    type: s.literal("corrected"),
    albumId: s.string(),
    field: s.enum_(["artist", "title", "year"]),
  }),
});
```

Each failed issue has a message and an optional path into the input. A form renderer can group paths such as `['title']` or `['tracks', 2, 'name']` next to the control that owns them.

Both `parse(...)` and `parseSafe(...)` accept any Standard Schema v1 schema. An app can use a Zod, Valibot, or ArkType schema at one boundary without wrapping it in a Remix-specific adapter.

Use `InferInput<typeof schema>` and `InferOutput<typeof schema>` when another module needs the types. The output may differ from the input after defaults, coercion, or transforms.

## Checks, refinements, transforms, and coercion {#coercion-and-checks}

Four schema operations cover different jobs:

- `.pipe(...)` applies reusable checks such as `minLength`, `email`, `min`, and `max`.
- `.refine(...)` rejects a value with a domain-specific predicate and message.
- `.transform(...)` maps a valid value to a new output value and may change its type.
- `remix/data-schema/coerce` converts string-shaped inputs to numbers, booleans, dates, bigints, or strings.

Here is a query-string schema for the albums index:

```ts
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const albumSearchSchema = f.object({
  page: f.field(s.defaulted(coerce.number(), 1).pipe(checks.min(1))),
  query: f.field(
    s.defaulted(s.string(), "").transform((value) => value.trim()),
  ),
  format: f.field(
    s.defaulted(s.enum_(["all", "album", "single", "ep"]), "all"),
  ),
});

let filters = s.parse(albumSearchSchema, context.url.searchParams);
```

Coercion belongs at a string-shaped boundary. Do not use it to hide a broken internal call that should already be passing a number.

Transforms are synchronous. A thrown error from a transform remains an exception, not a validation issue. Use `.refine(...)` for expected rejection and perform database or network checks in the action after parsing.

## FormData and URLSearchParams schemas {#form-parsing-with-remix-data-schema-form-data}

`FormData` and `URLSearchParams` can repeat keys, and `FormData` may contain files. The helpers in `remix/data-schema/form-data` make those choices explicit:

| Helper          | Input selected                            |
| --------------- | ----------------------------------------- |
| `f.field(...)`  | One text value                            |
| `f.fields(...)` | Repeated text values                      |
| `f.file(...)`   | One uploaded `File`                       |
| `f.files(...)`  | Repeated uploaded files                   |
| `f.object(...)` | The root `FormData`/`URLSearchParams` map |

A filter form with repeated genres can use `f.fields(...)`:

```ts
const filterSchema = f.object({
  query: f.field(s.defaulted(s.string(), "")),
  genre: f.fields(s.array(s.string())),
});
```

Keep `formData()` before actions or middleware that read the body. With the database middleware added later in this chapter, the cumulative middleware portion of `app/router.ts` looks like this:

```ts filename=app/router.ts
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";

import { loadAssetEntry } from "./middleware/asset-entry.ts";
import { loadDatabase } from "./middleware/database.ts";
import { render } from "./middleware/render.tsx";

// Keep the existing controller imports above, plus the AppContext declaration
// and controller mappings below.
export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    formData(),
    asyncContext(),
    loadDatabase(),
    loadAssetEntry(),
    render(),
  ],
});
```

Actions read the parsed value with `context.formData` (or `context.get(FormData)`). Parsing once matters when method override, CSRF checks, upload handling, and the action all depend on the same body.

Calling `await request.formData()` directly is still useful for an isolated route without middleware. A body stream can only be consumed once, so do not mix both approaches on the same request.

## Define tables, columns, and relations {#tables-with-remix-data-table}

Request parsing gives us a trusted album value. Next define the rows the application reads and writes:

```ts filename=app/data/schema.ts
import {
  belongsTo,
  column as c,
  hasMany,
  table,
  type LoadedRelationMap,
  type TableRow,
  type TableRowWith,
} from "remix/data-table";

export const artists = table({
  name: "artists",
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    name: c.text().notNull().unique(),
  },
});

export const albums = table({
  name: "albums",
  columns: {
    id: c.text().primaryKey(),
    artist_id: c.integer().notNull(),
    title: c.text().notNull(),
    year: c.integer().notNull(),
    revision: c.integer().notNull().default(0),
  },
});

export const artistAlbums = hasMany(artists, albums, {
  foreignKey: "artist_id",
});

export const albumArtist = belongsTo(albums, artists, {
  foreignKey: "artist_id",
});

export const albumRelations = { artist: albumArtist };

export type Album = TableRow<typeof albums>;
export type AlbumWithArtist = TableRowWith<
  typeof albums,
  LoadedRelationMap<typeof albumRelations>
>;
```

Table definitions describe typed columns and runtime metadata. Relations describe how rows connect and can be composed into eager-loading queries such as `{ with: albumRelations }`. `hasOne`, `hasMany`, `belongsTo`, and `hasManyThrough` cover the common relational shapes.

These definitions do not run `CREATE TABLE` or add a foreign key to the database. The SQL migration still owns DDL, indexes, uniqueness, `NOT NULL`, and referential actions. Keep table metadata and SQL constraints aligned deliberately.

## CRUD helpers and query objects {#queries-and-crud-helpers}

Read the request-scoped database from context:

```ts
import { Database } from "remix/data-table";

let db = context.get(Database);
```

CRUD helpers keep common operations short:

```ts
let album = await db.find(albums, context.params.albumId, {
  with: albumRelations,
});

let newestAlbums = await db.findMany(albums, {
  orderBy: ["year", "desc"],
  limit: 20,
});

let createdAlbum = await db.create(
  albums,
  {
    id: "off-the-wall",
    artist_id: 1,
    title: "Off the Wall",
    year: 1979,
  },
  { returnRow: true },
);

await db.update(albums, createdAlbum.id, { year: 1979 });
await db.delete(albums, createdAlbum.id);
```

`find(...)` and `findOne(...)` return a row or `null`. `create(...)` returns write metadata unless `{ returnRow: true }` is requested. `update(...)` returns the updated row and throws when the primary key does not exist. `delete(...)` returns whether it removed a row.

Use `query(table)` for reusable joins, projections, aggregates, eager loading, and scoped bulk writes:

```ts
import { eq, query } from "remix/data-table";

const albumDetails = query(albums)
  .join(artists, eq(albums.artist_id, artists.id))
  .select({
    id: albums.id,
    title: albums.title,
    year: albums.year,
    artist: artists.name,
  });

let rows = await db.exec(albumDetails.orderBy(albums.year, "desc"));
```

`db.query(albums)` returns the same builder already bound to one database when the query does not need to be stored or reused. For SQL that the query API cannot express clearly, use the parameterized `sql` template instead of concatenating values into a string.

## Table validation and lifecycle hooks {#table-validation-and-lifecycle-hooks}

Table hooks protect rules that must apply no matter which route, job, or script performs the write:

```ts
import { column as c, fail, table } from "remix/data-table";

export const albums = table({
  name: "albums",
  columns: {
    id: c.text().primaryKey(),
    artist_id: c.integer().notNull(),
    title: c.text().notNull(),
    year: c.integer().notNull(),
    revision: c.integer().notNull().default(0),
  },
  beforeWrite({ value }) {
    if (typeof value.title !== "string") return { value };

    return {
      value: {
        ...value,
        title: value.title.trim(),
      },
    };
  },
  validate({ value }) {
    if (
      typeof value.year === "number" &&
      (value.year < 1860 || value.year > 2100)
    ) {
      return fail("Expected a valid release year", ["year"]);
    }

    return { value };
  },
});
```

The write order is `beforeWrite`, `validate`, timestamp/default touch, database execution, then `afterWrite`. The `afterWrite` hook receives an array of the partial values written, even for a single-row operation. Delete operations have `beforeDelete` and `afterDelete`; reads may pass through `afterRead`.

Hooks are synchronous and their values may be partial. An update might contain only `{ year }`, and a projected read might omit `title`, so check a property before using it. Hooks do not start a transaction.

Request and table validation answer different questions. The form schema can require all controls and return field errors in this page. The table hook prevents an invalid year even when a background import writes the record.

## Transactions {#transactions}

Use `db.transaction(...)` when several operations must succeed or roll back together. Creating an artist and its first album is one unit:

```ts
await db.transaction(async (transaction) => {
  let artist = await transaction.create(
    artists,
    { name: "Michael Jackson" },
    { returnRow: true },
  );

  await transaction.create(albums, {
    id: "thriller",
    artist_id: artist.id,
    title: "Thriller",
    year: 1982,
  });
});
```

Throwing inside the callback rolls back the transaction. Return the values the action needs from the callback rather than continuing to use the transaction-bound database afterward.

Adapter-specific transaction options may be passed as a second argument. PostgreSQL, for example, accepts hints such as `{ isolationLevel: "serializable", readOnly: false }`.

## SQLite, PostgreSQL, and MySQL adapters {#sqlite-postgres-and-mysql-adapters}

The application creates a database by pairing `createDatabase(...)` with one adapter:

```ts filename=app/data/database.ts
import { DatabaseSync } from "node:sqlite";
import { createDatabase } from "remix/data-table";
import { createSqliteDatabaseAdapter } from "remix/data-table/sqlite";

export const sqlite = new DatabaseSync("./db/app.db");

export const adapter = createSqliteDatabaseAdapter(sqlite);
export const db = createDatabase(adapter);
```

The table and query APIs stay the same across adapters, but database capabilities do not become identical:

| Adapter    | Driver shape                 | Differences to account for                                  |
| ---------- | ---------------------------- | ----------------------------------------------------------- |
| SQLite     | Node/Bun synchronous SQLite  | Embedded file, `RETURNING`, transactional DDL, no lock      |
| PostgreSQL | `pg` pool/client             | `RETURNING`, transaction isolation options, migration locks |
| MySQL      | `mysql2/promise` pool/client | No `RETURNING` or transactional DDL; migration locks        |

MySQL needs `multipleStatements: true` when the migration runner executes a multi-statement SQL file. `createMany(..., { returnRows: true })` requires adapter `RETURNING` support and throws on MySQL; the default metadata result works across all three adapters.

## SQL-first migrations {#migrations}

Put immutable SQL migrations in timestamped directories:

```txt
db/
└── migrations/
    └── 20260722120000_create_albums/
        ├── up.sql
        └── down.sql
```

```sql filename=db/migrations/20260722120000_create_albums/up.sql
create table artists (
  id integer primary key autoincrement,
  name text not null unique
);

create table albums (
  id text primary key,
  artist_id integer not null references artists(id),
  title text not null,
  year integer not null check (year between 1860 and 2100),
  revision integer not null default 0
);
```

`up.sql` is required. `down.sql` is optional when a migration cannot be reversed safely. Do not import the live TypeScript table definition into a migration: an old migration must mean the same thing when a new environment replays it years later.

Load and run the migrations before the server starts accepting requests:

```ts filename=app/data/migrate.ts
import { createMigrationRunner } from "remix/data-table/migrations";
import { loadMigrations } from "remix/data-table/migrations/node";

import { adapter } from "./database.ts";

let migrations = await loadMigrations("./db/migrations");
let runner = createMigrationRunner(adapter, migrations);

await runner.up();
```

The runner journals applied IDs and checksums. Changing an already-applied `up.sql` produces drift instead of silently changing history. Use `runner.status()` to inspect state, `runner.up({ step: 1 })` for a bounded rollforward, and `runner.down({ step: 1 })` for a bounded rollback. Both directions also accept `{ to: "20260722120000" }` or `{ dryRun: true }`; `to` and `step` are mutually exclusive.

Each migration uses a transaction when the adapter supports transactional DDL. Put `-- data-table/transaction: none` on the first non-blank line for a statement that must run outside a transaction, such as PostgreSQL's `create index concurrently`.

## Request-scoped database access {#request-scoped-database-access}

Create one long-lived database during startup, run migrations, then expose it through middleware:

```ts filename=app/middleware/database.ts
import { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { db } from "../data/database.ts";

export function loadDatabase(): Middleware {
  return (context, next) => {
    context.set(Database, db);
    return next();
  };
}
```

Add `loadDatabase()` to the router middleware tuple and derive `AppContext` from the configured router. Controllers can then call `context.get(Database)`, and TypeScript knows that the middleware installed the key.

The middleware does not open a new connection for every action. The adapter or pool owns long-lived connections; the request context provides an explicit path to the shared database and a place to substitute an isolated database in tests.

With typed data in place, [Forms and Mutations](/forms-and-mutations/) returns validation issues to the page, redirects successful writes, and enhances the same form without replacing its server action.
