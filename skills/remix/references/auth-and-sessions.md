# Authentication and Sessions

## Session Setup

### Create a session cookie

```typescript
import { createCookie } from 'remix/cookie'

export let sessionCookie = createCookie('session', {
  secrets: [process.env.SESSION_SECRET ?? 's3cr3t'],
  httpOnly: true,
  sameSite: 'Lax',
  maxAge: 2592000, // 30 days
  path: '/',
})
```

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

  if (auth.identity) {
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
  createGoogleAuthProvider,
  createGitHubAuthProvider,
  startExternalAuth,
  finishExternalAuth,
  completeAuth,
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
```

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

## Protecting Routes

### Controller-level protection

Apply `requireAuth()` to an entire controller subtree:

```typescript
import { requireAuth } from 'remix/auth-middleware'

export default {
  middleware: [requireAuth()],
  actions: {
    index() { /* guaranteed authenticated */ },
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
    index() { /* requires auth + admin */ },
  },
} satisfies Controller<typeof routes.admin>
```

### Action-level protection

Apply middleware to a single route:

```typescript
router.get(routes.account, {
  middleware: [requireAuth],
  handler(context) {
    let auth = context.get(Auth)
    return render(<AccountPage identity={auth.identity} />)
  },
})
```

### Custom requireAuth with redirect

```typescript
import { redirect } from 'remix/response/redirect'
import { Auth } from 'remix/auth-middleware'

export function requireAuth() {
  return (context, next) => {
    let auth = context.get(Auth)
    if (!auth.identity) {
      let returnTo = encodeURIComponent(context.url.pathname)
      return redirect(routes.auth.login.href() + `?returnTo=${returnTo}`)
    }
    return next()
  }
}
```
