# auth

Browser login and OAuth helpers for Remix. This package handles provider redirects, callback validation, and session-backed login flows for Google, GitHub, Facebook, and email/password authentication.

## Features

- **OAuth Provider Helpers** - Use `google()`, `github()`, and `facebook()` for common browser login flows
- **Credentials Login** - Add email/password authentication with the same session contract as OAuth
- **Route Handler Factories** - Use `login()` and `callback()` to wire browser auth routes without repeating protocol code
- **Session-First Design** - Store a small auth record in the session and load the full identity with `sessionAuth()`

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { auth, Auth, requireAuth, sessionAuth } from 'remix/auth-middleware'
import { callback, credentials, google, login } from 'remix/auth'
import { Session } from 'remix/session'
import { session } from 'remix/session-middleware'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let sessionCookie = createCookie('__session', {
  secrets: [env.SESSION_SECRET],
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
})

let sessionStorage = createCookieSessionStorage()

let googleProvider = google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'https://app.example.com/auth/google/callback',
})

let passwordProvider = credentials({
  async parse(context) {
    let formData = await context.request.formData()

    return {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    }
  },
  verify({ email, password }) {
    return users.verifyPassword(email, password)
  },
})

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        sessionAuth({
          read(session) {
            return session.get('auth') as { userId: string; method: string } | null
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

router.get('/login/google', login(googleProvider))

router.get(
  '/auth/google/callback',
  callback(googleProvider, {
    async createSessionAuth(result) {
      let user = await users.upsertFromGoogle(result.profile)
      return { userId: user.id, method: 'google' as const }
    },
  }),
)

router.post(
  '/login',
  login(passwordProvider, {
    async createSessionAuth(user) {
      return { userId: user.id, method: 'password' as const }
    },
    successRedirectTo: '/dashboard',
    failureRedirectTo: '/login',
  }),
)

router.post('/logout', ({ get }) => {
  let session = get(Session)
  session.unset('auth')
  session.regenerateId()
  return new Response(null, {
    status: 302,
    headers: { Location: '/' },
  })
})

router.get('/dashboard', {
  middleware: [requireAuth()],
  action({ get }) {
    let auth = get(Auth)

    if (!auth.ok) {
      throw new Error('Expected an authenticated session.')
    }

    return Response.json({
      id: auth.identity.id,
      email: auth.identity.email,
      method: auth.scheme,
    })
  },
})
```

This package writes an auth record to `context.get(Session)` by default:

- OAuth and credentials logins store session data under `auth`
- OAuth transactions use the internal `__auth` session key
- `sessionAuth()` can read that data and resolve the full request identity into `context.get(Auth)`

## OAuth Providers

Use the built-in provider helpers when you want a standard browser redirect flow.

```ts
import { facebook, github, google, login } from 'remix/auth'

let googleProvider = google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'https://app.example.com/auth/google/callback',
})

let githubProvider = github({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: 'https://app.example.com/auth/github/callback',
})

let facebookProvider = facebook({
  clientId: env.FACEBOOK_CLIENT_ID,
  clientSecret: env.FACEBOOK_CLIENT_SECRET,
  redirectUri: 'https://app.example.com/auth/facebook/callback',
})

router.get('/login/google', login(googleProvider))
router.get('/login/github', login(githubProvider))
router.get('/login/facebook', login(facebookProvider))
```

Default scopes:

- Google: `openid email profile`
- GitHub: `read:user user:email`
- Facebook: `public_profile email`

Pass `scopes` if you need a different set for a provider.

## Credentials Login

Use `credentials()` when you want email/password or some other direct form-based authentication.

```ts
import { credentials, login } from 'remix/auth'

let passwordProvider = credentials({
  async parse(context) {
    let formData = await context.request.formData()
    return {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    }
  },
  verify({ email, password }) {
    return users.verifyPassword(email, password)
  },
})

router.post(
  '/login',
  login(passwordProvider, {
    async createSessionAuth(user) {
      return { userId: user.id, method: 'password' as const }
    },
    failureRedirectTo: '/login',
  }),
)
```

`createSessionAuth(result, context)` gives you one place to normalize every successful login into the same session record shape.

## Callback Handling

Use `callback()` on the provider callback route to validate the stored transaction, exchange the authorization code, fetch the provider profile, and persist the session auth record.

```ts
import { callback, github } from 'remix/auth'

let githubProvider = github({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: 'https://app.example.com/auth/github/callback',
})

router.get(
  '/auth/github/callback',
  callback(githubProvider, {
    async createSessionAuth(result) {
      let user = await users.upsertFromGitHub(result.profile)
      return { userId: user.id, method: 'github' as const }
    },
    successRedirectTo: '/dashboard',
    failureRedirectTo: '/login',
  }),
)
```

`callback()` exposes the normalized provider result to `createSessionAuth()` and `onSuccess()`, including:

- `result.provider`
- `result.account`
- `result.profile`
- `result.tokens`

## Session Integration

This package is designed to be paired with `remix/session-middleware` and `remix/auth-middleware`.

```ts
import { auth, sessionAuth } from 'remix/auth-middleware'
import { session } from 'remix/session-middleware'

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    auth({
      schemes: [
        sessionAuth({
          read(session) {
            return session.get('auth') as { userId: string; method: string } | null
          },
          verify(value) {
            return users.getById(value.userId)
          },
        }),
      ],
    }),
  ],
})
```

This keeps login mechanics separate from request authentication:

- `remix/auth` creates and persists the session auth record
- `sessionAuth()` converts that session record into `context.get(Auth)`
- `requireAuth()` protects routes that require a signed-in user

## Related Packages

- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Request authentication and route protection helpers
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Request-scoped session loading and persistence
- [`session`](https://github.com/remix-run/remix/tree/main/packages/session) - Session data model and storage backends
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and middleware runtime

## Related Work

- [OAuth 2.0](https://oauth.net/2/)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
