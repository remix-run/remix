---
title: Data and Validation
description: How Remix validates inputs, defines relational data, queries databases, and runs SQL migrations.
---

Remix handles persistent data with [`remix/data-table`](../src/data-table/README.md) and untrusted input with [`remix/data-schema`](../src/data-schema/README.md). This guide covers table definitions, SQL migrations, putting the database on request context, reading rows in actions, and parsing form and query-string values. Later sections cover relations, table-level validation hooks, transactions, and PostgreSQL or MySQL. The examples use SQLite and a record store's albums and tracks.

## Describe the stored rows

`table()` from [`remix/data-table`](../src/data-table/README.md) describes a table's name and columns. Remix uses that metadata for typed queries, column references, and encoding values for the database. This module describes an albums table and a tracks table whose rows belong to an album:

```ts filename=app/data/tables.ts
import { column as c, table } from "remix/data-table";
import type { TableRow } from "remix/data-table";

export const albums = table({
  name: "albums",
  columns: {
    id: c.text(),
    title: c.text(),
    artist: c.text(),
    year: c.integer(),
  },
});

export const tracks = table({
  name: "tracks",
  columns: {
    id: c.text(),
    album_id: c.text(),
    title: c.text(),
    position: c.integer(),
  },
});

// Derive the Album type from the columns
export type Album = TableRow<typeof albums>;
```

The `id` column is the default primary key, but tables can specify a different key using `primaryKey`.

`table(...)` does not create a SQL table. Create the table with a [SQL migration](#create-the-tables-with-sql).

## Create the tables with SQL

Each migration has a numbered directory with an `up.sql` file and, when the change can be reversed, a `down.sql` file:

```txt
db/migrations/
└── 0001_create_albums/
    ├── up.sql
    └── down.sql
```

The numeric prefix determines migration order. Keep every prefix the same width (`0001`, `0002`, and so on).

This SQLite migration creates `albums` and `tracks` tables:

```sql filename=db/migrations/0001_create_albums/up.sql
create table albums (
  id text primary key not null,
  title text not null check (length(trim(title)) > 0),
  artist text not null check (length(trim(artist)) > 0),
  year integer not null check (year > 0)
);

create table tracks (
  id text primary key not null,
  album_id text not null references albums(id) on delete cascade,
  title text not null,
  position integer not null,
  unique (album_id, position)
);
```

The foreign key and unique constraint are SQL rules enforced by the database. They apply even if another application wrote to these tables.

You can reverse the changes in a `down.sql` file in dependency order:

```sql filename=db/migrations/0001_create_albums/down.sql
drop table tracks;
drop table albums;
```

To apply migrations, open the database with [`remix/data-table/sqlite`](../src/data-table-sqlite/README.md), load the migration files with [`remix/data-table/migrations/node`](../src/data-table/README.md), and pass them to `db.migrate(...)`:

```ts filename=app/db.ts
import { fileURLToPath } from "node:url";
import { loadMigrations } from "remix/data-table/migrations/node";
import { createSqliteDatabase } from "remix/data-table/sqlite";

export const db = createSqliteDatabase({
  filename: fileURLToPath(new URL("../albums.sqlite", import.meta.url)),
  foreignKeys: true,
});

export async function migrateDatabase() {
  let migrations = await loadMigrations(
    fileURLToPath(new URL("../db/migrations/", import.meta.url)),
  );
  await db.migrate(migrations);
}
```

`createSqliteDatabase(...)` uses the SQLite client built into Node.js or Bun, and `foreignKeys: true` enables enforcement of the track's reference to its album. The file path is relative to this module, so starting the server from another directory still references the proper database file.

In a single-process app, call `await migrateDatabase()` in `server.ts` before the HTTP server starts listening, so every migration is applied before the first request. In a deployment with several server processes, run migrations once as a deployment step before those processes accept requests. Call `await db.close()` when the application [shuts down](/production/#startup-and-shutdown).

The migration runner records applied migrations in a journal and checks their checksums on later runs. Add a new migration when the schema changes instead of editing an applied migration, and keep the table definitions in `app/data/tables.ts` aligned with the resulting SQL schema.

`db.migrate(...)` also supports dry-run plans, bounded rollbacks, and migration targets. The [`remix/data-table`](../src/data-table/README.md) overview covers those options and CLI configuration for `remix db`.

## Give actions access to the database

The database lives for the lifetime of the application. Controllers can import `db` from `app/db.ts` directly, which is the simplest option. Alternatively, middleware can put it on each request's context, so controllers read `context.db` without importing the connection module:

```ts filename=app/middleware/database.ts
import { createContextKey } from "remix/router";
import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { db } from "../db.ts";

export const databaseContext = createContextKey<Database>();

export function loadDatabase(): Middleware<{
  key: typeof databaseContext;
  value: Database;
  property: "db";
}> {
  return (context, next) => {
    context.set(databaseContext, db, { property: "db" });
    return next();
  };
}
```

`databaseContext` and `loadDatabase()` are application code. The middleware imports the shared database from `app/db.ts` and stores that same instance on each request's context. It does not open a connection or start a transaction per request.

Add it to the router's middleware list:

```ts filename=app/router.ts lines=[8,13]
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";
import type { RouterContext } from "remix/router";

import { assets } from "./assets.ts";
import { loadDatabase } from "./middleware/database.ts";

export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    loadDatabase(),
    formData(),
    render({ assets }),
  ],
});

export type AppContext = RouterContext<typeof router>;

declare module "remix" {
  interface RouterTypes {
    context: AppContext;
  }
}

// router.map(...) calls go here.
```

The `RouterTypes` declaration makes `context.db` (in addition to `context.formData` and `context.render`) available to controllers with their inferred types. The database can also be accessed via `context.get(databaseContext)`. See how [middleware adds typed context properties](/request-handling/#typed-request-context).

## Read an album

`db.create(...)` inserts a row and `db.find(...)` loads one by primary key. A seed script at the project root can insert an album once the migrations have run:

```ts
import { db } from "./app/db.ts";
import { albums } from "./app/data/tables.ts";

await db.create(albums, {
  id: "thriller",
  title: "Thriller",
  artist: "Michael Jackson",
  year: 1982,
});
```

In an action, look up the album through `context.db` and return a `404` when `find` returns `null`:

```tsx filename=app/actions/albums/controller.tsx lines=[10]
import { createController } from "remix/router";

import { albums } from "../../data/tables.ts";
import { routes } from "../../routes.ts";
import { AlbumPage } from "./show-page.tsx";

export default createController(routes.albums, {
  actions: {
    async show(context) {
      let album = await context.db.find(albums, context.params.albumId);
      if (album === null) return new Response("Album not found", { status: 404 });

      return context.render(<AlbumPage album={album} />);
    },
  },
});
```

A request to `/albums/thriller` now reads the seeded row from the SQLite file, so the album is still there after the server restarts.

## Define the input schema

Form fields arrive as text, even when the year input has `type="number"`. A form schema built with [`remix/data-schema/form-data`](../src/data-schema/README.md) can convert the year and reject blank titles and artists. Keeping it beside the edit controller puts it next to the action that parses the form:

```ts filename=app/actions/albums/edit/schema.ts
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";
import * as f from "remix/data-schema/form-data";

const albumText = s
  .string()
  // Trim before applying the length check so whitespace-only values fail.
  .transform((value) => value.trim())
  .pipe(checks.minLength(1));

const albumYear = coerce
  // Accept finite numbers or numeric text ("1982" → 1982), but reject empty strings.
  .number()
  // Check for a positive whole year without changing the number.
  .refine((value) => Number.isInteger(value) && value > 0, "Enter a positive whole year");

export const albumForm = f.object({
  title: f.field(albumText),
  artist: f.field(albumText),
  year: f.field(albumYear),
});
```

`f.field(...)` reads the first value for each name, rejects files, and passes missing values to the field schema as `undefined`. `f.object(...)` selects only the declared fields, so an extra `id` in the submission won't become part of the update.

For parsing plain objects or individual values, using `parse()` to throw on validation failure, and other schema options, see the [`remix/data-schema`](../src/data-schema/README.md) overview.

To use a schema like `albumForm` in an action, [parse and save the submitted form](/forms-and-mutations/#parse-and-save-the-submitted-form), then [return validation failures with the form](/forms-and-mutations/#return-validation-failures-with-the-form) so the user can fix them.

## Advanced data and validation

These sections cover query-string and repeated-field parsing, composed queries and relations, rules enforced on every table write, transactions, and PostgreSQL or MySQL adapters.

### Parse query strings and repeated fields

The schema helpers in [`remix/data-schema/form-data`](../src/data-schema/README.md) also accept `URLSearchParams`. For example, a catalog search can read a query, a page number, and several selected genres:

```ts filename=app/actions/albums/search-schema.ts
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import * as coerce from "remix/data-schema/coerce";

export const albumSearch = f.object({
  query: f.field(s.defaulted(s.string(), "")),
  page: f.field(
    s.defaulted(
      coerce.number().refine((value) => Number.isInteger(value) && value > 0, "Invalid page"),
      1,
    ),
  ),
  genres: f.fields(s.array(s.string()), { name: "genre" }),
});
```

Inside an action, `s.parseSafe(albumSearch, context.url.searchParams)` parses `?genre=soul&genre=pop&page=2` into `{ query: "", page: 2, genres: ["soul", "pop"] }`. `f.fields(...)` reads every value for a name and passes the array to its schema. A missing repeated field becomes an empty array.

Browser form encoding changes what these schemas receive:

- An unchecked checkbox is absent. For a checkbox with `value="yes"`, `s.optional(s.literal("yes")).transform((value) => value === "yes")` produces a boolean. `coerce.boolean()` accepts `"true"` and `"false"`, not the browser's default `"on"` value.
- An empty text input is `""`, not `undefined`, so `optional()` and `defaulted()` do not make a blank string valid automatically.
- Use `f.file(...)` or `f.files(...)` for file entries, and [parse multipart uploads with limits](/files-and-assets/) before the schema sees them.

### Compose queries and load relations

`query()` builds a query without a database connection. A catalog page that needs only each album's ID, title, and year can define its query in a module:

```ts filename=app/data/catalog.ts
import { query } from "remix/data-table";

import { albums } from "./tables.ts";

export const recentAlbums = query(albums)
  .select({ id: albums.id, title: albums.title, year: albums.year })
  .orderBy("year", "desc")
  .limit(20);
```

`recentAlbums` is a query value. No SQL runs until an action calls `await context.db.exec(recentAlbums)`. Its result contains only the selected columns. Use `db.query(albums)` when you already have a database and want to execute the chain directly with `.all()` or `.first()`.

Relations describe how to load connected rows. Define them with `hasMany(...)` and `belongsTo(...)`, here in their own module:

```ts filename=app/data/relations.ts
import { belongsTo, hasMany } from "remix/data-table";

import { albums, tracks } from "./tables.ts";

export const albumTracks = hasMany(albums, tracks, { foreignKey: "album_id" });
export const trackAlbum = belongsTo(tracks, albums, { foreignKey: "album_id" });
```

Load an album with its tracks in playback order:

```ts
import { db } from "./app/db.ts";
import { albumTracks } from "./app/data/relations.ts";
import { albums } from "./app/data/tables.ts";

let album = await db.find(albums, "thriller", {
  with: { tracks: albumTracks.orderBy("position", "asc") },
});

if (album !== null) {
  for (let track of album.tracks) console.log(track.title);
}
```

The `with` key names the returned property, and TypeScript knows that `album.tracks` is an array of track rows. `hasOne(...)` describes a single related row, while `hasManyThrough(...)` follows an intermediate table. These descriptors affect queries only. A foreign key in the [SQL migration](#create-the-tables-with-sql) is what enforces the relationship in the database.

Query objects also support joins, aggregates, nested relation loading, and scoped writes. When a query is clearer as SQL, use the `sql` template tag to parameterize values:

```ts
import { sql } from "remix/data-table";

// Inside an action:
let artist = context.url.searchParams.get("artist") ?? "";
let result = await context.db.exec(sql`
  select id, title from albums where artist = ${artist}
`);
```

`${artist}` becomes a bound value, not SQL text. Keep table names, column names, and SQL syntax in application code. Raw SQL does not run table lifecycle hooks or infer the result shape from a table definition.

### Enforce rules across writes

A seed script or import job can write albums without parsing a browser form. If every write through [`remix/data-table`](../src/data-table/README.md) should reject a blank title, add a table-level `validate` hook:

```ts filename=app/data/tables.ts
import { column as c, fail, table } from "remix/data-table";
import type { TableRow } from "remix/data-table";

export const albums = table({
  name: "albums",
  columns: {
    id: c.text(),
    title: c.text(),
    artist: c.text(),
    year: c.integer(),
  },
  validate({ operation, value }) {
    if (operation === "create" || value.title !== undefined) {
      if (typeof value.title !== "string" || value.title.trim().length === 0) {
        return fail("Title is required", ["title"]);
      }
    }

    return { value };
  },
});

export type Album = TableRow<typeof albums>;

// The tracks table is unchanged.
```

Write payloads are partial objects. An update that changes only `year` has no `title` property, so this hook checks the title on creation or when an update supplies it. A validation failure rejects the write with a `DataTableValidationError`.

Use request schemas for the shape of a particular operation, including parsing strings and choosing which fields a caller may submit. Use table hooks for rules shared by the app's table writes, and SQL constraints for rules that must also apply to other database clients.

The other lifecycle hooks run around reads and writes:

| Hook           | Runs                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| `beforeWrite`  | Before `validate`, allowing normalization of a write payload.                |
| `afterWrite`   | After a successful write, with affected-row metadata.                        |
| `beforeDelete` | Before a delete, with its predicates and scope. It can reject the operation. |
| `afterDelete`  | After a successful delete, with the affected-row count.                      |
| `afterRead`    | For loaded rows, including related rows and rows returned from writes.       |

Hooks are synchronous and do not open a transaction. An `afterRead` hook may receive a projection such as `{ id, title, year }` from a `select(...)` query, so it must check whether a field is present before transforming it. Predicate values in `where`, `having`, or join conditions are not validated by table hooks.

### Group writes in a transaction

Creating an album and its first track takes two writes. Run them inside `db.transaction(...)` so a failed track insert also undoes the album insert:

```ts
import { db } from "./app/db.ts";
import { albums, tracks } from "./app/data/tables.ts";

await db.transaction(async (tx) => {
  await tx.create(albums, {
    id: "blue",
    title: "Blue",
    artist: "Joni Mitchell",
    year: 1971,
  });

  await tx.create(tracks, {
    id: "all-i-want",
    album_id: "blue",
    title: "All I Want",
    position: 1,
  });
});
```

Use the callback's `tx` for every operation that belongs to the transaction. The callback resolving commits the writes. Throwing or returning a rejected promise rolls them back. Returning an error `Response` is still a successful callback return, so it does not request a rollback.

Transactions do not undo work outside the database, such as sending email or calling another service. Keep that work outside the callback, or record work to perform later in the same transaction.

### Use PostgreSQL or MySQL

The query and table APIs also work with PostgreSQL and MySQL. Replace the SQLite factory with the matching adapter and write migrations in that SQL dialect.

For PostgreSQL, install `pg` with `npm i pg` and create the database with [`remix/data-table/postgres`](../src/data-table-postgres/README.md) and its connection configuration:

```ts filename=app/db.ts
import { createPostgresDatabase } from "remix/data-table/postgres";

export const db = createPostgresDatabase({
  connectionString: process.env.DATABASE_URL,
});
```

The PostgreSQL adapter supports transaction options such as `{ isolationLevel: "serializable" }` as the second argument to `db.transaction(...)`.

For MySQL, install `mysql2` with `npm i mysql2` and use [`remix/data-table/mysql`](../src/data-table-mysql/README.md):

```ts filename=app/db.ts
import { createMysqlDatabase } from "remix/data-table/mysql";

export const db = createMysqlDatabase({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});
```

`multipleStatements: true` allows the migration runner to send each SQL file as one script. MySQL does not support SQL `RETURNING`, so query operations that request it, including bulk inserts with `{ returnRows: true }`, are unavailable. Single-row CRUD helpers can retrieve a row with a follow-up query. MySQL also does not support transactional DDL, so a failed migration may need repair before it can run again.

The database instance owns the pool when created from configuration. Close it during application shutdown with `await db.close()`. You can instead pass an existing compatible client or pool when your application already manages its lifecycle.
