# Questions

## Should migration SQL be named `sql` or `up`?
Inline migrations currently draft as `{ id, sql }`, but the existing Node `loadMigrations()` API returns descriptors shaped like `{ id, name, up, down?, path? }` from `up.sql` and optional `down.sql` files.

If we keep `loadMigrations()` as-is, `createMigrator()` either needs to accept both shapes or inline migrations should use `up` too.
