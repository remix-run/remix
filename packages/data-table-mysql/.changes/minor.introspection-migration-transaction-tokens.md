Add support for migration transaction tokens in adapter introspection hooks.
`hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)` now use the provided migration transaction connection when present.
