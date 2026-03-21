BREAKING CHANGE: Prune `@remix-run/data-table` down to the end-user API. The root entrypoint now exports `createDatabase`, `Database`, `table`, `column`, relations, the public operators, `Query`/`query`, `sql`/`rawSql`, the core error classes, the core table/query SQL types, and the common relation/CRUD/transaction option types.

BREAKING CHANGE: Remove metadata getters and helper exports like `fail(...)` and `timestamps()`. Table hooks still return plain `{ value }` and `{ issues }` objects, and `timestamps: true | { createdAt, updatedAt }` remains supported on `table(...)`.
