Nested `sql` composition now requires statements created by `sql` or `rawSql` from the same loaded copy of the package. Other statement objects are passed as parameter values. Direct `db.exec()` calls continue to accept structural `SqlStatement` objects.

Queries that compose hand-built, copied, deserialized, or separately loaded statements may now return different results or raise driver errors. Use the local `rawSql` helper to create composable fragments:

```diff
-let condition = { text: 'status = ?', values: ['active'] }
+let condition = rawSql('status = ?', ['active'])
 let statement = sql`select * from users where ${condition}`
```
