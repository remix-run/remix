BREAKING CHANGE: `RequestContext.headers` now returns a standard `Headers` instance instead of the `SuperHeaders`/`Headers` subclass from `@remix-run/headers`. As a result, the `@remix-run/headers` peer dependency has now been removed.

If you were relying on the type-safe property accessors on `RequestContext.headers`, you should use the new parse functions from `@remix-run/headers` instead:

```ts
import { parseAccept } from '@remix-run/headers'

// Before:
router.get('/api/users', (context) => {
  let acceptsJson = context.headers.accept.accepts('application/json')
  // ...
})

// After:
router.get('/api/users', (context) => {
  let accept = parseAccept(context.headers.get('accept'))
  let acceptsJson = accept.accepts('application/json')
  // ...
})
```
