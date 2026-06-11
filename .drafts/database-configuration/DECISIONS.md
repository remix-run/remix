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
