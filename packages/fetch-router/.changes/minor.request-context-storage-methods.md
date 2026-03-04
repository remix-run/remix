BREAKING CHANGE: Remove `context.storage`, `context.session`, `context.sessionStarted`, `context.formData`, and `context.files` from `@remix-run/fetch-router`, and rename `createStorageKey(...)` to `createContextKey(...)`.

`RequestContext` now provides request-scoped context methods directly (`context.get(key)`, `context.set(key, value)`, and `context.has(key)`), using keys created with `createContextKey(...)` or constructors like `Session` and `FormData`.

Session middleware now stores the request session with `context.set(Session, session)`, and form-data middleware now stores parsed form data with `context.set(FormData, formData)`. Uploaded files are read from `context.get(FormData)` using `get(...)`/`getAll(...)`.

`RequestContext` is now generic only over route params (`RequestContext<{ id: string }>`), and no longer accepts a request-method generic (`RequestContext<'GET', ...>`).
