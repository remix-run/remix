# Implementation Plan

Programmatic API only; CLI commands come later.

- [x] Update migration public types in `packages/data-table/src/lib/migrations.ts`.
  - Add `Migration`/input shape for inline `{ id: string, sql: string }` migrations.
  - Resolved loader compatibility by changing `loadMigrations()` to return `{ id, sql }`.
  - Add `Migrator` with `migrate(database, options?)` and `status(database)`.

- [x] Add `createMigrator(migrations)` in `packages/data-table/src/lib/migrations/runner.ts` or a new owning module.
  - It should accept the migration list once and a connected `Database` per call.
  - Callers own database connection/disposal lifecycle.
  - `migrate(database, { to })` applies pending migrations up to the target id, or latest when omitted.
  - `status(database)` reports per-migration `applied`, `pending`, or `drifted`; drift is not contagious.

- [x] Remove the old lower-level runner/registry API.
  - Removed `createMigrationRunner`, `createMigrationRegistry`, down migrations, step, dry-run, and transaction directives.
  - The new API is connected-database-based and up-only: `migrate(db, { to })` plus `status(db)`.

- [x] Update filesystem loading only as needed.
  - `packages/data-table/src/lib/migrations-node.ts` already exports `loadMigrations()` from `remix/data-table/migrations/node`.
  - `loadMigrations()` now returns the same `{ id, sql }` shape accepted by `createMigrator()`.
  - Keep the `/node` subpath for filesystem loading.

- [x] Update tests in `packages/data-table/src/lib/migrations.test.ts` and `packages/data-table/src/lib/migrations-node.test.ts`.
  - Add coverage for `createMigrator([...]).migrate(database)`.
  - Add coverage for `migrate(database, { to })`.
  - Add coverage for `status(database)` with applied, pending, drifted, and a later matching applied migration after drift.
  - Keep existing loader tests unless the descriptor shape changes.

- [x] Update exports.
  - `packages/data-table/src/migrations.ts` should export `createMigrator` and related public types.
  - `packages/remix/src/data-table/migrations.ts` should mirror the public subpath export if needed.
  - Package export maps likely do not need changes because `./migrations` and `./migrations/node` already exist.

- [x] Validate narrowly first.
  - `pnpm --filter @remix-run/data-table exec remix-test src/lib/migrations.test.ts src/lib/migrations-node.test.ts`
  - `pnpm --filter @remix-run/data-table run typecheck`
