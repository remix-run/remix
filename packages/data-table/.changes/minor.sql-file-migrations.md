BREAKING CHANGE: Migrations are now plain SQL files

Migrations are directories named `YYYYMMDDHHmmss_<slug>/` containing a hand-written `up.sql` (required) and an optional `down.sql`. The runner sends each script to the adapter as a single multi-statement query and journals it on success.

**Removed APIs (`remix/data-table/migrations`)**

- `createMigration`
- `MigrationContext`, `MigrationSchema`, `AlterTableBuilder`, `CreateMigrationInput`, `Migration`, `KeyColumns`, `TableInput`
- `parseMigrationFilename` (replaced by `parseMigrationDirectoryName`)
- The `column` / `ColumnBuilder` re-exports from `remix/data-table/migrations` (still available from the main `remix/data-table` entry)

**Changed APIs**

- `MigrationDescriptor` is now `{ id, name, up: string, down?: string, transaction?, path? }`. Checksums are always `sha256(up)`, computed by the runner.
- `MigrateResult.sql` is `string[]` instead of `SqlStatement[]`
- `loadMigrations(directory)` scans folder-per-migration layouts (not `.ts` files) and returns descriptors with SQL strings
- `DatabaseAdapter` gained a required `executeScript(sql, transaction?)` method; existing first-party adapters implement it natively

**Transaction Modes**

Migrations still run inside an adapter transaction by default. Override per migration with a directive on a `--` line of `up.sql`:

```sql
-- data-table/transaction: none
create index concurrently users_email_idx on users (email);
```

Modes are `auto` (default), `required`, and `none`. The mode can also be set explicitly on a `MigrationDescriptor` via the `transaction` field.

**Migrating From the Schema-Builder API**

Replace each `createMigration({ async up({ schema })... })` file with a directory containing the equivalent SQL:

```txt
db/
  migrations/
    20260301113000_add_user_status/
      up.sql
      down.sql
```
