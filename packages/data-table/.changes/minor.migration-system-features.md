Add a first-class migration system under `remix/data-table/migrations` with:

- `createMigration(...)` and timestamp-based migration loading
- chainable `column` builders plus schema APIs for create, alter, drop, and index work
- `createMigrationRunner(adapter, migrations)` for `up`, `down`, `status`, and `dryRun`
- migration journaling, checksum tracking, and optional Node loading from `remix/data-table/migrations/node`

Migration callbacks now use split handles: `{ db, schema }`.

- `db` is the immediate data runtime (`query/create/update/delete/exec/transaction`)
- `schema` owns migration operations like `createTable`, `alterTable`, `plan`, and introspection

Migration-time DDL, DML, and introspection now share the same transaction token when migration transactions are enabled. In `dryRun`, schema introspection (`schema.hasTable` / `schema.hasColumn`) reads live adapter/database state and does not simulate pending dry-run operations.

Add public subpath exports for migrations, Node migration loading, SQL helpers, operators, and SQL builders. SQL compilation stays adapter-owned, while shared SQL compiler helpers remain available from `remix/data-table/sql-helpers`.
