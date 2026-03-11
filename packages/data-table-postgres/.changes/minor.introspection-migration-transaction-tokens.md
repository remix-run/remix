Add transaction-aware migration introspection to the postgres adapter.

`hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now use the provided migration transaction client when present, so planning and execution can inspect schema state inside the active migration transaction.
