BREAKING CHANGE: Removed adapter options

**Affected APIs**

- `PostgresDatabaseAdapterOptions` type: removed
- `createPostgresDatabaseAdapter` function: `options` arg removed
- `PostgresDatabaseAdapter` constructor: `options` arg removed

**Why**

Adapter options existed solely for tests to override adapter capabilities.
If you must override capabilities, you can do so directly via mutation:

```ts
let adapter = createPostgresDatabaseAdapter(postgres)
adapter.capabilities = {
  ...adapter.capabilities,
  returning: false,
}
```
