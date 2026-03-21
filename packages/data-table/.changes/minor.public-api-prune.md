BREAKING CHANGE: Prune `@remix-run/data-table` down to the end-user API. The root entrypoint now exports only `createDatabase`, `Database`, `table`, `column`, relations, the public operators, `Query`/`query`, `sql`/`rawSql`, the core error classes, and the `Table`, `TableRow`, `Predicate`, `WhereInput`, and `SqlStatement` types.

BREAKING CHANGE: Remove metadata getters and helper exports like `fail(...)` and `timestamps()`. Table hooks still return plain `{ value }` and `{ issues }` objects, and `timestamps: true | { createdAt, updatedAt }` remains supported on `table(...)`.
