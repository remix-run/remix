BREAKING CHANGE: Replace the old query-builder split with one public `Query` API. Build queries with `query(table)` and execute them with `db.exec(...)`.

`db.query(table)` has been removed. `db.exec(...)` now accepts raw SQL or `Query` values, and terminal methods like `all()`, `first()`, `count()`, `exists()`, `insert()`, `update()`, and `delete()` always return `Query` objects instead of executing immediately.

The incidental `QueryMethod` type export has also been removed.
