# auth

Login request handlers for Remix. Use this package to verify direct credentials submissions, start external browser sign-in flows, finish provider callbacks, and write a small auth record into the session. Pair it with [`remix/auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) when later requests need to resolve that session data into the current user and protect routes.

## Features

- **Explicit external and self-hosted flows** - Use one request handler to start OAuth or OIDC redirects and another to verify direct credentials submissions
- **Built-in provider support** - Start quickly with Google, Microsoft, Okta, Auth0, GitHub, Facebook, and X, or connect another OpenID Connect provider
- **Shared session-writing model** - Persist the same app-owned session record whether login happened locally or through an external provider
- **App-owned session records** - Decide exactly what auth data to write into the session after login succeeds
- **Hookable success and failure behavior** - Control redirects, responses, and error handling without rewriting protocol code
- **Designed to pair with request auth** - Write the session data here, then let `remix/auth-middleware` resolve it on later requests

## Installation

```sh
npm i remix
```

## Usage

The following example shows the two Remix auth packages working together on a simple email/password flow:

- `remix/auth` owns the login route and writes the session auth record
- `remix/auth-middleware` reads that session auth record on later requests and protects the dashboard route

See the [auth providers](#auth-providers) section below for credentials, OIDC, and OAuth examples.

```ts
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { form, route } from 'remix/fetch-router/routes'
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'
import { createCredentialsAuthLoginRequestHandler, createCredentialsAuthProvider } from 'remix/auth'
import { FormData, formData } from 'remix/form-data-middleware'
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
  auth: {
    session: {
      login: form('/login'),
      logout: { method: 'POST', pattern: '/logout' },
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

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage), // needed by the session auth scheme
    formData(), // needed by passwordProvider
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

router.get(routes.auth.session.login.index, () => {
  return new Response('Login page')
})

router.post(
  routes.auth.session.login.action,
  createCredentialsAuthLoginRequestHandler(passwordProvider, {
    async writeSession(session, user) {
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
)

router.post(routes.auth.session.logout, (context) => {
  let session = context.get(Session)
  session.unset('auth')
  session.regenerateId()
  return new Response(null, {
    status: 302,
    headers: {
      Location: routes.auth.session.login.index.href(),
    },
  })
})

router.get(routes.app.dashboard, {
  middleware: [requireAuth()],
  action(context) {
    let auth = context.get(Auth)

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

## Login Routes

Remix Auth uses separate request handlers for the two login shapes:

- `createExternalAuthLoginRequestHandler(externalProvider, options?)` creates an OAuth or OIDC transaction, stores it in `session.get(options.transactionKey)` (defaults to `__auth`), and redirects to an external auth provider
- `createCredentialsAuthLoginRequestHandler(credentialsProvider, options)` parses input, verifies the submitted credentials, rotates the session id, runs `writeSession()`, and then either calls `onSuccess()` or redirects. Use this when you can verify credentials directly instead of relying on an external auth provider.

## Success and Failure Hooks

`writeSession(session, result, context)` is the common success hook across credentials login and external provider callbacks. It receives the authenticated result for the request handler you used:

- credentials login: whatever `verify()` returned
- external provider callback: `{ provider, account, profile, tokens }`

After `writeSession()` runs:

- `onSuccess(result, context)` can return a custom response
- otherwise the handler redirects to `successRedirectTo` or `/`

On failures:

- credentials login uses `onFailure(context)` for invalid credentials and `onError(error, context)` for unexpected exceptions
- external auth login uses `onError(error, context)` when starting the redirect flow fails
- external auth callbacks use `onFailure(error, context)` for invalid state, provider errors, token exchange failures, profile fetch failures, or `writeSession()` failures

## Auth Providers

- App-defined credentials flows like email and password
- [OpenID Connect](https://openid.net) (works with any OpenID Connect auth provider)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) provider
- [Microsoft OAuth 2.0 and OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols)
- [Okta OAuth 2.0 and OpenID Connect](https://developer.okta.com/docs/concepts/oauth-openid/)
- [Auth0 OpenID Connect Protocol](https://auth0.com/docs/authenticate/protocols/openid-connect-protocol)
- [GitHub OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow/)
- [X OAuth 2.0 and Log in with X](https://docs.x.com/resources/fundamentals/authentication/guides/log-in-with-x)

## Custom Auth Providers

For most custom providers, use `createOIDCAuthProvider()`. That is the public extension point for providers that support OpenID Connect discovery, authorization code flow, and a userinfo endpoint.

```ts
import {
  createExternalAuthCallbackRequestHandler,
  createExternalAuthLoginRequestHandler,
  createOIDCAuthProvider,
} from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    company: {
      login: '/login/company',
      callback: '/auth/company/callback',
    },
  },
  app: {
    dashboard: '/dashboard',
  },
})

let companyProvider = createOIDCAuthProvider({
  name: 'company',
  issuer: 'https://sso.acme.com',
  clientId: 'acme-web',
  clientSecret: 'acme-web-secret',
  redirectUri: new URL(routes.auth.company.callback.href(), 'https://app.acme.com'),
  authorizationParams: {
    prompt: 'login',
  },
  mapProfile({ claims }) {
    return {
      id: claims.sub,
      email: claims.email ?? null,
      name: claims.name ?? claims.preferred_username ?? 'Unknown user',
    }
  },
})

router.get(routes.auth.company.login, createExternalAuthLoginRequestHandler(companyProvider))

router.get(
  routes.auth.company.callback,
  createExternalAuthCallbackRequestHandler(companyProvider, {
    async writeSession(session, result) {
      let user = await users.upsertFromCompanySSO(result.profile)
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
  }),
)
```

## Credentials Login

Use `createCredentialsAuthProvider()` when you want email/password or some other direct form-based authentication.

```ts
import { createCredentialsAuthLoginRequestHandler, createCredentialsAuthProvider } from 'remix/auth'
import { FormData, formData } from 'remix/form-data-middleware'
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
  action: createCredentialsAuthLoginRequestHandler(passwordProvider, {
    async writeSession(session, user) {
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
})
```

`writeSession(session, result, context)` gives you one place to normalize every successful login into whatever session record shape your app wants to persist. In most apps that should be a small record like `{ userId }`, not the full user object.

## Built-in OIDC Providers

Remix Auth includes built-in support for Google, Microsoft, Okta, and Auth0 using the same OIDC runtime.

```ts
import {
  createAuth0AuthProvider,
  createExternalAuthLoginRequestHandler,
  createGoogleAuthProvider,
  createMicrosoftAuthProvider,
  createOktaAuthProvider,
} from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    google: {
      login: '/login/google',
      callback: '/auth/google/callback',
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

router.get(routes.auth.google.login, createExternalAuthLoginRequestHandler(googleProvider))
router.get(routes.auth.microsoft.login, createExternalAuthLoginRequestHandler(microsoftProvider))
router.get(routes.auth.okta.login, createExternalAuthLoginRequestHandler(oktaProvider))
router.get(routes.auth.auth0.login, createExternalAuthLoginRequestHandler(auth0Provider))
```

Notes:

- OIDC auth providers use discovery by default at `/.well-known/openid-configuration`
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
import {
  createExternalAuthLoginRequestHandler,
  createGitHubAuthProvider,
  createXAuthProvider,
} from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    github: {
      login: '/login/github',
      callback: '/auth/github/callback',
    },
    x: {
      login: '/login/x',
      callback: '/auth/x/callback',
    },
  },
})

let githubProvider = createGitHubAuthProvider({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.github.callback.href(), env.APP_ORIGIN),
})

let xProvider = createXAuthProvider({
  clientId: env.X_CLIENT_ID,
  clientSecret: env.X_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.x.callback.href(), env.APP_ORIGIN),
})

router.get(routes.auth.github.login, createExternalAuthLoginRequestHandler(githubProvider))
router.get(routes.auth.x.login, createExternalAuthLoginRequestHandler(xProvider))
```

Default scopes:

- GitHub: `read:user user:email`
- X: `tweet.read users.read`

Pass `scopes` if you need a different set for a provider.

Provider notes:

- `createGitHubAuthProvider()` may issue a second API request to `/user/emails` when the primary profile payload does not include an email address
- `createXAuthProvider()` uses OAuth 2.0 Authorization Code with PKCE and loads the authenticated user from `https://api.x.com/2/users/me`
- `createFacebookAuthProvider()` is also available when you want the Facebook Login flow instead of X
- these helpers expose normalized results through `result.account`, `result.profile`, and `result.tokens` in `writeSession()` and `onSuccess()`

## Session Lifecycle

The successful auth flow always follows the same order:

1. `createExternalAuthLoginRequestHandler()` stores the OAuth transaction under `__auth` when you start an OAuth redirect flow
2. successful credentials login or OAuth callback rotates the session id
3. `writeSession(session, result, context)` writes your app-defined auth data
4. `onSuccess(result, context)` runs after the session write, if you provided it
5. otherwise the handler redirects to the resolved success location
6. `createSessionAuthScheme()` later reads the written session data and resolves request identity into `context.get(Auth)`

## Callback Handling

Use `createExternalAuthCallbackRequestHandler()` on the provider callback route to validate the stored transaction, exchange the authorization code, fetch the provider profile, and persist the session auth record.

```ts
import { createExternalAuthCallbackRequestHandler, createGitHubAuthProvider } from 'remix/auth'
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
  createExternalAuthCallbackRequestHandler(githubProvider, {
    async writeSession(session, result) {
      let user = await users.upsertFromGitHub(result.profile)
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.index.href(),
  }),
)
```

`createExternalAuthCallbackRequestHandler()` exposes the normalized provider result to `writeSession()` and `onSuccess()`, including:

- `result.provider`
- `result.account`
- `result.profile`
- `result.tokens`

`createExternalAuthCallbackRequestHandler()` supports redirect and hook customization for success and failure handling. The provider examples above show the intended shape for OIDC wrappers and custom OAuth providers.

## Working With auth-middleware

This package is designed to be paired with `remix/session-middleware` and [`remix/auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware).

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

- `remix/auth` handles the requests that establish login state
- `writeSession()` persists the app-defined session auth record
- `createSessionAuthScheme()` converts that record into `context.get(Auth)` on later requests
- `requireAuth()` protects routes that require a signed-in user
- `session()` middleware must run before `createCredentialsAuthLoginRequestHandler()`, `createExternalAuthLoginRequestHandler()`, `createExternalAuthCallbackRequestHandler()`, or `createSessionAuthScheme()`

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
