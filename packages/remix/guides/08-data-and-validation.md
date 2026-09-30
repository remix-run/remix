---
title: Data and Validation
description: How Remix validates inputs, defines relational data, queries databases, and runs SQL migrations.
---

In [Start Here](/start-here/), we kept the record store's albums in an array and used a schema to parse an edit form. That was enough to follow a request through the app, but changes disappeared when the server restarted.

Let's replace that array with SQLite and load an album from the database. Then we'll define a schema for the values the album editor can submit.

## Describe the stored rows

The record store needs an albums table with the same fields as our in-memory records, so we'll define our data shape using `table()` which gives us metadata for typed queries, column references, and database value encoding. We'll also define a tracks table so we can load an album's track listing later in the chapter:

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

`table(...)` does not create a SQL table for us - we'll do that with an SQL migration file.

## Create the tables with SQL

Each migration has a timestamped directory with an `up.sql` file and, when the change can be reversed, a `down.sql` file:

```txt
db/migrations/
└── 20260923090000_create_albums/
    ├── up.sql
    └── down.sql
```

This SQLite migration creates the tables described above:

```sql filename=db/migrations/20260923090000_create_albums/up.sql
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

```sql filename=db/migrations/20260923090000_create_albums/down.sql
drop table tracks;
drop table albums;
```

Now, our code can open the database and load the migration files:

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

For this single-process app, call `await migrateDatabase()` in `server.ts` before the HTTP server starts listening to ensure all migrations are applied prior to serving the app. In a deployment with several server processes, run migrations once as a deployment step before those processes accept requests. Call `await db.close()` when shutting down the application.

The migration runner records applied migrations in a journal and checks their checksums on later runs. Add a new migration when the schema changes instead of editing an applied migration. You must also keep the table definitions in `app/data/tables.ts` aligned with the resulting SQL schema.

`db.migrate(...)` also supports dry-run plans, bounded rollbacks, and migration targets. The [`data-table` overview](../src/data-table/README.md) covers those options and CLI configuration for `remix db`.

## Give actions access to the database

The database lives for the lifetime of the application. Middleware can put it on each request's context so controllers can use it without importing the connection module directly:

```ts filename=app/middleware/database.ts
import { createContextKey } from "remix/router";
import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

export const databaseContext = createContextKey<Database>();

export function database(db: Database): Middleware<{
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

`databaseContext` and `database(...)` are application code. The middleware stores the same database instance for each request. It does not open a connection or start a transaction per request.

Add it to the router alongside form parsing and rendering, retaining the app's existing static-file middleware and controller mappings:

```ts filename=app/router.ts lines=[8,9,14]
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { staticFiles } from "remix/middleware/static";
import { createRouter } from "remix/router";
import type { RouterContext } from "remix/router";

import { assets } from "./assets.ts";
import { db } from "./db.ts";
import { database } from "./middleware/database.ts";

export const router = createRouter({
  middleware: [
    staticFiles("./public", { index: false }),
    database(db),
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

// Keep the existing router.map(...) calls here.
```

The `RouterTypes` declaration makes `context.db` (in addition to `context.formData` and `context.render`) available to controllers with their inferred types. The database can also be accessed via `context.get(databaseContext)`. [Request Handling](/request-handling/) explains how the middleware stack supplies these context properties.

## Read an album

With the migration applied, we can create and retrieve an album in application code:

```ts
import { db } from "./app/db.ts";
import { albums } from "./app/data/tables.ts";

let album = await db.create(
  albums,
  {
    id: "thriller",
    title: "Thriller",
    artist: "Michael Jackson",
    year: 1982,
  },
  { returnRow: true },
);

let sameAlbum = await db.find(albums, album.id);
```

Run that insert once against the new database, for example in a seed script. `create(...)` returns write metadata by default, but passing `{ returnRow: true }` asks for the stored row instead. `find(...)` can then be used to look up a row by primary key.

Now replace the array lookup in the album's `show` action:

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
    async recommendations(context) {
      /* ... */
    },
  },
});
```

Now open `/albums/thriller` in your browser - the page now loads its data from SQLite. Restarting the server keeps the record we inserted.

## Define the input schema

Form fields arrive as text, even when the year input has `type="number"`. Define a form schema beside the edit controller to convert the year and reject blank titles and artists:

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

[Forms and Mutations](/forms-and-mutations/) will use `albumForm` in the edit action to validate submissions before saving them. For parsing plain objects or individual values, using `parse()` to throw on validation failure, and other schema options, see the [`data-schema` overview](../src/data-schema/README.md).

## Parse query strings and repeated fields

The form-data schema helpers also accept `URLSearchParams`. For example, a catalog search can read a query, a page number, and several selected genres:

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

A few browser conventions affect these schemas:

- An unchecked checkbox is absent. For a checkbox with `value="yes"`, `s.optional(s.literal("yes")).transform((value) => value === "yes")` produces a boolean. `coerce.boolean()` accepts `"true"` and `"false"`, not the browser's default `"on"` value.
- An empty text input is `""`, not `undefined`, so `optional()` and `defaulted()` do not make a blank string valid automatically.
- Use `f.file(...)` or `f.files(...)` for file entries. The [Files and Assets](/files-and-assets/) chapter covers multipart forms, upload limits, and storage.

## Compose queries and load relations

For a catalog page, we might want only an album's ID, title, and year. Build that query independently of the database connection:

```ts filename=app/data/catalog.ts
import { query } from "remix/data-table";

import { albums } from "./tables.ts";

export const recentAlbums = query(albums)
  .select({ id: albums.id, title: albums.title, year: albums.year })
  .orderBy("year", "desc")
  .limit(20);
```

`recentAlbums` is a query value. No SQL runs until an action calls `await context.db.exec(recentAlbums)`. Its result contains only the selected columns. Use `db.query(albums)` when you already have a database and want to execute the chain directly with `.all()` or `.first()`.

Relations describe how to load connected rows. Add the relationship between our albums and tracks in a separate module:

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

The `with` key names the returned property, and TypeScript knows that `album.tracks` is an array of track rows. `hasOne(...)` describes a single related row, while `hasManyThrough(...)` follows an intermediate table. These descriptors affect queries. The foreign key we wrote in the migration is what enforces the relationship in the database.

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

## Enforce rules across writes

The form schema checks browser input, but a seed script or import job can write albums without using that schema. If every write through `data-table` should reject a blank title, add a table-level `validate` hook:

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

// Keep the tracks declaration from above.
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

Hooks are synchronous and do not open a transaction. An `afterRead` hook may receive a projection such as the catalog query's `{ id, title, year }`, so it must check whether a field is present before transforming it. Predicate values in `where`, `having`, or join conditions are not validated by table hooks.

## Group writes in a transaction

Creating an album and its first track takes two writes. If the track insert fails, we want to undo the album insert too:

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

## Use PostgreSQL or MySQL

The examples use SQLite, but the query and table APIs also work with PostgreSQL and MySQL. Replace the database factory and write migrations for the chosen SQL dialect.

For PostgreSQL, install `pg` with `npm i pg` and create the database with its connection configuration:

```ts filename=app/db.ts
import { createPostgresDatabase } from "remix/data-table/postgres";

export const db = createPostgresDatabase({
  connectionString: process.env.DATABASE_URL,
});
```

The PostgreSQL adapter supports transaction options such as `{ isolationLevel: "serializable" }` as the second argument to `db.transaction(...)`.

For MySQL, install `mysql2` with `npm i mysql2`:

```ts filename=app/db.ts
import { createMysqlDatabase } from "remix/data-table/mysql";

export const db = createMysqlDatabase({
  uri: process.env.DATABASE_URL,
  multipleStatements: true,
});
```

`multipleStatements: true` allows the migration runner to send each SQL file as one script. MySQL does not support SQL `RETURNING`, so query operations that request it, including bulk inserts with `{ returnRows: true }`, are unavailable. Single-row CRUD helpers can retrieve a row with a follow-up query. MySQL also does not support transactional DDL, so a failed migration may need repair before it can run again.

The database instance owns the pool when created from configuration. Close it during application shutdown with `await db.close()`. You can instead pass an existing compatible client or pool when your application already manages its lifecycle.

With our database and input schema in place, [Forms and Mutations](/forms-and-mutations/) connects the edit form: validating submissions, saving edits, showing field errors, and adding pending feedback.
