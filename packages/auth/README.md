# @remix-run/auth

A web standards-based authentication library for JavaScript applications.

## Features

- **Password Authentication** - Secure password hashing with PBKDF2 (Web Crypto API)
- **OAuth Integration** - GitHub and extensible provider system
- **Email Verification** - JWT-based verification with customizable emails
- **Session Integration** - Works with `@remix-run/session`
- **Type-Safe** - Full TypeScript with discriminated unions for error handling
- **Schema Export** - Introspectable data model for database integration
- **Feature-Based** - Enable only what you need (password, OAuth, email verification)

## Installation

```bash
npm install @remix-run/auth @remix-run/session @remix-run/cookie
```

## Quick Start

```ts
import { createAuthClient } from '@remix-run/auth'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'

let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: createMemoryStorageAdapter(),
  password: {
    enabled: true,
    sendReset: ({ user, token, url }) => {
      // Send password reset email
    },
  },
})
```

## Configuration

### Full Example

```ts
import { createAuthClient } from '@remix-run/auth'
import { createFsStorageAdapter } from '@remix-run/auth/storage-adapters/fs'
import { createGitHubOAuthProvider } from '@remix-run/auth/oauth-providers/github'

let authClient = createAuthClient({
  // Required: Secret for signing tokens
  secret: process.env.AUTH_SECRET!,

  // Required: Storage adapter
  storage: createFsStorageAdapter('./data/auth.json'),

  // Optional: Path for auth API routes (default: '/_auth')
  authBasePath: '/api/auth',

  // Optional: Lifecycle hooks
  hooks: {
    onUserCreated: (user) => {
      console.log('New user:', user.email)
    },
  },

  // Password authentication
  password: {
    enabled: true,
    sendReset: ({ user, token, url }) => {
      sendEmail({
        to: user.email,
        subject: 'Reset your password',
        body: `Click here to reset: ${url}`,
      })
    },
  },

  // OAuth authentication
  oauth: {
    enabled: true,
    providers: {
      github: createGitHubOAuthProvider({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      }),
    },
  },

  // Email verification
  emailVerification: {
    enabled: true,
    sendVerification: ({ user, url, isNewUser }) => {
      sendEmail({
        to: user.email,
        subject: isNewUser ? 'Welcome! Verify your email' : 'Verify your email',
        body: `Click here to verify: ${url}`,
      })
    },
    onVerified: (user) => {
      console.log('Email verified:', user.email)
    },
    successURL: '/',
    errorURL: '/login',
  },
})
```

### Base URL

By default, `baseURL` is inferred from the request origin (including non-standard ports). You need to configure it explicitly if:

- **Using email verification** - Verification emails are sent during signup hooks which run without request context
- You need dynamic URLs based on the request (e.g., multi-tenant apps)

```ts
// Static URL (required for email verification)
baseURL: 'https://myapp.com'

// Dynamic (e.g., multi-tenant)
baseURL: (request) => new URL(request.url).origin
```

### Reverse Proxy Support

When running behind a reverse proxy (Nginx, Cloudflare, AWS ALB, etc.), the request URL seen by your app differs from the public URL. Enable `trustProxyHeaders` to infer the base URL from `x-forwarded-host` and `x-forwarded-proto` headers:

```ts
createAuthClient({
  trustProxyHeaders: true,
  // ...
})
```

⚠️ **Security Warning:** Only enable this if your app is behind a trusted proxy. These headers can be spoofed by malicious clients if your app is directly exposed to the internet.

### Rate Limiting

Rate limiting is enabled by default and uses IP-based limiting. Configure which header contains the client IP:

```ts
createAuthClient({
  rateLimit: {
    // Headers to check for client IP (in order of priority)
    // Default: ['x-forwarded-for']
    ipAddressHeaders: ['cf-connecting-ip'], // Cloudflare example

    // Default limits (per IP per operation)
    window: 60, // seconds
    max: 100, // requests per window

    // Override for specific operations
    rules: {
      'password.signIn': { window: 60, max: 5 },
      'password.*': { window: 60, max: 10 },
      '*.signIn': { window: 60, max: 5 },
    },
  },
})
```

⚠️ Only include headers that your server or reverse proxy sets. Headers not set by your proxy can be spoofed by malicious clients.

## Password Authentication

### Sign Up

```ts
let result = await authClient.password.signUp({
  request,
  session,
  email: 'user@example.com',
  password: 'secure-password',
  name: 'Jane Doe',
})

if (result.type === 'error') {
  switch (result.code) {
    case 'email_taken':
      return 'An account with this email already exists'
  }
} else {
  // User created and signed in
  console.log('Welcome:', result.data.user.name)
}
```

### Sign In

```ts
let result = await authClient.password.signIn({
  request,
  session,
  email: 'user@example.com',
  password: 'user-password',
})

if (result.type === 'error') {
  switch (result.code) {
    case 'invalid_credentials':
      return 'Invalid email or password'
  }
} else {
  // User signed in
  redirect('/dashboard')
}
```

### Password Reset

```ts
// Request reset (sends email via sendReset callback)
let result = await authClient.password.getResetToken({
  request,
  email: 'user@example.com',
})

if (result.type === 'error') {
  // 'user_not_found'
}

// Complete reset (user submits new password)
let result = await authClient.password.reset({
  request,
  session,
  token: tokenFromEmail,
  newPassword: 'new-secure-password',
})

if (result.type === 'error') {
  // 'invalid_or_expired_token' | 'user_not_found'
}
```

### Change Password

```ts
let result = await authClient.password.change({
  request,
  session,
  currentPassword: 'old-password',
  newPassword: 'new-password',
})

if (result.type === 'error') {
  // 'not_authenticated' | 'invalid_password'
}
```

### Add Password to Existing Account

```ts
// Check if user has a password via getAccounts
let accounts = await authClient.getAccounts(userId)
let hasPassword = accounts.some((a) => a.strategy === 'password')

if (!hasPassword) {
  // User signed up via OAuth, let them add a password
  let result = await authClient.password.set({
    request,
    session,
    password: 'new-password',
  })
}
```

## OAuth Authentication

### Configuration

```ts
import { createAuthClient } from '@remix-run/auth'
import { createGitHubOAuthProvider } from '@remix-run/auth/oauth-providers/github'

let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: createMemoryStorageAdapter(),
  oauth: {
    enabled: true,
    providers: {
      github: createGitHubOAuthProvider({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        scopes: ['user:email'],
      }),
    },
  },
})
```

### Rendering Sign-In Buttons

```tsx
{
  Object.values(authClient.oauth.providers).map((provider) => {
    let form = provider.getSignInForm({
      callbackURL: '/dashboard',
      errorCallbackURL: '/login',
    })
    return (
      <form key={provider.name} method={form.method} action={form.action}>
        {form.inputs.map((input) => (
          <input key={input.name} type="hidden" name={input.name} value={input.value} />
        ))}
        <button type="submit">Continue with {provider.displayName}</button>
      </form>
    )
  })
}
```

### Reading OAuth Results

After OAuth redirect, read the result using flash messages:

```ts
let flash = authClient.oauth.getFlash(session)

if (flash?.type === 'success') {
  // flash.code is 'sign_in' | 'sign_up' | 'account_linked'
}

if (flash?.type === 'error') {
  switch (flash.code) {
    case 'access_denied':
      return 'You cancelled the sign in'
    case 'account_exists_unverified_email':
      return 'An account exists but email is unverified'
  }
}
```

### Accessing Third-Party APIs

Get an access token to use with provider APIs:

```ts
let result = await authClient.oauth.github.getAccessToken({ userId: user.id })

if (result.type === 'success') {
  let response = await fetch('https://api.github.com/user/repos', {
    headers: { Authorization: `Bearer ${result.data.accessToken}` },
  })
}
```

## Email Verification

### Configuration

```ts
let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: createMemoryStorageAdapter(),
  emailVerification: {
    enabled: true,
    sendVerification: ({ user, url, isNewUser }) => {
      // Send verification email
      // url is the full verification URL
      // isNewUser helps customize the message
    },
    onVerified: (user) => {
      // Called after successful verification
    },
    expiresIn: 3600, // Token expiry in seconds (default: 1 hour)
    successURL: '/',
    errorURL: '/login',
  },
  // ...
})
```

### Manual Verification Request

```ts
// User requests a new verification email
let result = await authClient.emailVerification.requestVerification({ request, email })

if (result.type === 'error') {
  // 'user_not_found' | 'already_verified'
}
```

### Reading Verification Results

```ts
let flash = authClient.emailVerification.getFlash(session)

if (flash?.type === 'success') {
  return 'Your email has been verified!'
}

if (flash?.type === 'error') {
  switch (flash.code) {
    case 'invalid_or_expired_token':
      return 'Link expired, please request a new one'
  }
}
```

## Session Management

### Get Current User

```ts
let user = await authClient.getUser(session)

if (user) {
  console.log(user.id, user.email, user.name)
}
```

### Sign Out

```ts
await authClient.signOut(session)
```

## Middleware Integration

Use with `@remix-run/auth-middleware` for automatic session loading:

```ts
import { createRouter } from '@remix-run/fetch-router'
import { session } from '@remix-run/session-middleware'
import { createCookie } from '@remix-run/cookie'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'
import { createAuthMiddleware } from '@remix-run/auth-middleware'

let sessionCookie = createCookie('session', { secrets: ['s3cr3t'] })
let sessionStorage = createMemorySessionStorage()

let { auth, getUser } = createAuthMiddleware(authClient)

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage), auth],
})

// The auth middleware automatically handles API routes
// at authClient.authBasePath (e.g., /api/auth/oauth/sign-in/github)

router.get('/dashboard', () => {
  let user = getUser() // Synchronous access
  if (!user) {
    return redirect('/login')
  }
  return new Response(`Welcome, ${user.name}!`)
})
```

## Storage Adapters

### Memory Storage (Testing/Development)

```ts
import { createAuthClient } from '@remix-run/auth'
import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'

let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: createMemoryStorageAdapter(),
  // ...
})
```

### File System Storage (Development)

```ts
import { createAuthClient } from '@remix-run/auth'
import { createFsStorageAdapter } from '@remix-run/auth/storage-adapters/fs'

let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: createFsStorageAdapter('./data/auth.json'),
  // ...
})
```

### Custom Storage Adapter

Implement the `Storage` interface:

```ts
import { createAuthClient, type Storage } from '@remix-run/auth'

let authClient = createAuthClient({
  secret: process.env.AUTH_SECRET!,
  storage: {
    async findOne({ model, where }) {
      // Find one record matching all where conditions
    },
    async findMany({ model, where }) {
      // Find all records matching where conditions
    },
    async create({ model, data }) {
      // Create and return new record with generated id
    },
    async update({ model, where, data }) {
      // Update matching record, return updated record
    },
    async delete({ model, where }) {
      // Delete matching record, return true if deleted
    },
  },
  // ...
})
```

## Schema Introspection

```ts
let schema = authClient.schema
// {
//   models: [
//     { name: 'authUser', fields: { id, email, name, ... } },
//     { name: 'authAccount', fields: { id, userId, strategy, ... } },
//   ]
// }
```

## Related Packages

- [`@remix-run/auth-middleware`](../auth-middleware) - Router middleware
- [`@remix-run/session`](../session) - Session management
- [`@remix-run/cookie`](../cookie) - Cookie handling
- [`@remix-run/fetch-router`](../fetch-router) - Web standards router

## License

MIT
