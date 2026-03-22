BREAKING CHANGE: Remove the `@remix-run/data-table/sql` export. Import `SqlStatement` and `sql` from `@remix-run/data-table` instead.

BREAKING CHANGE: Remove `rawSql(...)` from the root API. Use `sql\`...\`` for the tagged SQL helper, or pass a raw SQL string plus values directly to `db.exec(...)`.

BREAKING CHANGE: Remove the `@remix-run/data-table/sql-helpers` export. Built-in adapters now inline their local SQL compiler helpers, and adapter-only contracts live under the undocumented `@remix-run/data-table/adapter` subpath.
