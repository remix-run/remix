BREAKING CHANGE: Replace the public `QueryBuilder` API with `Query` objects that can be created with `query(table)` and executed with `db.exec(...)`.

`db.query(table)` still provides the same chainable ergonomics, but it now returns the public `Query` class in a database-bound form instead of a separate `QueryBuilder` type. Unbound queries expose terminal methods like `first()`, `count()`, `exists()`, `insert()`, `update()`, and `delete()` as immutable command objects that can be passed to `db.exec(...)`.
