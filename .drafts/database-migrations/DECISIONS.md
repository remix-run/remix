# Decisions

## Pass the connected database to `migrate()`

Keep migration ordering and SQL metadata in a migrator, but pass the target connected database when applying migrations.

```ts
export let migrator = createMigrator([
  { id: '001_create_users', sql: 'create table users (...)' },
])

let db = await database.connect()
await migrator.migrate(db)
await migrator.migrate(db, { to: '001_create_users' })
```

**Why**

A migration set describes a schema evolution, not a single database instance. Passing the connected database at execution time lets the same SQL migration list apply to development, test, preview, tenant, or generated temporary databases without reconstructing the migrator.

This also keeps lifecycle ownership clear: callers decide how to create/connect/close databases, while the migrator only applies migrations to the connected client it receives.

**Alternatives**

- `createMigrator({ database, migrations })` — rejected for now because it binds a reusable migration set to one configured database too early.
- `migrator.migrate(databaseResource)` — rejected because it makes the migrator own connection lifecycle even though callers may already have a connected database.
- `createMigrator({ migrations })` — rejected for now because migrations are the primary input; an options object adds ceremony before we have secondary options.
- `migrate(database, migrations, options)` — possible, but gives up a named object that can own validation, listing, status, and CLI conventions later.

## Keep filesystem loading in the `/node` subpath

Keep `loadMigrations()` exported from `remix/data-table/migrations/node` for now.

**Why**

The loader touches the local file system through `node:fs` and `node:path`, so it is not part of the runtime-agnostic migration core. Remix already uses `/node` subpaths for APIs that depend on Node-compatible runtime behavior, such as `remix/multipart-parser/node`, and the package already exposes `remix/data-table/migrations/node`.

The name is not perfect because Bun and Deno can support many `node:` modules, and SQLite resources already use `node:fs` directly in the SQLite package. Still, `/node` communicates "requires Node-compatible built-ins" more clearly than putting filesystem loading in `remix/data-table/migrations`, which would make the base migration API look less portable.

**Alternatives**

- Export `loadMigrations()` from `remix/data-table/migrations` — rejected for now because it pulls filesystem assumptions into the portable migration entry point.
- Rename the subpath to `/fs` — plausible, and the repo has `file-storage/fs` and `session-storage/fs` precedents, but `migrations/node` already exists and matches `multipart-parser/node` for Node-compatible runtime helpers.
- Add a runtime-injected loader to the base API — deferred until non-Node filesystem loading becomes important enough to design around.

## Report migration status from the migrator

Add `migrator.status(database)` to report each known migration as `applied`, `pending`, or `drifted`.

**Why**

The migrator owns the ordered migration list and the journal comparison logic, so it is the right place to answer whether a database matches the code-defined migration set. `status()` gives runtime code, tests, and the CLI one shared way to inspect migration state before applying changes.

`drifted` means a migration id is recorded in the database journal, but the stored hash does not match the current migration SQL. This is different from `pending`, where the migration exists in code but has not been recorded in the database yet.

Status is per migration, not contagious. If migration `002` is drifted and migration `003` is recorded with a matching hash, `003` still reports `applied`.

```ts
[
  { id: '001_create_users', status: 'applied' },
  { id: '002_add_user_name', status: 'drifted' },
  { id: '003_add_posts', status: 'applied' },
  { id: '004_add_comments', status: 'pending' },
]
```

Drift should block `migrate()` from applying additional migrations until resolved, but `status()` should keep reporting the exact known state of each migration.

**Alternatives**

- Only return applied ids — rejected because callers would need to diff against the migration list themselves and would miss drift.
- Treat drift as an error instead of a status — possible for `migrate()`, but `status()` should be inspectable without throwing for the state it is designed to report.
