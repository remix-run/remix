Add transaction-aware migration introspection to the mysql adapter.

`hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now use the provided migration transaction connection when present, so planning and execution can inspect schema state inside the active migration transaction.
