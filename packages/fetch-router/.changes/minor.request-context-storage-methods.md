BREAKING CHANGE: Remove `context.storage`, `context.session`, and `context.sessionStarted` from `@remix-run/fetch-router`, and rename `createStorageKey(...)` to `createContextKey(...)`.

`RequestContext` now provides request-scoped context methods directly (`context.get(key)`, `context.set(key, value)`, and `context.has(key)`) using keys created with `createContextKey(...)`.
