BREAKING CHANGE: Removed adapter options

**Affected APIs**

- `SqliteDatabaseAdapterOptions` type: removed
- `createSqliteDatabaseAdapter` function: `options` arg removed
- `SqliteDatabaseAdapter` constructor: `options` arg removed

**Why**

Adapter options existed solely for tests to override adapter capabilities.
If you must override capabilities, you can do so directly via mutation:

```ts
let adapter = createSqliteDatabaseAdapter(sqlite)
adapter.capabilities = {
  ...adapter.capabilities,
  returning: false,
}
```
