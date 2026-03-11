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
    let user = users.verifyPassword(email, password)
    return user
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

router.get(routes.auth.session.login.index, () => {
  return new Response('Login page')
})

router.get(routes.auth.google.login, login(googleProvider))

router.get(
  routes.auth.google.callback,
  callback(googleProvider, {
    async writeSession(session, result) {
      let user = await users.upsertFromGoogle(result.profile)
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
)

router.post(routes.auth.session.login.action, {
  middleware: [formData()],
  action: login(passwordProvider, {
    async writeSession(session, user) {
      session.set('auth', { userId: user.id })
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

This package manages the OAuth transaction in `context.get(Session)` and lets your app decide what authenticated session data to persist:

- `login()` and `callback()` store the OAuth transaction under `__auth`
- your `writeSession(session, result, context)` hook writes app-defined auth data, often under `auth`
- `sessionAuth()` can read that data and resolve the full request identity into `context.get(Auth)`
- credentials examples assume `formData()` middleware runs before `login(credentials(...))`
- examples store `{ userId }` instead of the whole user object to keep session data small and avoid stale user records, especially with cookie-backed sessions

## Built-In Providers

- `oidc()`:
  - Use this for any standards-compliant OpenID Connect provider
  - Options: `issuer`, `clientId`, `clientSecret`, `redirectUri`, optional `scopes`, `discoveryUrl`, `metadata`, `authorizationParams`, and `mapProfile()`
  - `writeSession(session, result)` receives `result.profile` as `OIDCProfile` by default, or your mapped profile type when you provide `mapProfile()`
- `google()`:
  - Thin OIDC wrapper with Google's published authorization, token, and userinfo endpoints
  - Options: `clientId`, `clientSecret`, `redirectUri`, optional `scopes`
  - `result.profile` is `GoogleProfile`, which follows the standard OIDC userinfo shape and typically includes `sub`, `email`, `email_verified`, `name`, `given_name`, `family_name`, `picture`, and `locale`
- `microsoft()`:
  - Thin OIDC wrapper for Microsoft identity
  - Options: `tenant`, `clientId`, `clientSecret`, `redirectUri`, plus the generic OIDC options other than `name` and `issuer`
  - `tenant` defaults to `'common'`; use `'organizations'`, `'consumers'`, or a specific tenant ID when you want a narrower audience
  - `result.profile` is `MicrosoftProfile`, which extends OIDC claims with fields like `tid`, `oid`, and `preferred_username`
- `okta()`:
  - Thin OIDC wrapper for Okta
  - Options: `issuer`, `clientId`, `clientSecret`, `redirectUri`, plus optional generic OIDC settings like `scopes` or `authorizationParams`
  - `result.profile` is `OktaProfile`, which is the standard OIDC claim shape for your Okta issuer
- `auth0()`:
  - Thin OIDC wrapper for Auth0
  - Options: `domain`, `clientId`, `clientSecret`, `redirectUri`, plus optional generic OIDC settings like `scopes` or `authorizationParams`
  - `domain` is normalized into the Auth0 issuer URL automatically
  - `result.profile` is `Auth0Profile`, which is the standard OIDC claim shape plus fields like `nickname` and `updated_at`
- `github()`:
  - Custom OAuth helper for GitHub's OAuth app flow
  - Options: `clientId`, `clientSecret`, `redirectUri`, optional `scopes`
  - `result.profile` is `GitHubProfile`, including `id`, `login`, `name`, `email`, `avatar_url`, and `html_url`
  - if GitHub does not return an email in `/user`, the provider automatically loads `/user/emails` and hydrates `result.profile.email` when possible
- `facebook()`:
  - Custom OAuth helper for Facebook Login
  - Options: `clientId`, `clientSecret`, `redirectUri`, optional `scopes`
  - `result.profile` is `FacebookProfile`, including `id`, `name`, `email`, and `picture`
- `credentials()`:
  - Form-based authentication helper for email/password or any other direct credential flow
  - Options: `parse(context)` and `verify(input, context)`
  - `writeSession(session, result)` receives whatever `verify()` returns on success, so the type is fully application-defined

## OIDC Providers

Use `oidc()` for any standards-compliant OpenID Connect provider. The `google()`, `microsoft()`, `okta()`, and `auth0()` helpers are thin wrappers on top of the same OIDC runtime.

```ts
import { auth0, google, login, microsoft, oidc, okta } from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    google: {
      login: '/login/google',
      callback: '/auth/google/callback',
    },
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

let googleProvider = google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), env.APP_ORIGIN),
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

router.get(routes.auth.google.login, login(googleProvider))
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
- `google()` uses the same OIDC runtime with Google's published endpoints wired in directly, so it does not need a discovery request
- `microsoft()` adds the `tenant` option and builds the issuer from it
- `okta()` expects the full Okta issuer URL, usually something like `https://example.okta.com/oauth2/default`
- `auth0()` expects your Auth0 domain and derives the issuer URL for you
- use `mapProfile()` with `oidc()` when you want `result.profile` to have an app-specific type before it reaches `writeSession()`

## Custom OAuth Providers

Use the built-in provider helpers when you want a standard browser redirect flow for providers that need behavior beyond the generic OIDC runtime.

```ts
import { facebook, github, login } from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
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

router.get(routes.auth.github.login, login(githubProvider))
router.get(routes.auth.facebook.login, login(facebookProvider))
```

Default scopes:

- GitHub: `read:user user:email`
- Facebook: `public_profile email`

Pass `scopes` if you need a different set for a provider.

Provider notes:

- `github()` may issue a second API request to `/user/emails` when the primary profile payload does not include an email address
- `facebook()` fetches a fixed profile shape from `https://graph.facebook.com/me?fields=id,name,email,picture`
- both helpers expose normalized results through `result.account`, `result.profile`, and `result.tokens` in `writeSession()` and `onSuccess()`

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
  app: {
    dashboard: '/dashboard',
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
    let user = users.verifyPassword(email, password)
    return user
  },
})

router.post(routes.auth.session.login.action, {
  middleware: [formData()],
  action: login(passwordProvider, {
    async writeSession(session, user) {
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
})
```

In this example, `verify()` returns the authenticated user object or `null`. `login()` passes that user object to `writeSession(session, user, context)`, which is why the example can read `user.id` there and write it into the session directly.

`writeSession(session, result, context)` gives you one place to normalize every successful login into whatever session record shape your app wants to persist. In most apps that should be a small record like `{ userId }`, not the full user object.

## Session Lifecycle

The successful auth flow always follows the same order:

1. `login()` stores the OAuth transaction under `__auth` when you start an OAuth redirect flow
2. successful credentials login or OAuth callback rotates the session id
3. `writeSession(session, result, context)` writes your app-defined auth data
4. `onSuccess(result, context)` runs after the session write, if you provided it
5. otherwise the handler redirects to the resolved success location
6. `sessionAuth()` later reads the written session data and resolves request identity into `context.get(Auth)`

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
    async writeSession(session, result) {
      let user = await users.upsertFromGitHub(result.profile)
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
)
```

`callback()` exposes the normalized provider result to `writeSession()` and `onSuccess()`, including:

- `result.provider`
- `result.account`
- `result.profile`
- `result.tokens`

The `result.profile` shape depends on the provider:

- `oidc()` and wrappers built on it return OIDC userinfo claims
- `google()` returns `GoogleProfile`
- `microsoft()` returns `MicrosoftProfile`
- `okta()` returns `OktaProfile`
- `auth0()` returns `Auth0Profile`
- `github()` returns `GitHubProfile`
- `facebook()` returns `FacebookProfile`
- `credentials()` does not use `callback()`; its `writeSession()` hook receives whatever your `verify()` function returned

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
            return session.get('auth') as { userId: string } | null
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
