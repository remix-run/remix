# auth-middleware

Request-time authentication and route protection for Remix. Use this package to resolve identity into `context.get(Auth)` from sessions, bearer tokens, API keys, or your own schemes. Pair it with [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth) when you need browser login routes that call `verifyCredentials()` or `finishExternalAuth()`, then rotate the session id with `completeAuth()` before writing the auth record.

## Features

- Request auth resolution without mutating request objects
- Route protection with `requireAuth()` and configurable failure behavior
- Built-in auth schemes for sessions, bearer tokens, and API keys
- Ordered fallback across multiple auth schemes
- Public and private route support with the same resolved auth state
- Designed to pair with browser login flows that persist session auth records earlier in the request lifecycle

## Installation

```sh
npm i remix
```

## Usage

The following example shows the request-time half of a session-backed browser login flow:

- another part of the app has already called `completeAuth()` and written `{ userId }` into the returned session
- `remix/auth-middleware` reads that value, resolves the current user, and protects the dashboard route

```ts
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import type { GoodAuth } from 'remix/auth-middleware'
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
  handler(context) {
    let auth = context.get(Auth) as GoodAuth<{ id: string; email: string }>

    return Response.json({
      id: auth.identity.id,
      email: auth.identity.email,
      method: auth.method,
    })
  },
})
```

In this example, `createSessionAuthScheme()` turns a persisted session auth record back into request auth state, `auth()` stores that state at `context.get(Auth)`, and `requireAuth()` rejects anonymous requests.

If you need to create the login route, start an OAuth redirect, finish a provider callback, or write the session auth record in the first place, use [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth):

- `verifyCredentials()` for direct credentials flows
- `startExternalAuth()` and `finishExternalAuth()` for OAuth and OIDC flows
- `completeAuth()` to rotate the session id before writing the auth record that this package reads later

## Route Protection

This package includes two middlewares:

- `auth()` to resolve auth state and store it in `context.get(Auth)`
- `requireAuth()` to reject requests that aren't authenticated

That separation is intentional so the same auth resolution can support public routes, API routes, and browser routes with different failure behavior.

`auth()` resolves auth state and stores either `{ ok: true, identity, method }` or `{ ok: false, error? }` in `context.get(Auth)`.

Use `requireAuth()` after `auth()` when a route must be authenticated. If `auth()` did not run first, `requireAuth()` throws. Otherwise it returns `401 Unauthorized` by default, or you can replace that with `onFailure(context, auth)` to return JSON, redirects, or any other custom response.

Auth challenges are forwarded to `WWW-Authenticate` automatically when the auth failure included a `challenge`, so clients that honor those challenges can react without custom header handling.

## Auth Schemes

An `AuthScheme` is any object with a `name` and an `authenticate(context)` method. The `auth()` middleware tries each scheme in order until one returns a success or failure result. If no scheme returns success or failure, the request is treated as anonymous.

This package ships with three built-in auth schemes:

- `createBearerTokenAuthScheme()` for bearer tokens in the [HTTP `Authorization: Bearer <token>` header](https://datatracker.ietf.org/doc/html/rfc6750#section-2.1)
- `createAPIAuthScheme()` for API keys in a custom request header
- `createSessionAuthScheme()` for session-backed auth loaded by [a `session()` middleware](https://github.com/remix-run/remix/tree/main/packages/session-middleware)

## Custom Auth Schemes

If none of the built-in auth schemes match your environment, you can create your own auth scheme easily. A custom scheme usually wraps one auth mechanism behind a small `create*` factory function and returns an `AuthScheme`. For example, apps behind a trusted access proxy can authenticate requests from forwarded identity headers instead of sessions or bearer tokens.

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

Only use a scheme like this when the app is reachable exclusively through infrastructure you trust to set the headers you rely on. In this case, the `X-Forwarded-Email` header.

`authenticate(context)` can return:

- `null`, `undefined`, or no return value to skip this scheme
- `{ status: 'success', identity }` to authenticate the request
- `{ status: 'failure', code?, message?, challenge? }` to stop with an auth error

The scheme `name` becomes `auth.method` when authentication succeeds.

## Simple Auth Cookies

If your app already has an auth cookie and you do not need a session-backed identity lookup, you can use a small custom auth scheme and still rely on `requireAuth()` for route protection.

```ts
import { auth, requireAuth } from 'remix/auth-middleware'
import type { AuthScheme } from 'remix/auth-middleware'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { redirect } from 'remix/response/redirect'

let authCookie = createCookie('__auth', {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
})

let authCookieScheme: AuthScheme<'demo-user'> = {
  name: 'auth-cookie',
  async authenticate(context) {
    let value = await authCookie.parse(context.headers.get('cookie'))
    if (value !== '1') {
      return
    }

    return {
      status: 'success',
      identity: 'demo-user',
    }
  },
}

let requireAuthCookie = requireAuth<'demo-user'>({
  onFailure(context) {
    let isFrameRequest = context.request.headers.get('x-remix-frame') === 'true'
    if (isFrameRequest) {
      return new Response('<p>Not authorized</p>', {
        status: 401,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      })
    }

    return redirect('/login')
  },
})

let router = createRouter({
  middleware: [
    auth({
      schemes: [authCookieScheme],
    }),
  ],
})

router.get('/dashboard', {
  middleware: [requireAuthCookie],
  handler() {
    return new Response('ok')
  },
})
```

This pattern keeps the auth check app-owned. Use [`remix/session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) and [`remix/auth`](https://github.com/remix-run/remix/tree/main/packages/auth) when you need server-managed session data, credential verification helpers, or OAuth/OIDC flows.

## Related Packages

- [`auth`](https://github.com/remix-run/remix/tree/main/packages/auth) - Browser auth primitives for credentials, OAuth, and OIDC flows
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and middleware runtime
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Response helpers like redirects

## Related Work

- [HTTP Authentication Framework](https://datatracker.ietf.org/doc/html/rfc7235)
- [OAuth 2.0 Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
