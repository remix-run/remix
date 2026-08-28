Add a `rollback` command to `runRemixDb()`

Reverts applied migrations newest first, bounded by `step` (default `1`) or `to` (inclusive), with optional `dryRun`. This is what backs `remix db rollback`, and it gives hosts embedding the data-table CLI the same command (see #11723).
