# Data and Validation

Read when untrusted input becomes an app value, or when a feature changes persistence or migrations.

Installed API docs: `src/data-schema/README.md`, `src/data-table/README.md`, and the mapped dialect README, such as `src/data-table-sqlite/README.md`. The parent schema/table READMEs cover subpaths such as form-data, operators, and migrations. Read `src/cli/README.md` for `remix db` configuration and commands.

## Keep the Boundaries Separate

| Boundary               | Responsibility                                                      |
| ---------------------- | ------------------------------------------------------------------- |
| Request → action       | Parse fields, params, query strings, cookies, and external payloads |
| Identity → resource    | Authorize ownership/permissions; do not trust submitted owner IDs   |
| Action → persistence   | Pass validated values; translate known conflicts into HTTP outcomes |
| Persistence → database | Enforce durable constraints and transaction semantics               |
| Action → response      | Return HTML/errors/redirects with explicit status and headers       |

Build one schema per input source with `remix/data-schema/form-data` and parse with `parseSafe`, so invalid input is a return value the action can render:

```ts
import * as s from 'remix/data-schema'
import * as checks from 'remix/data-schema/checks'
import * as coerce from 'remix/data-schema/coerce'
import * as f from 'remix/data-schema/form-data'

const bookSchema = f.object({
  title: f.field(s.string().pipe(checks.minLength(1))),
  year: f.field(coerce.number()),
  tags: f.fields(s.array(s.string())),
})

// In an action, after formData() middleware has parsed the body:
let parsed = s.parseSafe(bookSchema, context.get(FormData))
if (!parsed.success) {
  // parsed.issues: standard-schema issues with `message` and an optional `path`
  return context.render(<NewBookPage issues={parsed.issues} />, { status: 400 })
}
let book = parsed.value // { title: string; year: number; tags: string[] }
```

`f.object` accepts `FormData` or `URLSearchParams`, so the same shape validates query strings. `f.fields` keeps repeated values; `Object.fromEntries` would drop them. Use `f.file`/`f.files` for uploads and `s.defaulted(...)` for optional fields. The README owns the full builder, check, and coercion list. The [routing recipe](routing-and-controllers.md) shows a complete form with field preservation and a failure response.

Read `context.get(FormData)` when `formData()` middleware has parsed the request; call `request.formData()` directly only in a route that owns body parsing. Middleware that depends on form fields (`csrf()`, `methodOverride()`) runs after `formData()`. For multipart data, use the [upload workflow](file-uploads.md).

Validation is not authorization. A well-formed user ID is still attacker-controlled; derive ownership from the authenticated context and enforce it in the write/query.

## Add Persistence Without Rebuilding the App

1. Inspect the existing database client, connection lifecycle, schemas, and migrations before introducing another abstraction or dependency.
2. Keep table definitions and queries under `app/data/`. Add a database dependency to request context only when useful; declare what its middleware provides as shown in [middleware and server](middleware-and-server.md#describe-what-custom-middleware-provides).
3. Choose the existing runtime's database client. `createSqliteDatabase` accepts compatible synchronous clients, including built-in Node/Bun SQLite; do not assume `better-sqlite3` must be installed. Use the matching PostgreSQL/MySQL integration for those databases.
4. Use table validation/hooks for persistence invariants shared by callers, not as a replacement for form-specific feedback. Database constraints remain necessary for uniqueness and races.
5. Use a transaction for writes that must succeed together. Scope queries/writes to the authorized owner, and handle a known unique/conflict outcome at the action boundary. Let unexpected database errors reach the app's error handler.
6. Close connections during shutdown and dispose test databases. A fresh router does not isolate a database imported as a shared module singleton.

Prefer the table/query APIs for ordinary app work. Read the data-table README for query composition, relations, hooks, and transactions; reach for raw SQL or driver interfaces only when the task needs them.

## Schema Metadata Is Not a Migration

Runtime `table(...)` column definitions do not create or alter database tables. Keep the runtime model and actual database constraints aligned, but author DDL in migrations.

Default disk layout:

```text
db/migrations/
  20260301083000_create_books/
    up.sql
    down.sql
```

- `up.sql` is required; omit `down.sql` for an intentionally irreversible migration.
- Applied migrations are immutable. Add a new migration rather than changing a checksummed file that may already be deployed.
- Keep migrations independent of live app/schema imports so replaying history is stable.
- Read the README for transaction modes and dialect-specific DDL limitations. Do not infer SQLite behavior applies to PostgreSQL or MySQL.
- Prefer the app's existing migration script or configured `remix db migrate` workflow. Programmatic `loadMigrations(...)` and `db.migrate(...)` are for apps that intentionally own that lifecycle; do not add automatic production startup migrations by default.

Inspect `remix db status` before changing migration state. Validate a new migration on a disposable database, including an upgrade from the relevant prior schema. Use rollback dry runs when appropriate; do not run `wipe`, `reset`, or a destructive rollback on shared data without explicit approval.
