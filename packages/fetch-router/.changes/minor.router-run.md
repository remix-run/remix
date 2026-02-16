Added a new `router.run(...)` API to `@remix-run/fetch-router`

`router.run()` executes a callback inside the router's middleware and request context without dispatching to a route action. This is useful in tests and utilities that need request-scoped values such as authenticated users, checked-out database handles, correlation IDs, or feature flags.

Supported signatures:

```ts
router.run(input, callback)
router.run(input, init, callback)
```

Example:

```ts
let value = await router.run('https://remix.run', ({ storage }) => storage.get(myStorageKey))
```
