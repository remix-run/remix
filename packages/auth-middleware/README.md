# @remix-run/auth-middleware

Authentication middleware for [`@remix-run/fetch-router`](../fetch-router). Handles auth API routes and provides synchronous access to the current user.

## Installation

```bash
npm install @remix-run/auth-middleware @remix-run/auth
```

## Quick Start

```ts
import { createRouter } from '@remix-run/fetch-router'
import { session } from '@remix-run/session-middleware'
import { createCookie } from '@remix-run/cookie'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { createAuthClient } from '@remix-run/auth'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
import { createAuthMiddleware } from '@remix-run/auth-middleware'

// Session setup
let sessionCookie = createCookie('session', { secrets: ['s3cr3t'] })
let sessionStorage = createMemorySessionStorage()

// Auth setup
let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: createMemoryStorageAdapter(),
  // ...
})

let { auth, getUser } = createAuthMiddleware(authClient)

// Router setup
let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth, // Handles auth routes + loads user
  ],
})

// Use in routes
router.get('/dashboard', () => {
  let user = getUser() // Synchronous!
  if (!user) {
    return new Response(null, { status: 302, headers: { Location: '/login' } })
  }
  return new Response(`Welcome, ${user.name}!`)
})
```

## What It Does

The middleware provides two key features:

### 1. Auth API Route Handling

Automatically handles all auth-related HTTP routes:

- `POST {authBasePath}/oauth/sign-in/:provider` - Initiate OAuth flow
- `GET {authBasePath}/oauth/callback/:provider` - OAuth callback
- `GET {authBasePath}/email-verification/verify/:token` - Email verification

No manual route wiring needed.

### 2. User Loading & Caching

Loads the authenticated user once per request and caches it using `AsyncLocalStorage`. This enables synchronous access anywhere in your handlers without prop drilling.

**Request flow:**

1. Check if request matches an auth API route → handle if so
2. Read `userId` from session
3. Look up full user from storage
4. Cache user in `AsyncLocalStorage`
5. `getUser()` reads from cache (synchronous)

## API

### `createAuthMiddleware(authClient)`

Creates the middleware and user getter for your auth client.

```ts
let { auth, getUser } = createAuthMiddleware(authClient)
```

**Parameters:**

- `authClient` - The auth client from `@remix-run/auth`

**Returns:**

- `auth` - Middleware function to register with the router
- `getUser` - Function to get the current user (synchronous)

### `auth`

Middleware that handles auth API routes and loads/caches the current user.

```ts
// Assuming sessionCookie, sessionStorage, and auth are already defined
let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage), // Required: must come before auth
    auth,
  ],
})
```

### `getUser()`

Returns the current authenticated user or `null`.

```ts
let user = getUser()

if (user) {
  console.log(user.id, user.email, user.name)
}
```

**Returns:** `AuthUser | null`

## Protecting Routes

The middleware loads the user but doesn't enforce authentication. Check manually in route handlers:

```ts
router.get('/dashboard', () => {
  let user = getUser()
  if (!user) {
    return new Response(null, { status: 302, headers: { Location: '/login' } })
  }
  return new Response(`Hello, ${user.name}!`)
})
```

### Helper Function

Create a helper to reduce boilerplate:

```ts
import type { AuthUser } from '@remix-run/auth'

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
router.get('/dashboard', ({ url }) => {
  let user = requireUser(url)
  if (user instanceof Response) return user

  return new Response(`Hello, ${user.name}!`)
})
```

## Full Example

```ts
// app/utils/auth.ts
import { createAuthClient } from '@remix-run/auth'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
import { createGitHubOAuthProvider } from '@remix-run/auth/oauth-providers/github'
import { createAuthMiddleware } from '@remix-run/auth-middleware'
import { createCookie } from '@remix-run/cookie'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'

export let sessionCookie = createCookie('session', {
  secrets: [process.env.SESSION_SECRET!],
  httpOnly: true,
  sameSite: 'lax',
})

export let sessionStorage = createMemorySessionStorage()

export let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  authBasePath: '/api/auth',
  storage: createMemoryStorageAdapter(),
  password: {
    enabled: true,
    sendReset: ({ user, url }) => {
      // Send password reset email
    },
  },
  oauth: {
    enabled: true,
    providers: {
      github: createGitHubOAuthProvider({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      }),
    },
  },
})

export let { auth, getUser } = createAuthMiddleware(authClient)
```

```ts
// app/router.ts
import { createRouter } from '@remix-run/fetch-router'
import { session } from '@remix-run/session-middleware'
import { sessionCookie, sessionStorage, auth, getUser } from './utils/auth.ts'

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage), auth],
})

router.get('/', () => {
  let user = getUser()
  return new Response(user ? `Hi, ${user.name}!` : 'Welcome, guest!')
})

router.get('/profile', ({ url }) => {
  let user = getUser()
  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/login?returnTo=${url.pathname}` },
    })
  }
  return new Response(`Profile: ${user.email}`)
})

export { router }
```

## Related Packages

- [`@remix-run/auth`](../auth) - Authentication library
- [`@remix-run/fetch-router`](../fetch-router) - Web standards router
- [`@remix-run/session-middleware`](../session-middleware) - Session middleware
- [`@remix-run/session`](../session) - Session management

## License

MIT
