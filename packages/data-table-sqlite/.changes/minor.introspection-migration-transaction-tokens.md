Add transaction-aware migration introspection to the sqlite adapter.

`hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now accept a transaction token, validate it, and execute against the migration transaction when provided so schema checks line up with the active migration transaction.
