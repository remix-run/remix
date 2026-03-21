BREAKING CHANGE: Remove the `@remix-run/data-table/sql` export. Import `SqlStatement`, `sql`, and `rawSql` from `@remix-run/data-table` instead.

BREAKING CHANGE: Remove the `@remix-run/data-table/sql-helpers` export. Built-in adapters now inline their local SQL compiler helpers, and adapter-only contracts live under the undocumented `@remix-run/data-table/adapter` subpath.
