# async-context-middleware

Request-scoped async context middleware for Remix. It stores each request context in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) so utilities can access it anywhere in the same async call stack.

## Features

- **Request context access** - Read the current `RequestContext` from anywhere in the same async execution flow
- **App-typed `getContext()`** - Augment `AsyncContextTypes` so `getContext()` returns your app's request context contract
- **Simple router integration** - Add a single middleware at the router level
- **Node async hooks** - Built on `node:async_hooks` `AsyncLocalStorage`

## Installation

```sh
npm i remix
```

## Usage

Use `asyncContext()` at the router level to make the current request context available to helpers deeper in the same async call stack.

```ts
import { createRouter } from 'remix/fetch-router'
import { asyncContext, getContext } from 'remix/async-context-middleware'

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

`getContext()` is global and out-of-band, so apps can augment `AsyncContextTypes` to tell the package what request context lives in async local storage.

```ts
import type { AnyParams, MiddlewareContext, WithParams } from 'remix/fetch-router'
import type { WithRequiredAuth } from 'remix/auth-middleware'

export type RootMiddleware = [ReturnType<typeof loadSession>, ReturnType<typeof loadAuth>]

export type AppContext<params extends AnyParams = AnyParams> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

export type AuthenticatedAppContext<params extends AnyParams = AnyParams> = WithRequiredAuth<
  AppContext<params>,
  { id: string }
>

declare module 'remix/async-context-middleware' {
  interface AsyncContextTypes {
    requestContext: AppContext<AnyParams>
  }
}
```

After that augmentation, `getContext()` returns `AppContext<AnyParams>` everywhere in the app.

```ts
import { Auth } from 'remix/auth-middleware'
import { getContext } from 'remix/async-context-middleware'

function getCurrentAuth() {
  return getContext().get(Auth)
}
```

Use a broad app-level context like `AppContext<AnyParams>` here. Route handlers themselves can still use more precise route-specific params in their own `RequestContext` types.

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and request context contracts for Remix
- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Request-time auth state and protected route middleware
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Session loading middleware often paired with async request context

## Related Work

- [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
