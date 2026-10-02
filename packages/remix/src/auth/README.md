# auth

Composable browser authentication primitives for Remix. Use this package to verify credentials on your own server, start external OAuth or OIDC redirects, finish provider callbacks, register and verify passkeys, and write an app-owned auth record into the session. Pair it with [`remix/middleware/auth`](../auth-middleware/README.md) when later requests need to resolve that session data into the current user and protect routes.

## Features

- Small, composable primitives: `verifyCredentials()`, `startExternalAuth()`, `finishExternalAuth()`, `refreshExternalAuth()`, and `completeAuth()`
- Built-in provider support for Google, Microsoft, Okta, Auth0, GitHub, Facebook, and X
- Passkey registration and sign-in with WebAuthn, including username-less sign-in and autofill, verified with Web Crypto
- Browser helpers in `remix/auth/browser` that run passkey prompts and report unsupported browsers, cancellation, and errors as results
- Module-scope provider configuration for boot-time validation and stable callback URLs
- App-owned session records so you decide what auth data to persist
- Shared session completion for credentials and external auth flows
- Designed to pair with `remix/middleware/auth` for request-time auth resolution and route protection

## Installation

```sh
npm i remix
```

## Usage

`remix/auth` exposes these primitives:

- `verifyCredentials(provider, context)` parses submitted credentials and returns the authenticated result or `null`
- `startExternalAuth(provider, context, options?)` stores the in-progress OAuth transaction in the session and returns the provider redirect response
- `finishExternalAuth(provider, context, options?)` validates the callback, clears the stored transaction, and returns `{ result, returnTo? }`, including any provider tokens in `result.tokens`
- `refreshExternalAuth(provider, tokens)` exchanges a previously stored `refreshToken` for a fresh provider token bundle when the provider runtime supports refresh
- `startPasskeyRegistration(provider, context, options)` and `startPasskeyAuthentication(provider, context, options?)` issue a session-bound challenge and return WebAuthn options for the browser
- `finishPasskeyRegistration(provider, context, options)` and `finishPasskeyAuthentication(provider, context, options)` verify the browser response and return `{ ok, credential }` or `{ ok: false, error }`
- `completeAuth(context)` rotates the current session id and returns the session for auth writes

The route owns redirects, flashes, and other app-specific behavior. `remix/auth` owns the protocol work.

## Credentials Auth

Use `createCredentialsAuthProvider()` when your own server can verify submitted credentials directly, such as email/password logins.

```ts
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/middleware/auth'
import { completeAuth, createCredentialsAuthProvider, verifyCredentials } from 'remix/auth'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { form, route } from 'remix/routes'
import type { GoodAuth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'
import { session } from 'remix/middleware/session'
import { createCookieSessionStorage } from 'remix/session-storage/cookie'

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
    if (formData == null) {
      throw new Error('Expected formData() middleware before verifyCredentials()')
    }

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

`returnTo` accepts local paths beginning with `/`, including queries and fragments. The auth helpers normalize the path and omit targets that resolve to another origin or normalize to an authority reference beginning with `//`. `finishExternalAuth()` also validates targets from existing transactions.

```ts
import { auth, Auth, createSessionAuthScheme, requireAuth } from 'remix/middleware/auth'
import {
  completeAuth,
  createGoogleAuthProvider,
  finishExternalAuth,
  refreshExternalAuth,
  startExternalAuth,
} from 'remix/auth'
import { createCookie } from 'remix/cookie'
import { createRouter } from 'remix/router'
import { route } from 'remix/routes'
import type { GoodAuth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'
import { session } from 'remix/middleware/session'
import { createCookieSessionStorage } from 'remix/session-storage/cookie'

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
  authorizationParams: {
    access_type: 'offline',
    prompt: 'consent',
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
  await persistProviderTokens(user.id, result.tokens)

  let session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return redirect(returnTo ?? routes.app.dashboard.href())
})

async function getGoogleAccessToken(userId: string) {
  let tokens = await readStoredProviderTokens(userId)
  if (tokens == null) {
    return null
  }

  if (tokens.expiresAt != null && tokens.expiresAt.getTime() <= Date.now()) {
    tokens = (await refreshExternalAuth(googleProvider, tokens)).tokens
    await persistProviderTokens(userId, tokens)
  }

  return tokens.accessToken
}

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
4. Persist any provider tokens you want to reuse later.
5. Call `completeAuth(context)` and write your auth record into the returned session.
6. On a later follow-up request, load the stored provider tokens, refresh them with `refreshExternalAuth()` only if needed, then save the refreshed bundle back to storage.
7. Return your own redirect or other response.

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
- `refreshExternalAuth()` supports built-in OIDC providers and X when the stored token bundle includes a refresh token
- Providers only return refresh tokens when configured to request offline access, such as `authorizationParams: { access_type: 'offline' }` for Google or adding `offline.access` to X scopes
- Use `mapProfile()` with `createOIDCAuthProvider()` when you want `result.profile` to have an app-specific type before it reaches your route code

Default scopes for OAuth providers that don't use OIDC discovery:

- GitHub: `read:user user:email`
- Facebook: `public_profile email`
- X: `tweet.read users.read`

Pass `scopes` if you need a different set for a provider.

GitHub uses the email returned in the profile when present. Otherwise, it selects a verified address from the email API, preferring the primary address, and leaves the email `null` or absent if none are verified. The provider account identity remains the GitHub user ID in `result.account.providerAccountId`.

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

Provider packages for other OAuth protocols can use `createOAuthProvider()` to implement the authorization, callback, and optional refresh hooks consumed by `startExternalAuth()`, `finishExternalAuth()`, and `refreshExternalAuth()`.

```ts
import { createOAuthProvider } from 'remix/auth'
import type { OAuthTokens } from 'remix/auth'

interface AcmeProfile {
  id: string
  email: string
}

interface AcmeTokens extends OAuthTokens {
  resourceServer: string
}

export function createAcmeAuthProvider(options: AcmeAuthProviderOptions) {
  return createOAuthProvider<AcmeProfile, 'acme', AcmeTokens>('acme', {
    async createAuthorizationURL(transaction) {
      let metadata = await discoverAuthorizationServer(options)

      transaction.providerState = await encryptProviderState(metadata)
      return createAuthorizationRequest(metadata, transaction)
    },
    async handleCallback(context, transaction) {
      let metadata = await decryptProviderState(transaction.providerState)
      let tokens = await exchangeAuthorizationCode(metadata, context, transaction)
      let profile = await loadProfile(tokens)

      return {
        provider: 'acme',
        account: {
          provider: 'acme',
          providerAccountId: profile.id,
        },
        profile,
        tokens,
      }
    },
    async refreshTokens(tokens) {
      return refreshAcmeTokens(tokens)
    },
  })
}
```

The runtime may write a serialized value to `transaction.providerState` during `createAuthorizationURL()`. Remix persists that value with the OAuth transaction and returns it to `handleCallback()`. Treat it as provider-owned opaque data, and encrypt sensitive values because session storage is not guaranteed to be confidential. Extending `OAuthTokens` preserves provider-specific fields through callback and refresh results without requiring those fields to become part of Remix's built-in token model.

## Passkeys

Passkeys let users sign in with their device's biometrics, screen lock, or a security key instead of a password. `remix/auth` runs the WebAuthn protocol: it issues challenges, checks origins and the relying party, verifies signatures with Web Crypto, and rejects replayed responses. Your app owns users, stored credentials, and account recovery.

The flow has two halves. Server routes call `startPasskeyRegistration()` or `startPasskeyAuthentication()` to get options for the browser, then `finishPasskeyRegistration()` or `finishPasskeyAuthentication()` to verify what the browser returns. In the browser, `createPasskey()` and `getPasskey()` from `remix/auth/browser` turn those options into a WebAuthn prompt and return a JSON response to send back.

### Requirements

- Browsers only run passkey ceremonies in secure contexts: HTTPS in production and `http://localhost` in development. IP addresses such as `127.0.0.1` are rejected, so use `localhost` locally.
- `rpId` is the domain passkeys belong to. Use your registrable domain, such as `example.com`, to share passkeys across subdomains. Passkeys cannot move to another `rpId` later.
- `origin` lists every exact origin that runs passkey ceremonies. Each origin must be the `rpId` or one of its subdomains.

### Passkey Provider

Create the provider once at module scope. The provider validates its configuration at startup.

```ts
import { createPasskeyAuthProvider } from 'remix/auth'

let passkeyProvider = createPasskeyAuthProvider({
  rpId: 'example.com',
  rpName: 'Example',
  origin: ['https://example.com', 'https://app.example.com'],
  challengeStore: {
    async save(challenge, expiresAt) {
      await db.passkeyChallenges.insert({ challenge, expiresAt })
    },
    async consume(challenge) {
      // Must be atomic so only one request can redeem a challenge.
      let deletedCount = await db.passkeyChallenges.delete({ challenge })
      return deletedCount === 1
    },
  },
  findCredential(credentialId) {
    return db.passkeys.findById(credentialId)
  },
})
```

Each challenge is bound to the session that requested it, to its ceremony, and to an account where one is known. The `challengeStore` makes challenges single-use across concurrent requests, server instances, and replayed cookie sessions. `consume()` must atomically remove the challenge and return `true` only for the request that removed it, such as a `DELETE` by primary key or Redis `GETDEL`. `createMemoryPasskeyChallengeStore()` provides an in-process store for development, tests, and single-instance apps.

`findCredential()` returns the stored credential for an ID, or `null` when the credential is unknown or has been revoked. Store these `PasskeyCredential` fields for every passkey, with `id` as a unique key:

- `id`: base64url credential ID
- `userId`: your user ID
- `publicKey`: base64url COSE public key
- `counter`: signature counter
- `transports`: transport hints for the browser
- `backupEligible` and `backedUp`: whether the passkey can sync and whether it is synced
- `aaguid`: the authenticator model identifier the authenticator reports. Registration does not verify attestation, so use it for display, such as naming a passkey after its password manager, and not for security decisions.

A user can have many passkeys. Add your own fields, such as a name and timestamps, next to these.

### Registering Passkeys

Users usually add a passkey from their account settings after signing in. The server starts registration for the signed-in account and lists the passkeys it already has, so the same authenticator is not registered twice.

```ts
import { finishPasskeyRegistration, startPasskeyRegistration } from 'remix/auth'
import { Auth, requireAuth } from 'remix/middleware/auth'
import type { GoodAuth } from 'remix/middleware/auth'
import { redirect } from 'remix/response/redirect'

router.post(routes.account.passkeys.options, {
  middleware: [requireAuth()],
  async handler(context) {
    let user = (context.get(Auth) as GoodAuth<User>).identity
    let passkeys = await db.passkeys.findByUserId(user.id)

    return Response.json(
      await startPasskeyRegistration(passkeyProvider, context, {
        user: { id: user.id, name: user.email, displayName: user.name },
        excludeCredentials: passkeys,
      }),
    )
  },
})

router.post(routes.account.passkeys.create, {
  middleware: [requireAuth()],
  async handler(context) {
    let user = (context.get(Auth) as GoodAuth<User>).identity
    let formData = context.get(FormData)
    let result = await finishPasskeyRegistration(passkeyProvider, context, {
      response: formData.get('response'),
      userId: user.id,
    })

    if (!result.ok) {
      context.session.flash('error', 'We could not add that passkey.')
      return redirect(routes.account.index.href())
    }

    await db.passkeys.insert({
      ...result.credential,
      name: String(formData.get('name') || 'Passkey'),
      createdAt: new Date(),
    })

    return redirect(routes.account.index.href())
  },
})
```

`user.id` becomes the WebAuthn user handle that authenticators store with the passkey. Use a stable, opaque ID of at most 64 bytes, such as a database ID or UUID, rather than an email address. `finishPasskeyRegistration()` requires the `userId` of the account the passkey is being added to, and rejects responses whose challenge was started for a different account.

In the browser, ask the server for options, call `createPasskey()`, and submit the response in a hidden `response` field of the registration form:

```ts
import { createPasskey } from 'remix/auth/browser'

let optionsResponse = await fetch('/account/passkeys/options', { method: 'POST' })
let result = await createPasskey(await optionsResponse.json())

if (result.ok) {
  responseInput.value = JSON.stringify(result.response)
  form.submit()
} else if (result.error.code !== 'cancelled') {
  showError(result.error.message)
}
```

`finishPasskeyRegistration()` and `finishPasskeyAuthentication()` accept the response object or its JSON string, so the response can arrive in a JSON body or in a form field.

### Signing In With Passkeys

Passkeys are discoverable credentials, so users can sign in without typing a username. The sign-in route verifies the response, saves the credential's latest counter and backup state, and rotates the session with `completeAuth()`.

```ts
import { completeAuth, finishPasskeyAuthentication, startPasskeyAuthentication } from 'remix/auth'

router.post(routes.auth.passkey.options, async (context) =>
  Response.json(await startPasskeyAuthentication(passkeyProvider, context)),
)

router.post(routes.auth.passkey.login, async (context) => {
  let result = await finishPasskeyAuthentication(passkeyProvider, context, {
    response: context.get(FormData).get('response'),
  })

  if (!result.ok) {
    context.session.flash('error', 'We could not sign you in with that passkey.')
    return redirect(routes.auth.session.login.href())
  }

  let { credential } = result
  await db.passkeys.update(credential.id, {
    counter: credential.counter,
    backedUp: credential.backedUp,
    lastUsedAt: new Date(),
  })

  let session = completeAuth(context)
  session.set('auth', { userId: credential.userId })

  return redirect(routes.app.dashboard.href())
})
```

When the user has already identified themselves, such as by entering a username, pass `userId` and `allowCredentials` to `startPasskeyAuthentication()`. Sign-in then succeeds only with one of the allowed passkeys, and only if it belongs to that account.

Browsers can also offer passkeys in the username field's autofill menu. Mark the field with `autocomplete="username webauthn"`, start an autofill request when the page loads, and abort it before starting a request from a "Sign in with a passkey" button. Browsers keep autofill requests open indefinitely, while the challenge expires after the provider `timeout`, so long-lived pages should restart autofill with fresh options before then.

```ts
import { getPasskey, isPasskeyAutofillSupported } from 'remix/auth/browser'

async function signInWithPasskey(options: { autofill: boolean; signal?: AbortSignal }) {
  let optionsResponse = await fetch('/auth/passkey/options', { method: 'POST' })
  let result = await getPasskey(await optionsResponse.json(), options)

  if (result.ok) {
    responseInput.value = JSON.stringify(result.response)
    form.requestSubmit()
  }
}

let autofill = new AbortController()
if (await isPasskeyAutofillSupported()) {
  signInWithPasskey({ autofill: true, signal: autofill.signal })
}

button.addEventListener('click', () => {
  autofill.abort()
  signInWithPasskey({ autofill: false })
})
```

A session keeps up to five pending challenges, so sign-in pages open in several tabs keep working. Each response is matched to the challenge it signed, and that challenge is removed whether verification succeeds or fails.

### Managing Passkeys

Credential storage belongs to your app, so listing, renaming, and revoking passkeys are ordinary database operations scoped to the signed-in user. To revoke a passkey, delete its stored credential. `findCredential()` then returns `null`, and later sign-ins with that passkey fail with `credential_not_found`. The passkey stays in the user's password manager until they remove it there.

### Handling Failures

The finish helpers return `{ ok: true, credential }` or `{ ok: false, error: { code, message } }` for responses they reject, so routes can render their own messages. They throw only for programming errors, such as missing session middleware, and for errors thrown by your `challengeStore` or `findCredential()`.

| Code                     | Meaning                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `invalid_response`       | The response is malformed or inconsistent                                 |
| `challenge_missing`      | No challenge pending in this session matches the response                 |
| `challenge_expired`      | The challenge is older than the provider `timeout`                        |
| `challenge_consumed`     | The challenge was already used, including by a concurrent request         |
| `origin_mismatch`        | The response came from an unexpected origin or a cross-origin frame       |
| `rp_id_mismatch`         | The passkey is scoped to a different relying party                        |
| `user_not_present`       | The authenticator did not confirm user presence                           |
| `user_not_verified`      | `userVerification: 'required'` is set and the user was not verified       |
| `user_mismatch`          | The passkey or challenge belongs to a different account                   |
| `unsupported_algorithm`  | The passkey uses an algorithm other than ES256, EdDSA (Ed25519), or RS256 |
| `credential_exists`      | The passkey is already registered                                         |
| `credential_not_found`   | The passkey is unknown or was revoked                                     |
| `credential_not_allowed` | The passkey is not one of the `allowCredentials` for this sign-in         |
| `invalid_signature`      | The signature does not match the stored public key                        |
| `counter_regression`     | The signature counter did not increase, which can indicate a cloned key   |

Some codes, such as `credential_not_found`, are reported before the signature is checked, so they describe untrusted input. Use them to choose a helpful message, not to make security decisions.

The browser helpers never throw. They return `{ ok: false, error }` with one of these codes: `unsupported` when the browser or authenticator cannot run the request, `cancelled` when the user dismisses the prompt or it times out, `aborted` when your signal aborts it, `excluded_credential` when the authenticator already holds a passkey for the account, `security_error` when the browser blocks the request for this origin, `invalid_options` for malformed options, and `unknown_error` for anything else. `error.cause` holds the original browser error.

### User Verification

`userVerification` defaults to `'preferred'`. Authenticators verify the user with biometrics or a PIN when they can, but a security key without a PIN can still sign in with a touch. Set `userVerification: 'required'` to reject passkeys that did not verify the user, which makes every passkey sign-in multi-factor.

### Synced Passkeys

Most passkeys sync through a password manager. Synced passkeys report `backupEligible: true`, and `backedUp` reflects their current backup state. Synced passkeys always report a signature counter of `0`, so counter checks only apply to authenticators that count sign-ins.

### Account Recovery

A user who loses every device and password manager that holds their passkeys cannot sign in with them. Keep another way to sign in, such as an email link, password, or social login, and treat recovery as a separate flow that verifies ownership of the account before the user registers a new passkey.

### Verification Details

- Challenges are 32 random bytes and expire after the provider `timeout`, which defaults to 5 minutes.
- Registration requests `attestation: 'none'`. Attestation statements are accepted without verification, because the server trusts the authenticator data rather than the authenticator model.
- Registration offers EdDSA (Ed25519), ES256, and RS256 keys and requires discoverable credentials. RS256 keys must be 2048 to 4096 bits.
- Sign-in checks that the returned user handle matches the credential owner and that the credential's backup eligibility has not changed.

## Related Packages

- [`auth-middleware`](../auth-middleware/README.md) - Request authentication and route protection helpers
- [`form-data-middleware`](../form-data-middleware/README.md) - Form body parsing for `createCredentialsAuthProvider()` and passkey routes
- [`session-middleware`](../session-middleware/README.md) - Request-scoped session loading and persistence
- [`session`](../session/README.md) - Session data model and storage backends
- [`fetch-router`](../fetch-router/README.md) - Router and middleware runtime

## Related Work

- [OAuth 2.0](https://oauth.net/2/)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/)
- [passkeys.dev](https://passkeys.dev/)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
