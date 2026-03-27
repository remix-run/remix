# Building Middleware

Use this reference when the built-in middleware packages are close but not enough, or when the app
needs a custom request-boundary concern.

## Middleware Shape

Remix middleware is a function that receives the current request context plus `next()`, then returns
a `Response` or a promise for one.

Conceptually:

```ts
import type { Middleware } from 'remix/fetch-router'

function example(): Middleware {
  return async (context, next) => {
    return next()
  }
}
```

Most middleware should be authored as a factory like `example(options?)` instead of a one-off inline
function. That keeps configuration explicit and makes reuse easier.

## The Three Jobs Middleware Can Do

### 1. Pre-process The Request

Read request headers, URL, method, or request-scoped state before the route runs.

Typical uses:

- resolve auth
- parse or normalize request input
- attach request-scoped services
- decide whether to allow the request to continue

### 2. Short-Circuit The Request

Return a `Response` without calling `next()` when the middleware fully owns the result.

Typical uses:

- reject unauthorized requests
- answer a CORS preflight
- serve a static file
- fail fast on malformed input

### 3. Post-process The Response

Call `await next()`, then inspect or modify the response before returning it.

Typical uses:

- logging and timing
- compression
- adding response headers
- committing session changes

## Basic Patterns

### Wrapper Middleware

Use this when the middleware surrounds downstream work:

```ts
import type { Middleware } from 'remix/fetch-router'

function requestTiming(): Middleware {
  return async (context, next) => {
    let startedAt = Date.now()
    let response = await next()
    let mutable = new Response(response.body, response)
    mutable.headers.set('X-Response-Time', `${Date.now() - startedAt}ms`)
    return mutable
  }
}
```

### Guard Middleware

Use this when the middleware should reject or redirect before the route runs:

```ts
import type { Middleware } from 'remix/fetch-router'

function requireHeader(name: string): Middleware {
  return (context, next) => {
    if (context.request.headers.has(name) === false) {
      return new Response('Missing header', { status: 400 })
    }

    return next()
  }
}
```

## Request Context Contracts

When middleware loads a value that downstream code should read, treat that value as part of the
middleware API.

A good middleware provider usually exports:

- the context key consumers read with `context.get(...)`
- the middleware that sets the value at runtime
- an optional `With...` helper type for stronger request context typing

```ts
import {
  createContextKey,
  type MergeContext,
  type Middleware,
  type RequestContext,
} from 'remix/fetch-router'

type CurrentUser = { id: string; role: 'admin' | 'user' } | null

export const CurrentUserKey = createContextKey<CurrentUser>()

export type WithCurrentUser<context extends RequestContext<any, any>> = MergeContext<
  context,
  [readonly [typeof CurrentUserKey, CurrentUser]]
>

export function loadCurrentUser(): Middleware {
  return async (context, next) => {
    let user = await resolveCurrentUser(context.request)
    context.set(CurrentUserKey, user)
    return next()
  }
}
```

Downstream handlers can then read:

```ts
let user = context.get(CurrentUserKey)
```

## Global Vs Route-Local

Make middleware global when it is truly part of the request boundary for the whole app:

- logging
- compression
- sessions
- auth resolution
- request parsing

Keep middleware route-local when only one route area needs it:

- admin-only checks
- resource-specific validation
- one-off redirect or failure rules

If the middleware should run on nearly every request, it probably belongs in the root stack.

## Ordering Rules

Middleware order is part of the behavior, not an implementation detail.

- Body-dependent middleware must run after the body parser it depends on.
- Session-backed auth must run after session loading.
- Cheap short-circuit middleware should usually run early.
- Wrapper middleware like logging or compression often belongs near the outside of the stack.

Use `./middleware-ordering.md` when you need concrete placement guidance.

## Testing Custom Middleware

Test middleware through `router.fetch(...)` with ordinary requests. That keeps the test close to the
real runtime contract.

Typical assertions:

- it short-circuits when the guard condition fails
- it sets request-scoped context values that handlers can read
- it mutates or wraps the response as expected
- it composes correctly with neighboring middleware

## Common Mistakes

- Forgetting to call `next()` in middleware that should continue the pipeline.
- Calling `next()` after already deciding to short-circuit the request.
- Hiding important request-scoped values inside private helpers instead of exporting the context key.
- Doing route-specific business logic in app-wide middleware.
- Depending on another middleware without documenting or enforcing the order.
