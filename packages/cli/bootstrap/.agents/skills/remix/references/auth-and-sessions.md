# Authentication and Sessions

## What This Covers

How to remember things about a browser between requests and how to identify a user. Read this when
the task involves:

- Storing per-browser state across requests (login, cart, "I have submitted this form")
- Adding a credentials login flow or an OAuth provider
- Protecting routes with `requireAuth()` or stacking authorization checks
- Reading or writing `Session`, `Auth`, or other identity-related context values
- Logging in, logging out, or rotating session IDs

For raw cookies that are not session-backed (theme, locale, dismissed-banner), see
`createCookie` in this file plus the broader `Package Map` in `SKILL.md`.

## Sessions vs Plain Cookies

Reach for `remix/session` when state is sensitive, must be tamper-resistant, or represents the
identity of a request: who is logged in, which form a browser already submitted, what items are in
a cart. Sessions sign or encrypt their backing cookie with a server-held secret and give you a
typed `Session` object you can `get`, `set`, `flash`, `unset`, and `regenerateId`.

Reach for `remix/cookie` directly when the browser is allowed to carry the value and the server
does not need session semantics. This often means preferences (theme, locale, dismissed banner),
but a signed cookie can also be fine for small low-risk values where you truly only need one
cookie-shaped fact and do not need `Session` helpers.

If a malicious user editing the value would be a bug, or if the value needs server-managed
lifecycle, reach for a session.

### Quick chooser

| Need                                                                | Best fit        | Why                                                |
| ------------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| Theme, locale, dismissed banner                                     | `remix/cookie`  | Browser-controlled preference                      |
| Small signed hint with minimal lifecycle                            | `remix/cookie`  | One value, no `Session` helpers needed             |
| "This browser already submitted", cart, flash messages, login state | `remix/session` | Tamper-sensitive, server-managed per-browser state |
| "One real person only", ownership, durable identity                 | account/auth    | Cookies or sessions alone do not prove personhood  |

## Session Setup

### Create a session cookie

```typescript
import { createCookie } from 'remix/cookie'

let sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('SESSION_SECRET is required')
}

export let sessionCookie = createCookie('session', {
  secrets: [sessionSecret ?? 'test-only-secret'],
  httpOnly: true,
  sameSite: 'Lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2592000, // 30 days
  path: '/',
})
```

The cookie should always be `httpOnly`, default to `sameSite: 'Lax'`, and be `secure` in
production. Demo defaults like `'s3cr3t'` are fine in tests but should never reach production —
fail fast when the secret is missing.

### Create session storage

```typescript
// Filesystem storage
import { createFsSessionStorage } from 'remix/session/fs-storage'
export let sessionStorage = createFsSessionStorage('./tmp/sessions')

// Memory storage (for tests)
import { createMemorySessionStorage } from 'remix/session/memory-storage'
export let sessionStorage = createMemorySessionStorage()
```

### Add session middleware

```typescript
import { session } from 'remix/session-middleware'

let router = createRouter({
  middleware: [
    session(sessionCookie, sessionStorage),
    // ... other middleware
  ],
})
```

### Using sessions in handlers

```typescript
import { Session } from 'remix/session'

async function handler({ get }) {
  let session = get(Session)

  // Read
  let userId = session.get('userId')

  // Write
  session.set('userId', 42)

  // Flash (read once, then cleared)
  session.flash('message', 'Settings saved!')
  let message = session.get('message') // returns and clears

  // Remove a key
  session.unset('userId')

  // Regenerate session ID (after login/logout)
  session.regenerateId(true)
}
```

### Sessions for non-auth state

Sessions are not just for login. They are the right place to store any tamper-sensitive
per-browser fact: which form a browser already submitted, how many free actions are left in a
trial, which feature flags a tester opted into, what items are in a cart.

```typescript
async function submit({ get }) {
  let session = get(Session)
  if (session.get('hasSubmitted')) {
    return render(<AlreadySubmittedPage />, { status: 409 })
  }

  let parsed = s.parseSafe(submitSchema, get(FormData))
  if (!parsed.success) {
    return render(<SubmitPage errors={parsed.issues} />, { status: 400 })
  }

  await saveSubmission(parsed.value)
  session.set('hasSubmitted', true)
  session.flash('message', 'Thanks for submitting!')

  return redirect(routes.thanks.href())
}
```

Notice that there is no manual `Set-Cookie` plumbing in the action — the session middleware handles
that, and the handler returns an ordinary `Response`. Per-browser state enforced this way is still
bypassable by clearing cookies; if the guarantee needs to survive that, you also need an account
(see auth providers below).

## Auth Middleware

### Basic setup

```typescript
import { auth, createSessionAuthScheme } from 'remix/auth-middleware'
import { Session } from 'remix/session'
import { Database } from 'remix/data-table'

export function loadAuth() {
  return auth({
    schemes: [
      createSessionAuthScheme({
        read(session) {
          let data = session.get('auth')
          return data ?? null
        },
        async verify(value, context) {
          let db = context.get(Database)
          return (await db.find(users, value.userId)) ?? null
        },
        invalidate(session) {
          session.unset('auth')
        },
      }),
    ],
  })
}
```

### Reading auth state

```typescript
import { Auth } from 'remix/auth-middleware'

function handler({ get }) {
  let auth = get(Auth)

  if (auth.ok) {
    // User is authenticated
    let user = auth.identity
  }
}
```

## Credentials Auth

### Define a credentials provider

```typescript
import { createCredentialsAuthProvider, verifyCredentials, completeAuth } from 'remix/auth'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

let loginSchema = f.object({
  email: f.field(s.defaulted(s.string(), '')),
  password: f.field(s.defaulted(s.string(), '')),
})

export let passwordProvider = createCredentialsAuthProvider({
  parse(context) {
    let formData = context.get(FormData)
    return s.parse(loginSchema, formData)
  },
  async verify({ email, password }, context) {
    let db = context.get(Database)
    let user = await db.findOne(users, { where: { email } })
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return null
    }
    return user
  },
})
```

### Login action

```typescript
import { verifyCredentials, completeAuth } from 'remix/auth'
import { redirect } from 'remix/response/redirect'

async action(context) {
  let user = await verifyCredentials(passwordProvider, context)

  if (user == null) {
    let session = context.get(Session)
    session.flash('error', 'Invalid email or password.')
    return redirect(routes.auth.login.href())
  }

  let session = completeAuth(context)
  session.set('auth', { userId: user.id })

  return redirect(routes.home.href())
},
```

### Logout action

```typescript
import { Session } from 'remix/session'
import { redirect } from 'remix/response/redirect'

function logout(context) {
  let session = context.get(Session)
  session.unset('auth')
  session.regenerateId(true)
  return redirect(routes.home.href())
}
```

## OAuth / External Auth

### Create providers

```typescript
import {
  createAtmosphereAuthProvider,
  createGoogleAuthProvider,
  createGitHubAuthProvider,
  startExternalAuth,
  finishExternalAuth,
  completeAuth,
  refreshExternalAuth,
} from 'remix/auth'

let googleProvider = createGoogleAuthProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.google.callback.href(), origin),
})

let githubProvider = createGitHubAuthProvider({
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  redirectUri: new URL(routes.auth.github.callback.href(), origin),
})

let atmosphereSessionSecret = process.env.ATMOSPHERE_SESSION_SECRET
if (!atmosphereSessionSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('ATMOSPHERE_SESSION_SECRET is required')
}

let atmosphereProvider = createAtmosphereAuthProvider({
  clientId: 'https://app.example.com/oauth/client-metadata.json',
  redirectUri: new URL(routes.auth.atmosphere.callback.href(), origin),
  sessionSecret: atmosphereSessionSecret ?? 'test-only-secret',
})
```

For Atmosphere-compatible atproto OAuth, create the provider once, call
`atmosphereProvider.prepare(handleOrDid)` before `startExternalAuth(...)`, then pass the same
module-scope provider to `finishExternalAuth(...)` and `refreshExternalAuth(...)`.

### OAuth controller

```typescript
export default {
  actions: {
    // GET /auth/google — redirect to Google
    async index(context) {
      return await startExternalAuth(googleProvider, context, {
        returnTo: context.url.searchParams.get('returnTo'),
      })
    },

    // GET /auth/google/callback — handle redirect back
    async callback(context) {
      let { result, returnTo } = await finishExternalAuth(googleProvider, context)

      let db = context.get(Database)
      let { user, authAccount } = await resolveExternalAuth(db, result)

      let session = completeAuth(context)
      session.set('auth', {
        userId: user.id,
        loginMethod: result.provider,
        authAccountId: authAccount.id,
      })

      return redirect(returnTo ?? routes.account.href())
    },
  },
} satisfies Controller<typeof routes.auth.google>
```

### Refresh stored provider tokens

Use `refreshExternalAuth(provider, tokens)` when an app has stored OAuth/OIDC tokens and needs a
fresh access token from a refresh token. Built-in OIDC providers, X, and Atmosphere support
refresh-token exchange. If the provider does not rotate the refresh token, the refreshed bundle
preserves the current one.

```typescript
async function refreshGoogleTokens({ get }) {
  let db = get(Database)
  let account = await db.findOne(authAccounts, { where: { provider: 'google' } })
  if (!account) return null

  let refreshed = await refreshExternalAuth(googleProvider, account.tokens)
  await db.update(authAccounts, account.id, { tokens: refreshed.tokens })

  return refreshed.tokens
}
```

## Protecting Routes

### Controller-level protection

Apply `requireAuth()` to an entire controller subtree:

```typescript
import { requireAuth } from 'remix/auth-middleware'

export default {
  middleware: [requireAuth()],
  actions: {
    index() {
      /* guaranteed authenticated */
    },
    settings: settingsController,
  },
} satisfies Controller<typeof routes.account>
```

### Stacking middleware

Combine auth checks with role checks:

```typescript
export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: {
    index() {
      /* requires auth + admin */
    },
  },
} satisfies Controller<typeof routes.admin>
```

### Action-level protection

Apply middleware to a single route:

```typescript
import { Auth, requireAuth } from 'remix/auth-middleware'

router.get(routes.account, {
  middleware: [requireAuth()],
  handler(context) {
    let auth = context.get(Auth)
    return render(<AccountPage identity={auth.identity} />)
  },
})
```

### Redirect on auth failure

```typescript
import { requireAuth } from 'remix/auth-middleware'
import { redirect } from 'remix/response/redirect'

export function requireAuthRedirect() {
  return requireAuth({
    onFailure(context) {
      let returnTo = encodeURIComponent(context.url.pathname)
      return redirect(routes.auth.login.href() + `?returnTo=${returnTo}`, 303)
    },
  })
}
```
