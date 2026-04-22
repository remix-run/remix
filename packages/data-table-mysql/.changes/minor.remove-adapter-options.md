BREAKING CHANGE: Removed adapter options

**Affected APIs**

- `MysqlDatabaseAdapterOptions` type: removed
- `createMysqlDatabaseAdapter` function: `options` arg removed
- `MysqlDatabaseAdapter` constructor: `options` arg removed

**Why**

Adapter options existed solely for tests to override adapter capabilities.
If you must override capabilities, you can do so directly via mutation:

```ts
let adapter = createMysqlDatabaseAdapter(mysql)
adapter.capabilities = {
  ...adapter.capabilities,
  upsert: false,
}
```
