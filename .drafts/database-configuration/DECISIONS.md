# Decisions

## Use `DatabaseResource` for the configured database

Use `DatabaseResource` as the interim type name for the configured object that can create, drop, connect to, and close a database.

**Why**

The ideal long-term name for this concept may be `Database`, since it lines up with SQL's idea of a database resource: a SQLite file, Postgres database, or MySQL database/schema that can be created, dropped, and connected to.

However, the current queryable API is already named `Database`. Renaming that queryable type now would create a noisy diff, so `DatabaseResource` gives us a clear temporary name for the new lifecycle object while preserving the existing queryable `Database` type for now.

```ts
export let database = createSqliteDatabase({
  path: 'db/app.sqlite',
})

let client = await database.connect()
await client.query(users).all()
```

Docs should use **database resource** for the configured lifecycle object and **database client** for the queryable API returned by `connect()`. Userland can still name local variables `db`, but docs should not treat `db` as the formal concept.

**Alternatives**

- `Database` — likely the best final name, but rejected for now because it conflicts with the existing queryable type.
- `DatabaseController` — rejected because it sounds more action-oriented but may collide with application controller terminology.
- `DatabaseAdapter` — rejected because create/drop/connect are resource lifecycle operations, not just SQL adaptation.
- `DatabaseManager` — rejected because it is broad and vague.
- `DatabaseTarget` — rejected because it is precise but less natural than `DatabaseResource`.
- Call the queryable API an ORM — rejected because the API is a typed database client, not an object-relational mapper with entities and unit-of-work semantics.

## SQLite `connect()` opens real SQLite clients

For file-backed SQLite, each `DatabaseResource.connect()` call opens a new SQLite client, such as a new `node:sqlite` `DatabaseSync` instance. Multiple clients can connect to the same file and have independent transaction state while sharing committed database state.

For `:memory:`, the resource should throw if `connect()` is called more than once. Plain SQLite `:memory:` databases are private to each SQLite client, so multiple clients would not share schema or data. We should not add a custom connection reuse or shared-cache abstraction to make `:memory:` appear equivalent to file-backed SQLite.

**Why**

This keeps SQLite behavior honest and simple:

- file-backed SQLite supports multiple independent clients to one database file
- `:memory:` supports fast single-client tests and apps
- tests that need persistent state across multiple clients should use temporary file-backed SQLite databases
- we avoid implementing a SQLite-specific pool or lifecycle abstraction just for in-memory databases

**Alternatives**

- Reuse one underlying `:memory:` connection across sequential `connect()` calls — rejected because it invents checkout semantics that do not match ordinary SQLite clients.
- Use shared-cache in-memory SQLite URIs — rejected for the default resource behavior because it adds complexity and less-common SQLite semantics.
- Always return the same SQLite client — rejected because callers expect separate `connect()` calls to have independent transaction state where the backend can support it.

## Accept opaque URLs or structured Postgres/MySQL connection fields

Postgres and MySQL database resources accept either an opaque database URL or structured fields such as `host`, `port`, `database`, `user`, and `password`. These modes are mutually exclusive: callers cannot pass `url` together with structured connection identity fields.

When a URL is provided, the resource treats it as opaque and passes it through to the driver. It does not parse the URL to override the database name or normalize query parameters. Tests that need generated per-test database names should use structured fields, or parse/mutate URLs in userland before creating the resource.

**Why**

Database URLs often carry driver/provider-specific query parameters such as SSL options, application names, timeouts, charsets, or other features that may not fit cleanly into our structured fields. Treating URLs as opaque preserves those features for app configuration.

Keeping URLs mutually exclusive with structured connection fields avoids ambiguous `url` plus `database` precedence rules. Tests can still control database names explicitly by choosing the structured configuration path.

**Alternatives**

- Accept structured fields only — rejected because it could make valid provider database URLs lossy or impossible to represent.
- Accept `url` plus a `database` override — rejected because it creates unclear precedence and requires parsing a URL we otherwise want to treat as opaque.
- Accept `serverUrl` plus `database` — rejected for now because structured fields are more explicit and avoid another URL-shaped option.
- Provide first-party URL parsing helpers — deferred until repeated userland parsing becomes enough friction to justify owning helper behavior.

## Export the app database resource from `app/data/database.ts`

For now, Remix apps export their configured `DatabaseResource` from `app/data/database.ts` so the Remix CLI can load it from a known location.

```ts
export let database = createSqliteDatabase({
  path: 'db/app.sqlite',
})
```

**Why**

Database CLI commands like `create`, `drop`, `migrate`, `seed`, and `reset` need access to the application's configured database resource. The lower-level data-table APIs should stay convention-free and operate on an injected `DatabaseResource`, but the Remix CLI needs an app convention so users do not have to pass module paths for the common case.

This gives the CLI a stable default while keeping the underlying database operations portable.

**Alternatives**

- Require every CLI command to receive an explicit database module path — rejected because it makes the happy path noisy and pushes framework convention onto every command invocation.
- Put the resource at `app/database.ts` — deferred because it may be a better long-term top-level app convention, but we are using `app/data/database.ts` for now.
