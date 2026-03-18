# auth-middleware

Request-time authentication and route protection for Remix. Use this package to resolve identity into `context.get(Auth)` from sessions, bearer tokens, API keys, or your own schemes. Pair it with [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth) when you need browser login routes and provider callbacks that write the session auth record in the first place.

## Features

- **Request auth resolution** - Load the current auth state into `context.get(Auth)` without mutating request objects
- **Route protection** - Enforce authenticated routes with `requireAuth()` and configurable failure behavior
- **Built-in auth schemes** - Start with session, bearer token, or API key auth, or provide your own `AuthScheme`
- **Ordered fallback** - Try multiple schemes in a defined order and stop on the first success or failure
- **Public and private route support** - Use the same resolved auth state for optional auth, APIs, and browser routes
- **Designed to pair with browser login** - Read the auth record that `remix/auth` or another login flow persisted earlier

## Installation

```sh
npm i remix
```

## Usage

The following example shows the request-time half of a session-backed browser login flow:

- another part of the app has already written `{ userId }` into the session
- `remix/auth-middleware` reads that value, resolves the current user, and protects the dashboard route

```ts
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'
import { session } from 'remix/session-middleware'

let routes = route({
  app: {
    dashboard: '/dashboard',
  },
})

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        createSessionAuthScheme({
          read(session) {
            return session.get('auth') as { userId: string } | null
          },
          verify(value) {
            return users.getById(value.userId)
          },
          invalidate(session) {
            session.unset('auth')
          },
        }),
      ],
    }),
  ],
})

router.get(routes.app.dashboard, {
  middleware: [requireAuth()],
  action({ get }) {
    let auth = get(Auth)

    if (!auth.ok) {
      throw new Error('Expected an authenticated session.')
    }

    return Response.json({
      id: auth.identity.id,
      email: auth.identity.email,
      method: auth.method,
    })
  },
})
```

In this example, `createSessionAuthScheme()` turns a persisted session auth record back into request auth state, `auth()` stores that state at `context.get(Auth)`, and `requireAuth()` rejects anonymous requests.

If you need to create the login route, start an OAuth redirect, finish a provider callback, or write the session auth record in the first place, use [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth).

## Auth State

`auth({ schemes })` does one thing: it resolves request auth state and stores it at `context.get(Auth)`. It does not start login flows, talk to external providers, or write login state into the session.

- it runs schemes in order
- `null` or `undefined` means "this scheme does not apply"
- `{ status: 'success', identity }` stops evaluation and stores `{ ok: true, identity, method }`
- `{ status: 'failure', ... }` stops evaluation and stores `{ ok: false, error }`
- if every scheme skips, the request continues with `{ ok: false }`

`auth()` does not reject the request when authentication fails. That job belongs to `requireAuth()`. This separation is intentional so the same auth resolution can support public routes, API routes, and browser routes with different failure behavior.

## Auth Schemes

An `AuthScheme` is any object with a `name` and an `authenticate(context)` method.
This package ships with three built-in auth schemes:

- `createBearerTokenAuthScheme()` for bearer tokens in the [HTTP `Authorization` header](https://datatracker.ietf.org/doc/html/rfc6750#section-2.1)
- `createAPIAuthScheme()` for API keys in a custom request header
- `createSessionAuthScheme()` for session-backed auth loaded by [a `session()` middleware](https://github.com/remix-run/remix/tree/main/packages/session-middleware)

If none of those match your environment, you can create your own auth scheme easily. A custom scheme usually wraps one auth mechanism behind a small `create*` factory function and returns an `AuthScheme`. For example, apps behind a trusted access proxy can authenticate requests from forwarded identity headers instead of sessions or bearer tokens.

```ts
import type { RequestContext } from 'remix/fetch-router'
import type { AuthScheme } from 'remix/auth-middleware'

type User = {
  id: string
  role: 'admin' | 'user'
}

function createTrustedProxyAuthScheme(): AuthScheme<User> {
  return {
    name: 'trusted-proxy',
    async authenticate(context: RequestContext) {
      let email = context.headers.get('X-Forwarded-Email')

      if (email == null) {
        return
      }

      let user = await users.getByEmail(email)

      if (user == null) {
        return {
          status: 'failure',
          code: 'invalid_credentials',
          message: 'Unknown forwarded user',
        }
      }

      return {
        status: 'success',
        identity: user,
      }
    },
  }
}
```

Only use a scheme like this when the app is reachable exclusively through infrastructure you trust to set those headers.

`authenticate(context)` can return:

- `null`, `undefined`, or no return value to skip this scheme
- `{ status: 'success', identity }` to authenticate the request
- `{ status: 'failure', code?, message?, challenge? }` to stop with an auth error

The scheme `name` becomes `auth.method` when authentication succeeds.

## Built-In Auth Schemes

The built-in helpers all return `AuthScheme` objects. Use them directly, mix them together in fallback order, or combine them with your own custom schemes.

### Bearer Tokens

Use `createBearerTokenAuthScheme()` for APIs that authenticate requests with `Authorization: Bearer <token>`.

```ts
import { auth, createBearerTokenAuthScheme } from 'remix/auth-middleware'

let router = createRouter({
  middleware: [
    auth({
      schemes: [
        createBearerTokenAuthScheme({
          async verify(token) {
            return usersByToken.get(token) ?? null
          },
        }),
      ],
    }),
  ],
})
```

### API Keys

Use `createAPIAuthScheme()` for integrations that send a key in a header such as `X-API-Key`.

```ts
import { auth, createAPIAuthScheme } from 'remix/auth-middleware'

let router = createRouter({
  middleware: [
    auth({
      schemes: [
        createAPIAuthScheme({
          async verify(key) {
            return servicesByKey.get(key) ?? null
          },
        }),
      ],
    }),
  ],
})
```

### Session-Backed Auth

Use `createSessionAuthScheme()` when another part of the app has already written a small auth record into the session and you want normal requests to resolve that back into the current user.

```ts
import { auth, createSessionAuthScheme } from 'remix/auth-middleware'
import { session } from 'remix/session-middleware'

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        createSessionAuthScheme({
          read(session) {
            return session.get('auth') as { userId: string } | null
          },
          async verify(value) {
            return users.getById(value.userId)
          },
          invalidate(session) {
            session.unset('auth')
          },
        }),
      ],
    }),
  ],
})
```

This is the scheme to use with [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth) or any other login flow that persists a session auth record.

## Route Protection

Use `requireAuth()` after `auth()` when a route must be authenticated.

- default behavior: `401 Unauthorized`
- `onFailure(context, auth)` lets you return JSON, redirects, or any custom response
- `status`, `body`, and `headers` let you customize the default unauthorized response
- bearer-style challenges are forwarded to `WWW-Authenticate` automatically when the auth failure included a `challenge`

If `requireAuth()` runs before `auth()`, it throws so the middleware order fails loudly instead of silently treating the request as anonymous.

## Detailed Multi-Mode Example

This single router demonstrates five auth modes.

```ts
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { redirect } from 'remix/response/redirect'
import {
  auth,
  Auth,
  createAPIAuthScheme,
  createBearerTokenAuthScheme,
  requireAuth,
} from 'remix/auth-middleware'

let routes = route({
  home: '/',
  auth: {
    login: '/login',
  },
  api: {
    profile: '/api/profile',
    integrations: '/api/integrations',
    bearerOnly: '/api/bearer-only',
    apiKeyOnly: '/api/api-key-only',
  },
  app: {
    dashboard: '/dashboard',
  },
})

let usersByToken = new Map([
  ['token_admin', { id: 'u1', role: 'admin' }],
  ['token_user', { id: 'u2', role: 'user' }],
])

let servicesByKey = new Map([
  ['key_payments', { id: 'svc-payments', scope: 'payments:read' }],
  ['key_analytics', { id: 'svc-analytics', scope: 'analytics:read' }],
])

let bearerScheme = createBearerTokenAuthScheme({
  verify(token) {
    return usersByToken.get(token) ?? null
  },
  challenge: 'Bearer realm="example"',
})

let apiKeyScheme = createAPIAuthScheme({
  verify(key) {
    return servicesByKey.get(key) ?? null
  },
})

let router = createRouter({
  middleware: [
    // Mode D: scheme fallback (Bearer first, API key second)
    auth({
      schemes: [bearerScheme, apiKeyScheme],
    }),
  ],
})

// Mode A: public route with optional auth
router.get(routes.home, ({ get }) => {
  let auth = get(Auth)

  if (auth.ok) {
    return new Response(`Welcome back via ${auth.method}`)
  }

  return new Response('Welcome, guest')
})

// Mode B: strict API auth with JSON error response
router.map(routes.api.profile, {
  middleware: [
    requireAuth({
      onFailure(_context, auth) {
        return Response.json(
          {
            error: auth.error?.message ?? 'Unauthorized',
            code: auth.error?.code ?? 'missing_credentials',
          },
          { status: 401 },
        )
      },
    }),
  ],
  action({ get }) {
    let auth = get(Auth)

    return Response.json({
      authenticatedWith: auth.ok ? auth.method : null,
      identity: auth.ok ? auth.identity : null,
    })
  },
})

// Another API endpoint using default 401 behavior
router.map(routes.api.integrations, {
  middleware: [requireAuth()],
  action({ get }) {
    let auth = get(Auth)

    return Response.json({
      identity: auth.ok ? auth.identity : null,
    })
  },
})

// Mode C: browser redirect for unauthenticated users
router.map(routes.app.dashboard, {
  middleware: [
    requireAuth({
      onFailure(context) {
        let returnTo = context.url.pathname + context.url.search
        return redirect(routes.auth.login.href(undefined, { returnTo }))
      },
    }),
  ],
  action({ get }) {
    let auth = get(Auth)

    if (!auth.ok) {
      throw new Error('Expected ok auth state after requireAuth()')
    }

    return new Response(`Dashboard for ${JSON.stringify(auth.identity)}`)
  },
})

// Mode E: route-level auth profile differences
router.map(routes.api.bearerOnly, {
  middleware: [auth({ schemes: [bearerScheme] }), requireAuth()],
  action({ get }) {
    let auth = get(Auth)

    return Response.json({
      mode: 'bearer-only',
      method: auth.ok ? auth.method : null,
    })
  },
})

router.map(routes.api.apiKeyOnly, {
  middleware: [auth({ schemes: [apiKeyScheme] }), requireAuth()],
  action({ get }) {
    let auth = get(Auth)

    return Response.json({
      mode: 'api-key-only',
      method: auth.ok ? auth.method : null,
    })
  },
})
```

### How to Choose a Mode

- Use **Mode A (optional auth)** for public pages that can personalize for signed-in users
- Use **Mode B (strict API + JSON failures)** for machine clients and API integrations
- Use **Mode C (redirect failures)** for browser pages that require login
- Use **Mode D (fallback order)** when clients may authenticate in different ways
- Use **Mode E (route-specific profiles)** when some endpoints must enforce a single scheme

## Built-In Schemes

### `createBearerTokenAuthScheme(options)`

Reads tokens from `Authorization` (default) using the `Bearer <token>` format.

Options:

- `verify(token, context)` (required)
- `name` (default: `'bearer'`)
- `headerName` (default: `'Authorization'`)
- `scheme` (default: `'Bearer'`)
- `challenge` (default: same as `scheme`)

### `createAPIAuthScheme(options)`

Reads API keys from `X-API-Key` (default).

Options:

- `verify(key, context)` (required)
- `name` (default: `'api-key'`)
- `headerName` (default: `'X-API-Key'`)

### `createSessionAuthScheme(options)`

Reads an auth record from `context.get(Session)` and resolves the full request identity.

```ts
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { auth, Auth, requireAuth, createSessionAuthScheme } from 'remix/auth-middleware'
import { session } from 'remix/session-middleware'

let routes = route({
  app: {
    dashboard: '/dashboard',
  },
})

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        createSessionAuthScheme({
          read(session) {
            return session.get('auth') as { userId: string } | null
          },
          verify(value) {
            return users.getById(value.userId)
          },
          invalidate(session) {
            session.unset('auth')
          },
        }),
      ],
    }),
  ],
})

router.get(routes.app.dashboard, {
  middleware: [requireAuth()],
  action({ get }) {
    let auth = get(Auth)
    let session = get(Session)

    return Response.json({
      auth,
      sessionUserId: session.get('auth')?.userId ?? null,
    })
  },
})
```

Options:

- `read(session, context)` (required)
- `verify(value, context)` (required)
- `invalidate(session, context)`
- `name` (default: `'session'`)
- `code` (default: `'invalid_credentials'`)
- `message` (default: `'Invalid session'`)

Behavior:

- `read()` returning `null` or `undefined` skips the scheme
- `verify()` returning an identity authenticates the request
- `verify()` returning `null` fails auth and can optionally trigger `invalidate()`
- `session()` middleware must run before `createSessionAuthScheme()`

If you want session-backed browser login flows, pair `createSessionAuthScheme()` with [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth). That package covers generic OIDC, thin wrappers like Google/Microsoft/Okta/Auth0, custom GitHub/Facebook/X OAuth helpers, and credentials-based login.

## Related Packages

- [`auth`](https://github.com/remix-run/remix/tree/main/packages/auth) - Browser login helpers for OIDC, custom OAuth providers, and credentials flows
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and middleware runtime
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Response helpers like redirects

## Related Work

- [HTTP Authentication Framework](https://datatracker.ietf.org/doc/html/rfc7235)
- [OAuth 2.0 Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
