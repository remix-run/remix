Query builder reads and writes now convert values by column type, so rows have the same JavaScript shape on every adapter. `column.json()` values are written with `JSON.stringify()`, including strings, and values compared with `eq()`, `inList()`, and the other value operators on a `json` column are serialized the same way. Drivers can implement the new optional `DatabaseDriver.decodeValue(value, column)` hook to convert values their database returns in a storage format; `Database` calls it for table query and `returning` rows, while `db.exec()` results are returned unchanged.

Arrays interpolated into `sql` now expand into a parenthesized list with one parameter per item, and an empty array throws. To bind an array as a single parameter, such as a PostgreSQL array, wrap it in `rawSql`:

```ts
let byIds = sql`select * from users where id in ${['u_001', 'u_002']}`
// select * from users where id in (?, ?)

let byArray = sql`select * from users where id = any(${rawSql('?', [['u_001', 'u_002']])})`
```
