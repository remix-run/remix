Bind every query parameter as exactly one value. Previously, mysql2 expanded array parameters into lists and plain-object parameters into column assignments, and it substituted values into question marks inside quoted strings, quoted identifiers, and comments. The adapter now binds parameters itself: it rejects objects other than `Date`, `Buffer`, and typed arrays, leaves question marks inside quotes and comments as written, and rejects statements whose placeholder and value counts differ.

Raw SQL that relied on mysql2's array expansion, object expansion, or `??` identifier placeholder must be rewritten. Use `JSON.stringify(value)` for JSON data, `inList()` or one placeholder per item for lists of values, and quoted identifiers in the SQL text.

```diff
-await db.exec('select * from accounts where id in (?)', [[1, 2]])
+await db.exec('select * from accounts where id in (?, ?)', [1, 2])
-await db.exec('select ?? from accounts', ['email'])
+await db.exec('select `email` from accounts')
```
