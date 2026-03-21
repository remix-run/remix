# auth

Composable browser authentication primitives for Remix. Use this package to verify credentials on your own server, start external OAuth or OIDC redirects, finish provider callbacks, and write an app-owned auth record into the session. Pair it with [`remix/auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) when later requests need to resolve that session data into the current user and protect routes.

## Features

- Small, composable primitives: `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, and `completeAuth()`
- Built-in provider support for Google, Microsoft, Okta, Auth0, GitHub, Facebook, and X
- Module-scope provider configuration for boot-time validation and stable callback URLs
- App-owned session records so you decide what auth data to persist
- Shared session completion for credentials and external auth flows
- Designed to pair with `remix/auth-middleware` for request-time auth resolution and route protection

## Installation

```sh
npm i remix
```

## Usage

`remix/auth` exposes four primitives:

- `verifyCredentials(provider, context)` parses submitted credentials and returns the authenticated result or `null`
- `startExternalAuth(provider, context, options?)` stores the in-progress OAuth transaction in the session and returns the provider redirect response
- `finishExternalAuth(provider, context, options?)` validates the callback, clears the stored transaction, and returns `{ result, returnTo? }`
- `completeAuth(context)` rotates the current session id and returns the session for auth writes

The route owns redirects, flashes, and other app-specific behavior. `remix/auth` owns the protocol work.

## Credentials Auth

Use `createCredentialsAuthProvider()` when your own server can verify submitted credentials directly, such as email/password logins.

```ts
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'
import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { form, route } from 'remix/fetch-router/routes'
import { FormData, formData } from 'remix/form-data-middleware'
import type { GoodAuth } from 'remix/auth-middleware'
import { redirect } from 'remix/response/redirect'
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
  async verify({ email, password }) {
    return users.verifyPassword(email, password)
  },
})

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    formData(),
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

router.get(routes.auth.session.login.index, () => new Response('Login page'))

router.post(routes.auth.session.login.action, async (context) => {
  let user = await verifyCredentials(passwordProvider, context)

  if (user == null) {
    return redirect(routes.auth.session.login.index.href())
  }

  let session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return redirect(routes.app.dashboard.href())
})

router.post(routes.auth.session.logout, ({ get }) => {
  let session = get(Session)
  session.unset('auth')
  session.regenerateId(true)
  return redirect(routes.auth.session.login.index.href())
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

## External Auth

Starting from the same `session()`, `auth()`, and `createSessionAuthScheme()` setup as the credentials example above, you can add a Google login flow like this. The provider is created once at module scope, and the routes compose `startExternalAuth()`, `finishExternalAuth()`, and `completeAuth()` directly.

```ts
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/auth-middleware'
import {
  completeAuth,
  createGoogleAuthProvider,
  finishExternalAuth,
  startExternalAuth,
} from 'remix/auth'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'
import type { GoodAuth } from 'remix/auth-middleware'
import { redirect } from 'remix/response/redirect'
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

router.get(routes.auth.session.login, () => {
  return new Response(`<a href="${routes.auth.google.login.href()}">Login with Google</a>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
})

router.get(routes.auth.google.login, (context) =>
  startExternalAuth(googleProvider, context, {
    returnTo: context.url.searchParams.get('returnTo'),
  }),
)

router.get(routes.auth.google.callback, async (context) => {
  let { result, returnTo } = await finishExternalAuth(googleProvider, context)

  let user = await users.upsertFromGoogle(result.profile)
  let session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return redirect(returnTo ?? routes.app.dashboard.href())
})

router.get(routes.app.dashboard, {
  middleware: [requireAuth()],
  handler(context) {
    let auth = context.get(Auth) as GoodAuth<{ id: string; email: string | null }>

    return Response.json({
      id: auth.identity.id,
      email: auth.identity.email,
      method: auth.method,
    })
  },
})
```

A typical external auth flow looks like this:

1. Create the provider once at module scope.
2. Call `startExternalAuth()` from the login route.
3. Call `finishExternalAuth()` from the callback route.
4. Call `completeAuth(context)` and write your auth record into the returned session.
5. Return your own redirect or other response.

## Built-in External Auth Providers

When one of the built-in providers matches your auth provider, start there. Google, Microsoft, Okta, and Auth0 use the shared OIDC runtime. GitHub, Facebook, and X use built-in custom OAuth flows.

```ts
import {
  createAuth0AuthProvider,
  createFacebookAuthProvider,
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createMicrosoftAuthProvider,
  createOktaAuthProvider,
  createXAuthProvider,
} from 'remix/auth'

let auth0Provider = createAuth0AuthProvider({
  domain: env.AUTH0_DOMAIN,
  clientId: env.AUTH0_CLIENT_ID,
  clientSecret: env.AUTH0_CLIENT_SECRET,
  redirectUri: new URL('/auth/auth0/callback', env.APP_ORIGIN),
})

let facebookProvider = createFacebookAuthProvider({
  clientId: env.FACEBOOK_CLIENT_ID,
  clientSecret: env.FACEBOOK_CLIENT_SECRET,
  redirectUri: new URL('/auth/facebook/callback', env.APP_ORIGIN),
})

let githubProvider = createGitHubAuthProvider({
  clientId: env.GITHUB_CLIENT_ID,
  clientSecret: env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL('/auth/github/callback', env.APP_ORIGIN),
})

let googleProvider = createGoogleAuthProvider({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL('/auth/google/callback', env.APP_ORIGIN),
})

let microsoftProvider = createMicrosoftAuthProvider({
  tenant: 'organizations',
  clientId: env.MICROSOFT_CLIENT_ID,
  clientSecret: env.MICROSOFT_CLIENT_SECRET,
  redirectUri: new URL('/auth/microsoft/callback', env.APP_ORIGIN),
})

let oktaProvider = createOktaAuthProvider({
  issuer: env.OKTA_ISSUER,
  clientId: env.OKTA_CLIENT_ID,
  clientSecret: env.OKTA_CLIENT_SECRET,
  redirectUri: new URL('/auth/okta/callback', env.APP_ORIGIN),
})

let xProvider = createXAuthProvider({
  clientId: env.X_CLIENT_ID,
  clientSecret: env.X_CLIENT_SECRET,
  redirectUri: new URL('/auth/x/callback', env.APP_ORIGIN),
})
```

Notes:

- OIDC providers use discovery by default at `/.well-known/openid-configuration`
- Pass `metadata` when you want to skip discovery or `discoveryUrl` when the metadata document lives elsewhere
- Default OIDC scopes are `openid profile email`
- `createGoogleAuthProvider()` uses the same OIDC runtime with Google's published endpoints wired in directly, so it does not need a discovery request
- `createMicrosoftAuthProvider()` adds the `tenant` option and builds the issuer from it
- `createOktaAuthProvider()` expects the full Okta issuer URL, usually something like `https://example.okta.com/oauth2/default`
- `createAuth0AuthProvider()` expects your Auth0 domain and derives the issuer URL for you
- Use `mapProfile()` with `createOIDCAuthProvider()` when you want `result.profile` to have an app-specific type before it reaches your route code

Default scopes for OAuth providers that don't use OIDC discovery:

- GitHub: `read:user user:email`
- Facebook: `public_profile email`
- X: `tweet.read users.read`

Pass `scopes` if you need a different set for a provider.

## Custom Auth Providers

Use `createOIDCAuthProvider()` directly for custom external auth providers. This is the extension point for providers that support OpenID Connect discovery, authorization code flow, and a userinfo endpoint. Reach for a custom OAuth provider implementation only when the provider does not support OIDC.

```ts
import {
  completeAuth,
  createOIDCAuthProvider,
  finishExternalAuth,
  startExternalAuth,
} from 'remix/auth'
import { redirect } from 'remix/response/redirect'

let companyProvider = createOIDCAuthProvider({
  name: 'company',
  issuer: 'https://sso.acme.com',
  clientId: 'acme-web',
  clientSecret: 'acme-web-secret',
  redirectUri: new URL('/auth/company/callback', 'https://app.acme.com'),
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

router.get('/login/company', (context) =>
  startExternalAuth(companyProvider, context, {
    returnTo: context.url.searchParams.get('returnTo'),
  }),
)

router.get('/auth/company/callback', async (context) => {
  let { result, returnTo } = await finishExternalAuth(companyProvider, context)

  let user = await users.upsertFromCompanySSO(result.profile)
  let session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return redirect(returnTo ?? '/dashboard')
})
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
