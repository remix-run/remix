Add a first-class migration system under `remix/data-table/migrations` with `createMigration`, chainable `column` builders, schema/table migration planners, migration registry/runner APIs, and optional Node file discovery from `remix/data-table/migrations/node`.

Migration callbacks now use split handles: `{ db, schema }`.

- `db` is the immediate data runtime (`query/create/update/delete/exec/transaction`)
- `schema` owns migration/schema operations (`createTable/alterTable/createIndex/...`, `plan`, `hasTable`, `hasColumn`)

Migration-time DDL, DML, and introspection now share the same transaction token when migration transactions are enabled. In `dryRun`, schema introspection (`schema.hasTable` / `schema.hasColumn`) reads live adapter/database state and does not simulate pending dry-run operations.

Keep SQL compilation adapter-owned and expose shared SQL compiler helpers from `remix/data-table/sql-helpers`.
