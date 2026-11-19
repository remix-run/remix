Reject object and array parameters that mysql2 would expand into SQL. Dates and buffers remain valid parameters. Use `JSON.stringify(value)` for JSON data and `inList()` for lists of query values.

```diff
-await db.exec('select * from accounts where id in (?)', [[1, 2]])
+await db.exec('select * from accounts where id in (?, ?)', [1, 2])
```
