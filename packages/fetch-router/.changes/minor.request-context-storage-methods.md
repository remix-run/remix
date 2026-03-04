BREAKING CHANGE: Remove `context.storage` and the `AppStorage` export from `@remix-run/fetch-router`.

`RequestContext` now provides request-scoped storage methods directly (`context.get(key)`, `context.set(key, value)`, and `context.has(key)`) using keys created with `createStorageKey(...)`.
