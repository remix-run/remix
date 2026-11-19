Bind every query parameter as exactly one value. Previously, mysql2 expanded array parameters into lists and plain-object parameters into column assignments, and it substituted values into question marks inside quoted strings, quoted identifiers, and comments. The adapter now rejects objects other than `Date` and `Buffer`, leaves question marks inside quotes and comments as written, and rejects statements whose placeholder and value counts differ. Use `JSON.stringify(value)` for JSON data in raw SQL and `inList()` or one placeholder per item for lists of values.

```diff
-await db.exec('select * from accounts where id in (?)', [[1, 2]])
+await db.exec('select * from accounts where id in (?, ?)', [1, 2])
```
