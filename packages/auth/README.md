# auth

Browser login, OAuth, and OIDC helpers for Remix. This package handles provider redirects, callback validation, and session-backed login flows for standards-based identity providers, common social providers, and email/password authentication.

## Features

- **OIDC Core + Wrappers** - Use `oidc()` directly or `google()`, `microsoft()`, `okta()`, and `auth0()` as thin wrappers
- **OAuth Provider Helpers** - Use `github()` and `facebook()` for common browser login flows that need custom provider logic
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
import { form, route } from 'remix/fetch-router/routes'
import { auth, Auth, requireAuth, sessionAuth } from 'remix/auth-middleware'
import { callback, credentials, google, login } from 'remix/auth'
import { formData } from 'remix/form-data-middleware'
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

let routes = route({
  home: '/',
  auth: {
    google: {
      login: '/login/google',
      callback: '/auth/google/callback',
    },
    session: {
      login: form('/login'),
      logout: { method: 'POST', pattern: '/logout' },
    },
  },
  app: {
    dashboard: '/dashboard',
  },
})

let googleProvider = google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), env.APP_ORIGIN),
})

let passwordProvider = credentials({
  parse(context) {
    let formData = context.get(FormData)
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
    formData(),
    auth({
      schemes: [
        sessionAuth({
          read(session) {
            return session.get('auth') as { subjectId: string } | null
          },
          verify(value) {
            return users.getById(value.subjectId)
          },
          invalidate(session) {
            session.unset('auth')
          },
        }),
      ],
    }),
  ],
})

router.get(routes.auth.session.login.index, () => {
  return new Response('Login page')
})

router.get(routes.auth.google.login, login(googleProvider))

router.get(
  routes.auth.google.callback,
  callback(googleProvider, {
    async createSessionAuth(result) {
      let user = await users.upsertFromGoogle(result.profile)
      return { subjectId: user.id }
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
)

router.post(routes.auth.session.login.action, {
  middleware: [formData()],
  action: login(passwordProvider, {
    async createSessionAuth(user) {
      return { subjectId: user.id }
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
})

router.post(routes.auth.session.logout, ({ get }) => {
  let session = get(Session)
  session.unset('auth')
  session.regenerateId()
  return new Response(null, {
    status: 302,
    headers: { Location: routes.home.href() },
  })
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
      method: auth.scheme,
    })
  },
})
```

This package writes an auth record to `context.get(Session)` by default:

- OAuth and credentials logins store app-defined session data under `auth`
- OAuth transactions use the internal `__auth` session key
- `sessionAuth()` can read that data and resolve the full request identity into `context.get(Auth)`
- credentials examples assume `formData()` middleware runs before `login(credentials(...))`

## OIDC Providers

Use `oidc()` for any standards-compliant OpenID Connect provider. The `google()`, `microsoft()`, `okta()`, and `auth0()` helpers are thin wrappers on top of the same OIDC runtime.

```ts
import { auth0, login, microsoft, oidc, okta } from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    company: {
      login: '/login/company',
      callback: '/auth/company/callback',
    },
    microsoft: {
      login: '/login/microsoft',
      callback: '/auth/microsoft/callback',
    },
    okta: {
      login: '/login/okta',
      callback: '/auth/okta/callback',
    },
    auth0: {
      login: '/login/auth0',
      callback: '/auth/auth0/callback',
    },
  },
})

let companyProvider = oidc({
  name: 'company-sso',
  issuer: env.OIDC_ISSUER,
  clientId: env.OIDC_CLIENT_ID,
  clientSecret: env.OIDC_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.company.callback.href(), env.APP_ORIGIN),
  authorizationParams: {
    prompt: 'login',
  },
})

let microsoftProvider = microsoft({
  tenant: 'organizations',
  clientId: env.MICROSOFT_CLIENT_ID,
  clientSecret: env.MICROSOFT_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.microsoft.callback.href(), env.APP_ORIGIN),
})

let oktaProvider = okta({
  issuer: env.OKTA_ISSUER,
  clientId: env.OKTA_CLIENT_ID,
  clientSecret: env.OKTA_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.okta.callback.href(), env.APP_ORIGIN),
})

let auth0Provider = auth0({
  domain: env.AUTH0_DOMAIN,
  clientId: env.AUTH0_CLIENT_ID,
  clientSecret: env.AUTH0_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.auth0.callback.href(), env.APP_ORIGIN),
})

router.get(routes.auth.company.login, login(companyProvider))
router.get(routes.auth.microsoft.login, login(microsoftProvider))
router.get(routes.auth.okta.login, login(oktaProvider))
router.get(routes.auth.auth0.login, login(auth0Provider))
```

Notes:

- `oidc()` uses OIDC discovery by default at `/.well-known/openid-configuration`
- pass `metadata` when you want to skip discovery or `discoveryUrl` when the metadata document lives elsewhere
- default OIDC scopes are `openid profile email`
- wrappers only fill in provider-specific defaults and names; they do not use a separate auth model

## OAuth Providers

Use the built-in provider helpers when you want a standard browser redirect flow.

```ts
import { facebook, github, google, login } from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    google: {
      login: '/login/google',
      callback: '/auth/google/callback',
    },
    github: {
      login: '/login/github',
      callback: '/auth/github/callback',
    },
    facebook: {
      login: '/login/facebook',
      callback: '/auth/facebook/callback',
    },
  },
})

let googleProvider = google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), env.APP_ORIGIN),
})

let githubProvider = github({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.github.callback.href(), env.APP_ORIGIN),
})

let facebookProvider = facebook({
  clientId: env.FACEBOOK_CLIENT_ID,
  clientSecret: env.FACEBOOK_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.facebook.callback.href(), env.APP_ORIGIN),
})

router.get(routes.auth.google.login, login(googleProvider))
router.get(routes.auth.github.login, login(githubProvider))
router.get(routes.auth.facebook.login, login(facebookProvider))
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
import { formData } from 'remix/form-data-middleware'
import { form, route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    session: {
      login: form('/login'),
    },
  },
})

let passwordProvider = credentials({
  parse(context) {
    let formData = context.get(FormData)
    return {
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    }
  },
  verify({ email, password }) {
    return users.verifyPassword(email, password)
  },
})

router.post(routes.auth.session.login.action, {
  middleware: [formData()],
  action: login(passwordProvider, {
    async createSessionAuth(user) {
      return { subjectId: user.id }
    },
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
})
```

`createSessionAuth(result, context)` gives you one place to normalize every successful login into whatever session record shape your app wants to persist.

## Callback Handling

Use `callback()` on the provider callback route to validate the stored transaction, exchange the authorization code, fetch the provider profile, and persist the session auth record.

```ts
import { callback, github } from 'remix/auth'
import { form, route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    github: {
      callback: '/auth/github/callback',
    },
    session: {
      login: form('/login'),
    },
  },
  app: {
    dashboard: '/dashboard',
  },
})

let githubProvider = github({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.github.callback.href(), env.APP_ORIGIN),
})

router.get(
  routes.auth.github.callback,
  callback(githubProvider, {
    async createSessionAuth(result) {
      let user = await users.upsertFromGitHub(result.profile)
      return { subjectId: user.id }
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
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
            return session.get('auth') as { subjectId: string } | null
          },
          verify(value) {
            return users.getById(value.subjectId)
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
