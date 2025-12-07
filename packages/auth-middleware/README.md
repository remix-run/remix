# auth-middleware

Middleware for authentication with [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router).

## Installation

```sh
npm install @remix-run/auth-middleware @remix-run/auth
```

## Usage

```ts
import { createRouter } from '@remix-run/fetch-router'
import { session } from '@remix-run/session-middleware'
import { createAuthClient } from '@remix-run/auth'
import { auth, getUser } from '@remix-run/auth-middleware'

// Session setup
let sessionCookie = createCookie('session', { secrets: ['s3cr3t'] })
let sessionStorage = createFsSessionStorage('./sessions')

// Configure auth client
let authClient = createAuthClient({
  storage: {
    user: {
      findById: async (id) => database.users.findById(id),
      findByEmail: async (email) => database.users.findByEmail(email),
      create: async (data) => database.users.create(data),
    },
  },
})

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth(authClient), // Loads and caches user
  ],
})

// Use in routes - synchronous access!
router.get('/dashboard', () => {
  let user = getUser()
  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    })
  }
  return new Response(`Welcome, ${user.email}!`)
})
```

## How It Works

The middleware does a single database lookup per request and caches the full user object using AsyncLocalStorage. This lets you access the user synchronously anywhere in your handlers or components without prop drilling.

**Middleware flow:**

1. Reads `userId` from session (synchronous)
2. Looks up full user from database (asynchronous, once per request)
3. Caches user in AsyncLocalStorage
4. `getUser()` reads from cache (synchronous)

## API

### `authMiddleware(auth)`

Middleware that loads the authenticated user from the session and caches it for the request.

**Requires:**

- `session()` middleware - Must be registered before auth middleware

**Parameters:**

- `auth` - The auth client instance from `@remix-run/auth`

**Returns:** Middleware function

### `getUser()`

Returns the current authenticated user or `null` if not authenticated.

```ts
let user = getUser()
if (user) {
  console.log(user.id, user.email)
}
```

**Returns:** `AuthUser | null` - The cached user or null

## Protecting Routes

The middleware does not enforce authentication - it only loads and caches the user. To protect routes, check the user manually:

```ts
router.get('/protected', ({ url }) => {
  let user = getUser()
  if (!user) {
    let returnTo = encodeURIComponent(url.pathname + url.search)
    return new Response(null, {
      status: 302,
      headers: { Location: `/login?returnTo=${returnTo}` },
    })
  }

  return new Response('Protected content')
})
```

### Helper Function

You can create a helper to reduce boilerplate:

```ts
function requireUser(url: URL): AuthUser | Response {
  let user = getUser()
  if (!user) {
    let returnTo = encodeURIComponent(url.pathname + url.search)
    return new Response(null, {
      status: 302,
      headers: { Location: `/login?returnTo=${returnTo}` },
    })
  }
  return user
}

// Usage
router.get('/protected', ({ url }) => {
  let user = requireUser(url)
  if (user instanceof Response) return user

  return new Response(`Hello, ${user.email}`)
})
```

## Related Packages

- [`@remix-run/auth`](https://github.com/remix-run/remix/tree/main/packages/auth) - Authentication primitives and client
- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`@remix-run/session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Session management middleware

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
