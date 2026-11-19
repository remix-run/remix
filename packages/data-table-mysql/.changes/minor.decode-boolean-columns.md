Query builder results now read `boolean()` columns as `true` or `false`. MySQL stores booleans as `tinyint(1)`, which mysql2 returns as `1` or `0`. `db.exec()` results keep the values mysql2 returns.
