# async-context-middleware

Middleware for authenticating users.

This middleware stores the user context in [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) (using `node:async_hooks`), making it available to all functions in the same async execution context.

## Installation

```sh
npm install @remix-run/auth-middleware
```

## Usage

Create and provide an auth middleware at the router level using `createAuth().middleware` to make the auth context available to all function sin the same async execution context. Get access to the authenticated user using the `auth.getUser()` function. Require an authenticated user using the `auth.requireUser()` function.

```ts
import { createCookie } from '@remix-run/cookie'
import { createRouter, route } from '@remix-run/fetch-router'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { session } from '@remix-run/session-middleware'
import { atCuteAuthMethod } from '@remix-run/atcute'

let auth = createAuth([
  atCuteAuthMethod(...),
])

let router = createRouter({
  middleware: [auth.load],
})

router.get('/', async () => {
  // Returns null if not available
  let user = auth.getUser(false)

  return new Response(user ? `User ${user.id}` : 'No user')
})

router.get('/protected', {
  middleware: [auth.required('/login?redirect=/protected')],
  action() {
    // Always available
    let user = auth.getUser()

    return new Response(`User ${user.id}`)
  },
})
```

Note: This middleware requires support for `node:async_hooks`.

## Related Packages

- [`cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - HTTP cookie management
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`session`](https://github.com/remix-run/remix/tree/main/packages/session) - Session management
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Middleware for managing sessions

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
