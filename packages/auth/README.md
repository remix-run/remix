# auth

Login request handlers for Remix. Use this package to verify credentials on your own server, start external browser sign-in flows, finish provider callbacks, and write a small auth record into the session. Pair it with [`remix/auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) when later requests need to resolve that session data into the current user and protect routes.

## Features

- **Explicit credentials and external flows** - Use one request handler to start OAuth or OIDC redirects and another to verify credentials on your own server
- **Built-in provider support** - Start quickly with Google, Microsoft, Okta, Auth0, GitHub, Facebook, and X, or connect another OpenID Connect provider
- **Shared session-writing model** - Persist the same app-owned session record whether login happened locally or through an external provider
- **App-owned session records** - Decide exactly what auth data to write into the session after login succeeds
- **Hookable success and failure behavior** - Control redirects, responses, and error handling without rewriting protocol code
- **Designed to pair with request auth** - Write the session data here, then let `remix/auth-middleware` resolve it on later requests

## Installation

```sh
npm i remix
```

## Credentials Auth

By credentials auth, we mean auth that your own server can verify directly. The following example demonstrates a simple email/password credentials flow:

- `remix/auth` owns the login route and writes the session auth record
- `remix/auth-middleware` reads that session auth record on later requests and protects the dashboard route

```ts
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { form, route } from 'remix/fetch-router/routes'
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'
import type { GoodAuth } from 'remix/auth-middleware'
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

// Use createCredentialsAuthProvider() when your own server can verify
// submitted credentials directly instead of relying on an external auth
// provider. This is the right choice for email/password flows and other
// direct form submissions.
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
      // This hook runs after the provider verifies credentials but before
      // the response is sent. Use it to write whatever you want into the
      // session. We recommend a small record like { userId }.
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
    let auth = context.get(Auth) as GoodAuth<{ id: string; email: string }>

    return Response.json({
      id: auth.identity.id,
      email: auth.identity.email,
      method: auth.method,
    })
  },
})
```

## External Auth

Starting from the same `session()` middleware, `auth()`, and `createSessionAuthScheme()` setup as the credentials example above, you can add a Google login flow like this. This example only shows the Google-specific routes plus a tiny `/login` page that links to the external login route:

```ts
import { Auth, requireAuth } from 'remix/auth-middleware'
import type { GoodAuth } from 'remix/auth-middleware'
import {
  createExternalAuthCallbackRequestHandler,
  createExternalAuthLoginRequestHandler,
  createGoogleAuthProvider,
} from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    session: {
      login: '/login',
    },
    google: {
      login: '/login/google',
      callback: '/auth/google/callback',
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

router.get(routes.auth.session.login, () => {
  return new Response(`<a href="${routes.auth.google.login.href()}">Login with Google</a>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
})

router.get(routes.auth.google.login, createExternalAuthLoginRequestHandler(googleProvider))

router.get(
  routes.auth.google.callback,
  createExternalAuthCallbackRequestHandler(googleProvider, {
    async writeSession(session, result) {
      let user = await users.upsertFromGoogle(result.profile)
      session.set('auth', { userId: user.id })
    },
    successRedirectTo: routes.app.dashboard.href(),
    failureRedirectTo: routes.auth.session.login.href(),
  }),
)

router.get(routes.app.dashboard, {
  middleware: [requireAuth()],
  action(context) {
    let auth = context.get(Auth) as GoodAuth<{ id: string; email: string | null }>

    return Response.json({
      id: auth.identity.id,
      email: auth.identity.email,
      method: auth.method,
    })
  },
})
```

An external auth flow has two endpoints:

- `createExternalAuthLoginRequestHandler(externalProvider, options?)` stores the in-progress OAuth or OIDC transaction in the session under `options.transactionKey` (defaults to `__auth`) before redirecting to the provider
- `createExternalAuthCallbackRequestHandler(externalProvider, options)` reads that transaction back, finishes the provider callback, and persists the session auth record using the `writeSession` hook, similar to the credentials flow

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

## Built-in External Auth Providers

When one of the built-in providers matches your provider, start there. Google, Microsoft, Okta, and Auth0 use the shared OIDC runtime. GitHub, Facebook, and X use built-in custom OAuth flows.

```ts
import {
  createAuth0AuthProvider,
  createExternalAuthLoginRequestHandler,
  createFacebookAuthProvider,
  createGoogleAuthProvider,
  createGitHubAuthProvider,
  createMicrosoftAuthProvider,
  createOktaAuthProvider,
  createXAuthProvider,
} from 'remix/auth'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  auth: {
    auth0: {
      login: '/login/auth0',
      callback: '/auth/auth0/callback',
    },
    facebook: {
      login: '/login/facebook',
      callback: '/auth/facebook/callback',
    },
    github: {
      login: '/login/github',
      callback: '/auth/github/callback',
    },
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
    x: {
      login: '/login/x',
      callback: '/auth/x/callback',
    },
  },
})

let auth0Provider = createAuth0AuthProvider({
  domain: env.AUTH0_DOMAIN,
  clientId: env.AUTH0_CLIENT_ID,
  clientSecret: env.AUTH0_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.auth0.callback.href(), env.APP_ORIGIN),
})

let facebookProvider = createFacebookAuthProvider({
  clientId: env.FACEBOOK_CLIENT_ID,
  clientSecret: env.FACEBOOK_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.facebook.callback.href(), env.APP_ORIGIN),
})

let githubProvider = createGitHubAuthProvider({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.github.callback.href(), env.APP_ORIGIN),
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

let xProvider = createXAuthProvider({
  clientId: env.X_CLIENT_ID,
  clientSecret: env.X_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.x.callback.href(), env.APP_ORIGIN),
})

router.get(routes.auth.auth0.login, createExternalAuthLoginRequestHandler(auth0Provider))
router.get(routes.auth.facebook.login, createExternalAuthLoginRequestHandler(facebookProvider))
router.get(routes.auth.github.login, createExternalAuthLoginRequestHandler(githubProvider))
router.get(routes.auth.google.login, createExternalAuthLoginRequestHandler(googleProvider))
router.get(routes.auth.microsoft.login, createExternalAuthLoginRequestHandler(microsoftProvider))
router.get(routes.auth.okta.login, createExternalAuthLoginRequestHandler(oktaProvider))
router.get(routes.auth.x.login, createExternalAuthLoginRequestHandler(xProvider))
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

Default scopes for OAuth providers that don't use OIDC discovery:

- GitHub: `read:user user:email`
- Facebook: `public_profile email`
- X: `tweet.read users.read`

Pass `scopes` if you need a different set for a provider.

Provider notes:

- `createGitHubAuthProvider()` may issue a second API request to `/user/emails` when the primary profile payload does not include an email address
- `createFacebookAuthProvider()` uses OAuth 2.0 Authorization Code with PKCE and loads the authenticated user from `https://graph.facebook.com/me?fields=id,name,email,picture`
- `createXAuthProvider()` uses OAuth 2.0 Authorization Code with PKCE and loads the authenticated user from `https://api.x.com/2/users/me`
- these helpers expose normalized results through `result.account`, `result.profile`, and `result.tokens` in `writeSession()` and `onSuccess()`

## Custom Auth Providers

Use `createOIDCAuthProvider()` directly for custom external auth providers. This is the extension point for providers that support OpenID Connect discovery, authorization code flow, and a userinfo endpoint. Reach for a custom OAuth provider implementation only when the provider does not support OIDC.

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
