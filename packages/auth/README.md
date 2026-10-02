# auth

Composable browser authentication primitives for Remix. Use this package to verify credentials on your own server, sign people in with magic links or one-time email codes, start external OAuth or OIDC redirects, finish provider callbacks, and write an app-owned auth record into the session. Pair it with [`remix/middleware/auth`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) when later requests need to resolve that session data into the current user and protect routes.

## Features

- Small, composable primitives: `verifyCredentials()`, `sendMagicLink()`, `verifyMagicLink()`, `sendEmailOTP()`, `verifyEmailOTP()`, `startExternalAuth()`, `finishExternalAuth()`, `refreshExternalAuth()`, and `completeAuth()`
- Passwordless email sign-in with single-use magic links and one-time codes, using your storage and your email service
- Built-in provider support for Google, Microsoft, Okta, Auth0, GitHub, Facebook, and X
- Module-scope provider configuration for boot-time validation and stable callback URLs
- App-owned session records so you decide what auth data to persist
- Shared session completion for credentials, email, and external auth flows
- Designed to pair with `remix/middleware/auth` for request-time auth resolution and route protection

## Installation

```sh
npm i remix
```

## Usage

`remix/auth` exposes these primitives:

- `verifyCredentials(provider, context)` parses submitted credentials and returns the authenticated result or `null`
- `sendMagicLink(provider, context, options)` issues a single-use sign-in link and passes it to your `sendEmail()` hook
- `verifyMagicLink(provider, context, options?)` consumes a link token and returns the verified email address or a failure code
- `sendEmailOTP(provider, context, options)` issues a one-time code and passes it to your `sendEmail()` hook
- `verifyEmailOTP(provider, context, options)` checks a submitted code and returns the verified email address or a failure code
- `startExternalAuth(provider, context, options?)` stores the in-progress OAuth transaction in the session and returns the provider redirect response
- `finishExternalAuth(provider, context, options?)` validates the callback, clears the stored transaction, and returns `{ result, returnTo? }`, including any provider tokens in `result.tokens`
- `refreshExternalAuth(provider, tokens)` exchanges a previously stored `refreshToken` for a fresh provider token bundle when the provider runtime supports refresh
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

## Email Auth

Use `createMagicLinkAuthProvider()` and `createEmailOTPAuthProvider()` for passwordless sign-in. A magic link signs the person in when they open it. An email OTP is a short code they type into your app, which works when they read email on their phone but sign in on their computer. Offer either flow or both.

Both providers take three things from your app:

- `storage`: persistent storage for pending links and codes
- `sendEmail()`: delivery through your own email service, templates, and sender
- your own user lookup: verification returns a normalized email address, and your route decides whether to sign in an existing user, create one, or link the address to an account

### Storage

Email auth stores pending credentials through a small key-value interface. Values are opaque strings. Link tokens are stored as SHA-256 hashes and codes as HMAC-SHA256 hashes, so the plain values never reach storage.

Two methods must be atomic:

- `take()` deletes and returns a value. When concurrent requests race for the same key, at most one of them may receive the value. This is what makes every link and code single-use.
- `add()` stores a value only when no unexpired value exists for the key, and returns whether it did. When concurrent requests race, at most one of them may store its value. This is what keeps the resend interval from being bypassed by parallel requests.

Use storage that every server instance shares, and treat `expiresAt` as the time after which a value may be deleted.

This example stores entries in a SQL table with `remix/data-table`:

```sql
create table email_auth_entries (
  key text primary key,
  value text not null,
  expires_at integer not null
);
```

```ts
import type { EmailAuthStorage } from 'remix/auth'
import { and, column as c, eq, lte, table } from 'remix/data-table'

let emailAuthEntries = table({
  name: 'email_auth_entries',
  primaryKey: ['key'],
  columns: {
    key: c.text().primaryKey(),
    value: c.text().notNull(),
    expires_at: c.integer().notNull(),
  },
})

let emailAuthStorage: EmailAuthStorage = {
  async get(key) {
    let entry = await db.find(emailAuthEntries, { key })
    return entry?.value ?? null
  },
  async set(key, value, expiresAt) {
    await db.deleteMany(emailAuthEntries, { where: lte('expires_at', Date.now()) })
    await db.query(emailAuthEntries).upsert({ key, value, expires_at: expiresAt.getTime() })
  },
  async add(key, value, expiresAt) {
    await db.deleteMany(emailAuthEntries, {
      where: and(eq('key', key), lte('expires_at', Date.now())),
    })

    // An empty update compiles to `on conflict do nothing`, so only one request can insert the key.
    let result = await db
      .query(emailAuthEntries)
      .upsert({ key, value, expires_at: expiresAt.getTime() }, { update: {} })
    return result.affectedRows === 1
  },
  async take(key) {
    let entry = await db.find(emailAuthEntries, { key })
    if (entry == null) {
      return null
    }

    // Only one request can delete this exact row, so only one request receives the value.
    let result = await db.deleteMany(emailAuthEntries, { where: { key, value: entry.value } })
    return result.affectedRows === 1 ? entry.value : null
  },
}
```

With Redis, `set()` maps to `SET` with an expiry, `add()` to `SET` with `NX` and an expiry, and `take()` to `GETDEL`.

### Magic Links

Starting from the same `session()`, `formData()`, and `auth()` setup as the credentials example above, a magic link flow uses three routes: one to send the link, a confirmation page the link opens, and a `POST` handler that verifies the link and completes the session.

```ts
import {
  completeAuth,
  createMagicLinkAuthProvider,
  sendMagicLink,
  verifyMagicLink,
} from 'remix/auth'
import { redirect } from 'remix/response/redirect'
import { form, route } from 'remix/routes'

let routes = route({
  auth: {
    email: {
      login: form('/login/email'),
      verify: form('/login/email/verify'),
    },
    code: {
      login: form('/login/code'),
      verify: form('/login/code/verify'),
    },
  },
  app: {
    dashboard: '/dashboard',
  },
})

let magicLinkProvider = createMagicLinkAuthProvider({
  storage: emailAuthStorage,
  verifyUrl: new URL(routes.auth.email.verify.index.href(), env.APP_ORIGIN),
  async sendEmail({ email, url, expiresAt }) {
    await mailer.send({
      to: email,
      subject: 'Your sign-in link',
      text: `Sign in: ${url}\nThis link expires at ${expiresAt.toUTCString()}.`,
    })
  },
})

router.post(routes.auth.email.login.action, async (context) => {
  let formData = context.get(FormData)
  let result = await sendMagicLink(magicLinkProvider, context, {
    email: String(formData.get('email') ?? ''),
    returnTo: context.url.searchParams.get('returnTo'),
  })

  if (result.status === 'failure' && result.code === 'invalid_email') {
    return new Response('Enter a valid email address.', { status: 400 })
  }

  return new Response('Check your email for a sign-in link.')
})

router.get(
  routes.auth.email.verify.index,
  () =>
    new Response('<form method="post"><button type="submit">Sign in</button></form>', {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Referrer-Policy': 'no-referrer',
      },
    }),
)

router.post(routes.auth.email.verify.action, async (context) => {
  let result = await verifyMagicLink(magicLinkProvider, context)

  if (result.status === 'failure') {
    return new Response('This sign-in link is invalid or has expired.', { status: 400 })
  }

  let user = (await users.getByEmail(result.email)) ?? (await users.create({ email: result.email }))
  let session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return redirect(result.returnTo ?? routes.app.dashboard.href())
})
```

The link points at `verifyUrl` with a `token` search param. `verifyMagicLink()` reads the token from the current request URL, so the confirmation form can post back to the same URL. Pass `{ token }` to verify a token from somewhere else, such as a hidden form field.

Configure `verifyUrl` as an absolute URL instead of building it from the request's `Host` header. Otherwise a forged header could send someone a link that delivers their token to another site.

### Email OTP

The email OTP flow uses the `code` routes from the magic link example. The provider also needs a server-side `secret`, which it uses to HMAC codes before storing them. A 6-digit code has only a million possible values, so a plain hash could be reversed from leaked storage in milliseconds.

```ts
import { completeAuth, createEmailOTPAuthProvider, sendEmailOTP, verifyEmailOTP } from 'remix/auth'
import { redirect } from 'remix/response/redirect'
import { Session } from 'remix/session'

let emailOTPProvider = createEmailOTPAuthProvider({
  storage: emailAuthStorage,
  secret: env.EMAIL_OTP_SECRET,
  async sendEmail({ email, code, expiresAt }) {
    await mailer.send({
      to: email,
      subject: `Your sign-in code is ${code}`,
      text: `Enter ${code} to sign in. This code expires at ${expiresAt.toUTCString()}.`,
    })
  },
})

router.post(routes.auth.code.login.action, async (context) => {
  let email = String(context.get(FormData).get('email') ?? '')
  let result = await sendEmailOTP(emailOTPProvider, context, { email })

  if (result.status === 'failure' && result.code === 'invalid_email') {
    return new Response('Enter a valid email address.', { status: 400 })
  }

  context.get(Session).set('pendingEmail', email)
  return redirect(routes.auth.code.verify.index.href())
})

router.post(routes.auth.code.verify.action, async (context) => {
  let result = await verifyEmailOTP(emailOTPProvider, context, {
    email: String(context.get(Session).get('pendingEmail') ?? ''),
    code: String(context.get(FormData).get('code') ?? ''),
  })

  if (result.status === 'failure') {
    return new Response('That code is not valid.', { status: 400 })
  }

  let user = (await users.getByEmail(result.email)) ?? (await users.create({ email: result.email }))
  let session = completeAuth(context)
  session.unset('pendingEmail')
  session.set('auth', { userId: user.id })

  return redirect(routes.app.dashboard.href())
})
```

Codes are 6 digits by default. Set `codeLength` from 6 to 12 for longer codes. `verifyEmailOTP()` ignores spaces and hyphens, so `123 456` and `123-456` both match `123456`.

### Expiry, Resends, and Attempts

| Option           | Magic link     | Email OTP     |
| ---------------- | -------------- | ------------- |
| `expiresIn`      | `900` seconds  | `600` seconds |
| `resendInterval` | `60` seconds   | `60` seconds  |
| `maxAttempts`    | not applicable | `3`           |
| `codeLength`     | not applicable | `6`           |

- Each address has at most one live credential per provider. Sending a new link or code replaces the earlier one, and the earlier one stops working. A new code also gets a fresh attempt count.
- Requests made before `resendInterval` has passed return a `rate_limited` failure with `retryAfter`, and no email is sent. The interval holds when requests arrive in parallel, because only one of them can claim it with `add()`.
- If `sendEmail()` throws, the new credential is discarded, the earlier one keeps working, and the person can try again right away.
- Every incorrect code counts toward `maxAttempts`. After the last attempt the code is locked and verification returns `too_many_attempts` until a new code is sent.
- Each check takes the stored code with `take()` before comparing, so concurrent requests cannot share one attempt, and a link or code can be redeemed at most once.

These limits apply to each code. Because a new code starts with a fresh attempt count, someone who keeps requesting codes for an address can keep guessing: with the defaults, about 3 guesses a minute. Add a per-address limit over a longer window with `checkRateLimit()` so guessing stays bounded across resends. It runs before a credential is sent and before an email OTP code is checked. Return `false` to reject the request with a `rate_limited` failure.

```ts
let emailOTPProvider = createEmailOTPAuthProvider({
  storage: emailAuthStorage,
  secret: env.EMAIL_OTP_SECRET,
  sendEmail,
  async checkRateLimit({ action, email }) {
    // For example, allow 5 sends and 10 code checks per address per hour.
    let limit = action === 'send' ? 5 : 10
    return rateLimiter.consume(`email-otp:${action}:${email}`, { limit, window: 60 * 60 })
  },
})
```

Count with an atomic increment in shared storage, such as Redis `INCR` with an expiry, so parallel requests cannot slip past the limit. Pair per-address limits with per-IP limits in your app's middleware.

### Results

`sendMagicLink()` and `sendEmailOTP()` return `{ status: 'success', email, expiresAt }` with the normalized address, or `{ status: 'failure', code }`:

- `invalid_email`: the address is malformed or outside the accepted form. Addresses are trimmed, lowercased, and limited to ASCII letters, digits, `.`, `_`, `'`, `+`, and `-` before the `@`, with a dotted domain name. Characters such as `%`, `!`, quotes, and encoded words are rejected because some mail servers route or decode them to a different mailbox than the one the app verified. Convert internationalized domains to punycode before sending.
- `rate_limited`: the resend interval or `checkRateLimit()` rejected the request; `retryAfter` is set for resend intervals

`verifyMagicLink()` returns `{ status: 'success', provider, email, returnTo? }` or `{ status: 'failure', code }`:

- `invalid_token`: the token is malformed, unknown, already used, or replaced by a newer link
- `expired_token`: the link is past its expiry

`verifyEmailOTP()` returns `{ status: 'success', provider, email }` or `{ status: 'failure', code }`:

- `invalid_code`: the code is wrong, malformed, already used, or replaced by a newer code; `attemptsRemaining` is set after a wrong code
- `expired_code`: the code is past its expiry
- `too_many_attempts`: the code is locked after too many incorrect submissions
- `rate_limited`: `checkRateLimit()` rejected the request

Storage that deletes values at `expiresAt` reports expired credentials as `invalid_token` or `invalid_code`.

### Security Notes

- **Account enumeration:** call `sendMagicLink()` or `sendEmailOTP()` for every valid address and return the same response either way. Decide inside `sendEmail()` whether to deliver, for example by skipping unknown addresses for sign-in-only apps. Resend intervals and attempt limits then behave the same for every address. If sending inline makes responses slower for real accounts, queue delivery instead.
- **Email link scanners:** security scanners and mail previews often fetch links in emails. Render a confirmation page for `GET` requests and call `verifyMagicLink()` only from the `POST` handler, so a scanner cannot use up a link.
- **Cross-browser redemption:** a magic link is a bearer credential. Whichever browser submits it is signed in, even if a different browser requested it. Someone who requests a link on their computer and opens it on their phone is signed in on the phone. Offer email OTP for that case. If a link opened elsewhere should not sign in silently, store the requested address in the session when sending and compare it with `result.email` before calling `completeAuth()`.
- **Redirects:** `returnTo` is normalized and stored with the link on the server, never in the URL. Only local paths are kept, and `verifyMagicLink()` checks the stored value again before returning it.
- **Referrer leaks:** send `Referrer-Policy: no-referrer` from the confirmation page so the token in its URL is not sent to other origins.
- **Sessions:** call `completeAuth()` after a successful verification. It rotates the session id before you write the auth record.

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

## Related Packages

- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Request authentication and route protection helpers
- [`form-data-middleware`](https://github.com/remix-run/remix/tree/main/packages/form-data-middleware) - Form body parsing for `createCredentialsAuthProvider()` routes
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Request-scoped session loading and persistence
- [`session`](https://github.com/remix-run/remix/tree/main/packages/session) - Session data model and storage backends
- [`data-table`](https://github.com/remix-run/remix/tree/main/packages/data-table) - SQL tables you can use to back `EmailAuthStorage`
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router and middleware runtime

## Related Work

- [OAuth 2.0](https://oauth.net/2/)
- [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
