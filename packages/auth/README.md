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
    successURL: '/',
    errorURL: '/login',
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

## Password Authentication

### Sign Up

```ts
let result = await authClient.password.signUp({
  session,
  email: 'user@example.com',
  password: 'secure-password',
  name: 'Jane Doe',
})

if ('error' in result) {
  switch (result.error) {
    case 'email_taken':
      return 'An account with this email already exists'
  }
} else {
  // User created and signed in
  console.log('Welcome:', result.user.name)
}
```

### Sign In

```ts
let result = await authClient.password.signIn({
  session,
  email: 'user@example.com',
  password: 'user-password',
})

if ('error' in result) {
  switch (result.error) {
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
let result = await authClient.password.requestReset('user@example.com')

if ('error' in result) {
  // 'user_not_found'
}

// Complete reset (user submits new password)
let result = await authClient.password.reset({
  session,
  token: tokenFromEmail,
  newPassword: 'new-secure-password',
})

if ('error' in result) {
  // 'invalid_or_expired_token' | 'user_not_found'
}
```

### Change Password

```ts
let result = await authClient.password.change({
  session,
  currentPassword: 'old-password',
  newPassword: 'new-password',
})

if ('error' in result) {
  // 'not_authenticated' | 'invalid_password'
}
```

### Add Password to OAuth Account

```ts
// Check if user has a password
let hasPassword = await authClient.password.hasPassword(userId)

if (!hasPassword) {
  // User signed up via OAuth, let them add a password
  let result = await authClient.password.set({
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
    successURL: '/dashboard',
    newUserURL: '/welcome', // Optional: redirect new users here
    errorURL: '/login',
  },
})
```

### Rendering Sign-In Links

```tsx
// Each provider has everything needed for UI rendering
{
  Object.values(authClient.oauth.providers).map((provider) => (
    <a key={provider.name} href={provider.signInHref}>
      Continue with {provider.displayName}
    </a>
  ))
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
let result = await authClient.emailVerification.requestVerification(email)

if ('error' in result) {
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
// at authClient.authBasePath (e.g., /api/auth/oauth/github)

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

Access the data schema for ORM integration:

```ts
let schema = authClient.schema
// {
//   models: [
//     { name: 'user', fields: { id, email, name, ... } },
//     { name: 'password', fields: { userId, hashedPassword } },
//     { name: 'oauthAccount', fields: { userId, provider, ... } },
//   ]
// }
```

## User Type

The base `AuthUser` type includes:

```ts
interface AuthUser {
  id: string
  email: string
  name: string
  image?: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Error Types

All operations return discriminated unions with specific error codes:

```ts
// Password errors
type PasswordSignInErrorCode = 'invalid_credentials'
type PasswordSignUpErrorCode = 'email_taken'
type PasswordChangeErrorCode = 'not_authenticated' | 'invalid_password'
type PasswordSetErrorCode = 'not_authenticated' | 'password_already_set'
type PasswordResetRequestErrorCode = 'user_not_found'
type PasswordResetCompleteErrorCode = 'invalid_or_expired_token' | 'user_not_found'

// OAuth errors
type OAuthSignInErrorCode =
  | 'provider_not_found'
  | 'access_denied'
  | 'invalid_state'
  | 'account_exists_unverified_email'
  | ...

// Email verification errors
type EmailVerificationRequestErrorCode = 'user_not_found' | 'already_verified'
type EmailVerificationCompleteErrorCode = 'invalid_or_expired_token' | 'user_not_found'
```

## Custom OAuth Providers

Create custom OAuth providers:

```ts
import type { OAuthProvider } from '@remix-run/auth'

let myProvider: OAuthProvider = {
  name: 'my-provider',
  displayName: 'My Provider',

  getAuthorizationUrl({ clientId, redirectUri, state, scopes }) {
    let url = new URL('https://provider.com/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    url.searchParams.set('scope', scopes.join(' '))
    return url.toString()
  },

  async exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
    // Exchange code for access token
    return { accessToken, refreshToken, expiresIn }
  },

  async getUserProfile({ accessToken }) {
    // Fetch user profile
    return { id, email, name, avatarUrl, emailVerified }
  },
}
```

## Related Packages

- [`@remix-run/auth-middleware`](../auth-middleware) - Router middleware
- [`@remix-run/session`](../session) - Session management
- [`@remix-run/cookie`](../cookie) - Cookie handling
- [`@remix-run/fetch-router`](../fetch-router) - Web standards router

## License

MIT
