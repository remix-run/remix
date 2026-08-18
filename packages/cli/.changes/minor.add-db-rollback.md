Add `remix db rollback`, which reverts applied migrations by running their `down.sql`

`Database.migrate()` already accepted `direction`, `to`, `step`, and `dryRun`, but the CLI never passed them, so a migration's `down.sql` was unreachable from `remix db` — `--to` only bounds forward progress. `rollback` reverts newest first, bounded by `--step <count>` (default `1`) or `--to <migration>`, which reverts back through that migration inclusive. `--dry-run` reports what would be reverted without running it. It also takes `--migrations`, `--journal-table`, and `--connection-env` (see #11723).
