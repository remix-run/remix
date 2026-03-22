BREAKING CHANGE: Prune `@remix-run/data-table` down to the end-user API. The root entrypoint now exports `createDatabase`, `Database`, `table`, `column`, relations, the public operators, `Query`/`query`, `sql`, the core error classes, the core table/query SQL types, and the common relation/transaction option types.

BREAKING CHANGE: Remove the database CRUD helper surface (`db.query(...)`, `db.find(...)`, `db.findOne(...)`, `db.findMany(...)`, `db.count(...)`, `db.create(...)`, `db.createMany(...)`, `db.update(...)`, `db.updateMany(...)`, `db.delete(...)`, and `db.deleteMany(...)`). Build query objects with `query(table)` and execute them with `db.exec(...)`.

BREAKING CHANGE: Remove metadata getters and helper exports like `fail(...)`, `timestamps()`, and `rawSql(...)`. Table hooks still return plain `{ value }` and `{ issues }` objects, and `timestamps: true | { createdAt, updatedAt }` remains supported on `table(...)`.
