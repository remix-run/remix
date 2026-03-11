# auth

Browser login, OAuth, and OIDC helpers for Remix. This package handles provider redirects, callback validation, and session-backed login flows for standards-based identity providers, common social providers, and email/password authentication.

## Features

- **OIDC Core + Wrappers** - Use `createOIDCAuthProvider()` directly or `createGoogleAuthProvider()`, `createMicrosoftAuthProvider()`, `createOktaAuthProvider()`, and `createAuth0AuthProvider()` as thin wrappers
- **OAuth Provider Helpers** - Use `createGitHubAuthProvider()` and `createFacebookAuthProvider()` for common browser login flows that need custom provider logic
- **Credentials Login** - Add email/password authentication with the same session contract as OAuth
- **Explicit Session Writes** - Use `writeSession(session, result, context)` to persist exactly the auth data your app needs
- **Request Handler Factories** - Use `login()` and `callback()` to build browser auth request handlers without repeating protocol code
- **Success and Failure Hooks** - Customize successful logins and failures with `onSuccess`, `onFailure`, `onError`, `successRedirectTo`, and `failureRedirectTo`
- **Session-First Design** - Store a small auth record in the session and load the full identity later with `sessionAuth()`

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import type { RequestContext } from 'remix/fetch-router'
import { form, route } from 'remix/fetch-router/routes'
import { auth, Auth, requireAuth, sessionAuth } from 'remix/auth-middleware'
import { callback, createCredentialsAuthProvider, createGoogleAuthProvider, login } from 'remix/auth'
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

let googleProvider = createGoogleAuthProvider({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), env.APP_ORIGIN),
})

let passwordProvider = createCredentialsAuthProvider({
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

function getUser(context: RequestContext) {
  let auth = context.get(Auth)

  if (!auth.ok) {
    throw new Error('Expected an authenticated session.')
  }

  return auth.identity
}

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
  action(context) {
    let user = getUser(context)
    let auth = context.get(Auth)

    return Response.json({
      id: user.id,
      email: user.email,
      method: auth.method,
    })
  },
})
```

This package manages the OAuth transaction in `context.get(Session)` and lets your app decide what authenticated session data to persist:

- `login()` and `callback()` store the OAuth transaction under `__auth`
- your `writeSession(session, result, context)` hook writes app-defined auth data, often under `auth`
- `sessionAuth()` can read that data and resolve the full request identity into `context.get(Auth)`
- credentials examples assume `formData()` middleware runs before `login(createCredentialsAuthProvider(...))`
- examples store `{ userId }` instead of the whole user object to keep session data small and avoid stale user records, especially with cookie-backed sessions

The example also uses `requireAuth()` from `remix/auth-middleware` to turn that resolved auth state into route protection. Use `auth()` to load auth state for the request, then use `requireAuth()` on routes that must reject anonymous requests. See the [`auth-middleware` README](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) for the full request-auth and route-protection API.

## Login Routes

`login()` handles both browser redirect flows and direct credentials submissions:

- `login(oauthProvider)` creates an OAuth transaction, stores it in the session under `__auth`, and redirects to the provider
- `login(credentialsProvider, options)` parses input, verifies the submitted credentials, rotates the session id, runs `writeSession()`, and then either calls `onSuccess()` or redirects

Both forms support redirect and hook customization for success and failure handling. The examples below are the best reference for how those pieces fit together in real routes.

## Success and Failure Hooks

`writeSession(session, result, context)` is the common success hook across credentials and OAuth callbacks. It receives the authenticated result for the provider you used:

- credentials: whatever `verify()` returned
- OAuth and OIDC providers: `{ provider, account, profile, tokens }`

After `writeSession()` runs:

- `onSuccess(result, context)` can return a custom response
- otherwise the handler redirects to `successRedirectTo` or `/`

On failures:

- credentials login uses `onFailure(context)` for invalid credentials and `onError(error, context)` for unexpected exceptions
- OAuth login uses `onError(error, context)` when starting the redirect flow fails
- OAuth callbacks use `onFailure(error, context)` for invalid state, provider errors, token exchange failures, profile fetch failures, or `writeSession()` failures

## OIDC Providers

Use `createOIDCAuthProvider()` for any standards-compliant OpenID Connect provider. The `createGoogleAuthProvider()`, `createMicrosoftAuthProvider()`, `createOktaAuthProvider()`, and `createAuth0AuthProvider()` helpers are thin wrappers on top of the same OIDC runtime.

```ts
import { createAuth0AuthProvider, createGoogleAuthProvider, login, createMicrosoftAuthProvider, createOIDCAuthProvider, createOktaAuthProvider } from 'remix/auth'
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

let googleProvider = createGoogleAuthProvider({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), env.APP_ORIGIN),
})

let companyProvider = createOIDCAuthProvider({
  name: 'company-sso',
  issuer: env.OIDC_ISSUER,
  clientId: env.OIDC_CLIENT_ID,
  clientSecret: env.OIDC_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.company.callback.href(), env.APP_ORIGIN),
  authorizationParams: {
    prompt: 'login',
  },
})

let microsoftProvider = createMicrosoftAuthProvider({
  tenant: 'organizations',
  clientId: env.MICROSOFT_CLIENT_ID,
  clientSecret: env.MICROSOFT_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.microsoft.callback.href(), env.APP_ORIGIN),
})

let oktaProvider = createOktaAuthProvider({
  issuer: env.OKTA_ISSUER,
  clientId: env.OKTA_CLIENT_ID,
  clientSecret: env.OKTA_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.okta.callback.href(), env.APP_ORIGIN),
})

let auth0Provider = createAuth0AuthProvider({
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

- `createOIDCAuthProvider()` uses OIDC discovery by default at `/.well-known/openid-configuration`
- pass `metadata` when you want to skip discovery or `discoveryUrl` when the metadata document lives elsewhere
- default OIDC scopes are `openid profile email`
- wrappers only fill in provider-specific defaults and names; they do not use a separate auth model
- `createGoogleAuthProvider()` uses the same OIDC runtime with Google's published endpoints wired in directly, so it does not need a discovery request
- `createMicrosoftAuthProvider()` adds the `tenant` option and builds the issuer from it
- `createOktaAuthProvider()` expects the full Okta issuer URL, usually something like `https://example.okta.com/oauth2/default`
- `createAuth0AuthProvider()` expects your Auth0 domain and derives the issuer URL for you
- use `mapProfile()` with `createOIDCAuthProvider()` when you want `result.profile` to have an app-specific type before it reaches `writeSession()`

## Custom OAuth Providers

Use the built-in provider helpers when you want a standard browser redirect flow for providers that need behavior beyond the generic OIDC runtime.

```ts
import { createFacebookAuthProvider, createGitHubAuthProvider, login } from 'remix/auth'
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

let githubProvider = createGitHubAuthProvider({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.github.callback.href(), env.APP_ORIGIN),
})

let facebookProvider = createFacebookAuthProvider({
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

- `createGitHubAuthProvider()` may issue a second API request to `/user/emails` when the primary profile payload does not include an email address
- `createFacebookAuthProvider()` fetches a fixed profile shape from `https://graph.facebook.com/me?fields=id,name,email,picture`
- both helpers expose normalized results through `result.account`, `result.profile`, and `result.tokens` in `writeSession()` and `onSuccess()`

## Credentials Login

Use `createCredentialsAuthProvider()` when you want email/password or some other direct form-based authentication.

```ts
import { createCredentialsAuthProvider, login } from 'remix/auth'
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

let passwordProvider = createCredentialsAuthProvider({
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
import { callback, createGitHubAuthProvider } from 'remix/auth'
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

let githubProvider = createGitHubAuthProvider({
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

Like `login()`, `callback()` supports redirect and hook customization for success and failure handling. The provider examples above show the intended shape for OIDC wrappers, custom OAuth providers, and credentials-based auth.

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
- `session()` middleware must run before `login()`, `callback()`, or `sessionAuth()`

## Related Packages

- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Request authentication and route protection helpers
- [`form-data-middleware`](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware) - Form body parsing for `createCredentialsAuthProvider()` routes
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Request-scoped session loading and persistence
- [`session`](https://github.com/remix-run/remix/tree/main/packages/session) - Session data model and storage backends
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and middleware runtime

## Related Work

- [OAuth 2.0](https://oauth.net/2/)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
