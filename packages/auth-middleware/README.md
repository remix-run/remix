# auth-middleware

Pluggable authentication middleware for Remix. It resolves identity into request context using `Auth`, supports multiple auth schemes, and lets you enforce authentication with configurable failure behavior. Use [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth) for browser login flows; this package is the request-time half that loads auth state and protects routes.

## Features

- **Pluggable Schemes** - Use built-ins or provide your own `AuthScheme`
- **Multiple Auth Modes** - Optional auth, strict API auth, redirect-based browser auth
- **Ordered Fallback** - Try Bearer first, then API key (or any order you choose)
- **Explicit Request State** - Read auth state from `context.get(Auth)` instead of mutating request context objects
- **Session Bridge** - Use `sessionAuth()` to convert session data into request auth state
- **Composable Middleware** - Use globally or per-route

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { auth, Auth, bearer, requireAuth } from 'remix/auth-middleware'

let routes = route({
  private: '/private',
})

let router = createRouter({
  middleware: [
    auth({
      schemes: [
        bearer({
          async verify(token) {
            if (token === 'token-123') {
              return { id: 'u1', role: 'user' }
            }

            return null
          },
        }),
      ],
    }),
  ],
})

router.map(routes.private, {
  middleware: [requireAuth()],
  action(context) {
    let auth = context.get(Auth)

    return Response.json({
      userId: auth.ok ? auth.identity.id : null,
    })
  },
})
```

`auth()` resolves auth state and stores it at `context.get(Auth)`:

- `{ ok: true, identity, method }`
- `{ ok: false, error? }`

When implementing custom schemes, return `null`, `undefined`, or no value from `authenticate()` to skip that scheme.

`requireAuth()` enforces authentication and returns `401 Unauthorized` by default.

## Auth State

`auth({ schemes })` does one thing: it resolves request auth state and stores it at `context.get(Auth)`.

- it runs schemes in order
- `null` or `undefined` means "this scheme does not apply"
- `{ status: 'success', identity }` stops evaluation and stores `{ ok: true, identity, method }`
- `{ status: 'failure', ... }` stops evaluation and stores `{ ok: false, error }`
- if every scheme skips, the request continues with `{ ok: false }`

`auth()` does not reject the request by itself. That separation is intentional so the same auth resolution can support public routes, API routes, and browser routes with different failure behavior.

## Auth Scheme API

An auth scheme is any object with a `name` and an `authenticate(context)` method.
The built-in `bearer()` and `apiKey()` helpers just create objects with this shape.

```ts
import type { RequestContext } from 'remix/fetch-router'
import type { AuthScheme } from 'remix/auth-middleware'

type User = {
  id: string
  role: 'admin' | 'user'
}

let sessionScheme: AuthScheme<User, 'session'> = {
  name: 'session',
  async authenticate(context: RequestContext) {
    let sessionId = readSessionId(context.headers.get('Cookie'))

    if (sessionId == null) {
      return
    }

    let user = await findUserBySessionId(sessionId)

    if (user == null) {
      return {
        status: 'failure',
        code: 'invalid_credentials',
        message: 'Invalid session',
      }
    }

    return {
      status: 'success',
      identity: user,
    }
  },
}
```

`authenticate(context)` can return:

- `null`, `undefined`, or no return value to skip this scheme
- `{ status: 'success', identity }` to authenticate the request
- `{ status: 'failure', code?, message?, challenge? }` to stop with an auth error

The scheme `name` becomes `auth.method` when authentication succeeds.

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
import { auth, apiKey, Auth, bearer, requireAuth } from 'remix/auth-middleware'

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

let bearerScheme = bearer({
  verify(token) {
    return usersByToken.get(token) ?? null
  },
  challenge: 'Bearer realm="example"',
})

let apiKeyScheme = apiKey({
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

### `bearer(options)`

Reads tokens from `Authorization` (default) using the `Bearer <token>` format.

Options:

- `verify(token, context)` (required)
- `name` (default: `'bearer'`)
- `headerName` (default: `'Authorization'`)
- `scheme` (default: `'Bearer'`)
- `challenge` (default: same as `scheme`)

### `apiKey(options)`

Reads API keys from `X-API-Key` (default).

Options:

- `verify(key, context)` (required)
- `name` (default: `'api-key'`)
- `headerName` (default: `'X-API-Key'`)

### `sessionAuth(options)`

Reads an auth record from `context.get(Session)` and resolves the full request identity.

```ts
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import { auth, Auth, requireAuth, sessionAuth } from 'remix/auth-middleware'
import { Session } from 'remix/session'
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
        sessionAuth({
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
- `session()` middleware must run before `sessionAuth()`

If you want session-backed browser login flows, pair `sessionAuth()` with [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth). That package covers generic OIDC, thin wrappers like Google/Microsoft/Okta/Auth0, custom GitHub/Facebook OAuth helpers, and credentials-based login.

## Related Packages

- [`auth`](https://github.com/remix-run/remix/tree/main/packages/auth) - Browser login helpers for OIDC, custom OAuth providers, and credentials flows
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and middleware runtime
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Response helpers like redirects

## Related Work

- [HTTP Authentication Framework](https://datatracker.ietf.org/doc/html/rfc7235)
- [OAuth 2.0 Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
