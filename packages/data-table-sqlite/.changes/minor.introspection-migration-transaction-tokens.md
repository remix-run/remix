Add support for migration transaction tokens in adapter introspection hooks.
`hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now accept a transaction token, validate it, and execute against the migration transaction when provided.
