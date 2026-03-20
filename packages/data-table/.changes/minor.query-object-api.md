BREAKING CHANGE: Replace the public `QueryBuilder` API with `Query` objects that can be created with `query(table)` and executed with `db.exec(...)`.

`db.query(table)` still provides the same chainable ergonomics, but it now returns the public `Query` class in a database-bound form instead of a separate `QueryBuilder` type. `db.exec(...)` now accepts only raw SQL or `Query` values, and unbound terminal methods like `first()`, `count()`, `exists()`, `insert()`, `update()`, and `delete()` return `Query` objects instead of separate command descriptor types.

The incidental `QueryMethod` type export has also been removed; use `Database['query']` or `QueryForTable<table>` when you need that type shape.
