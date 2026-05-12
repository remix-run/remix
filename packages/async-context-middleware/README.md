# middleware/async-context

Request-scoped async context middleware for Remix. It stores each request context in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) so utilities can access it anywhere in the same async call stack.

## Features

- **Request context access** - Read the current `RequestContext` from anywhere in the same async execution flow
- **App-typed `getContext()`** - Reuses your fetch-router `RouterTypes.context` by default
- **Simple router integration** - Add a single middleware at the router level
- **Node async hooks** - Built on `node:async_hooks` `AsyncLocalStorage`

## Installation

```sh
npm i remix
```

## Usage

Use `asyncContext()` at the router level to make the current request context available to helpers deeper in the same async call stack.

```ts
import { createRouter } from 'remix/router'
import { asyncContext, getContext } from 'remix/middleware/async-context'

let router = createRouter({
  middleware: [asyncContext()],
})

async function loadCurrentUser() {
  let context = getContext()
  let userId = context.params.id

  return users.getById(userId)
}

router.get('/users/:id', async () => {
  let user = await loadCurrentUser()
  return Response.json(user)
})
```

This middleware requires support for `node:async_hooks`, so it is intended for Node.js runtimes.

## Typed `getContext()`

`getContext()` is global and out-of-band, so it reuses your fetch-router `RouterTypes.context` by default.

```ts
import { requireAuth } from 'remix/middleware/auth'
import type { AnyParams, ContextWithParams, MiddlewareContext } from 'remix/router'
import { loadAuth } from './middleware/auth.ts'
import { loadSession } from './middleware/session.ts'

export type RootMiddleware = [ReturnType<typeof loadSession>, ReturnType<typeof loadAuth>]
export const authenticatedMiddleware = [requireAuth<{ id: string }>()] as const

export type AppContext<params extends AnyParams = {}> = ContextWithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

export type AuthenticatedAppContext<params extends AnyParams = {}> = ContextWithParams<
  MiddlewareContext<typeof authenticatedMiddleware, AppContext>,
  params
>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}
```

After that augmentation, `getContext()` returns your app context values everywhere in the app, with route params typed broadly as `AnyParams`.

```ts
import { Auth } from 'remix/middleware/auth'
import { getContext } from 'remix/middleware/async-context'

function getCurrentAuth() {
  return getContext().get(Auth)
}
```

Route handlers themselves can still use more precise route-specific params in their own `RequestContext` types.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and request context contracts for Remix
- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Request-time auth state and protected route middleware
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Session loading middleware often paired with async request context

## Related Work

- [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
