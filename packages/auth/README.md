# auth

A web standards-based authentication library for JavaScript applications. This package provides core authentication primitives including password hashing, user management, and session-based authentication.

## Features

- **Password Authentication:** Secure password hashing and verification using Web Crypto API (PBKDF2)
- **Custom Password Algorithms:** Support for custom hashing/verification functions
- **Password Reset Flow:** Built-in token-based password reset functionality
- **Session Integration:** Works seamlessly with `@remix-run/session`
- **Web Standards:** Built on web platform APIs (no Node.js coupling)
- **Type-Safe:** Full TypeScript support with strict error types

## Installation

```sh
npm install @remix-run/auth @remix-run/session @remix-run/cookie
```

## Usage

### Basic Setup

```ts
import { createAuthClient } from '@remix-run/auth'
import { createCookie } from '@remix-run/cookie'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'

let auth = createAuthClient({
  session: {
    cookie: createCookie('session', { secrets: ['s3cr3t'] }),
    storage: createCookieSessionStorage(),
  },
  storage: {
    user: {
      findById: async (id) => {
        // Look up user by ID in your database
        return database.users.findById(id)
      },
      findByEmail: async (email) => {
        // Look up user by email in your database
        return database.users.findByEmail(email)
      },
      create: async (data) => {
        // Create a new user in your database
        return database.users.create(data)
      },
    },
  },
})
```

### Sign Up

```ts
let result = await auth.signUp.password({
  email: 'user@example.com',
  password: 'secure-password',
})

if ('error' in result) {
  // Handle error (e.g., 'email_taken')
  console.error(result.error)
} else {
  // User created successfully
  auth.session.setUserId(session, result.user.id)
}
```

### Sign In

```ts
let result = await auth.signIn.password({
  email: 'user@example.com',
  password: 'user-password',
})

if ('error' in result) {
  // Handle error (e.g., 'invalid_credentials')
  console.error(result.error)
} else {
  // Authentication successful
  auth.session.setUserId(session, result.user.id)
}
```

### Get Current User

```ts
let user = await auth.getUser(session)
if (user) {
  console.log(user.id, user.email)
}
```

### Sign Out

```ts
auth.signOut(session)
```

### Password Reset

```ts
// Request password reset
let result = await auth.passwordReset.request('user@example.com')
if ('error' in result) {
  console.error(result.error) // 'user_not_found'
} else {
  let { token, user } = result
  // Send reset email with token to user.email
  sendEmail({
    to: user.email,
    subject: 'Reset your password',
    body: `Reset link: https://example.com/reset-password/${token}`,
  })
}

// Reset password with token
let result = await auth.passwordReset.reset(token, newPassword)
if ('error' in result) {
  console.error(result.error) // 'invalid_or_expired_token' or 'user_not_found'
} else {
  // Password reset successful
  console.log('Password reset for:', result.user.email)
}
```

## Custom Password Hashing

By default, auth uses PBKDF2 with 600,000 iterations. You can provide custom hashing functions:

```ts
import { scrypt } from 'node:crypto'

let auth = createAuthClient({
  // ... other config
  passwordAlgorithm: {
    async hash(password) {
      let salt = crypto.randomUUID()
      let hash = await new Promise((resolve, reject) => {
        scrypt(password, salt, 64, (err, derivedKey) => {
          if (err) reject(err)
          else resolve(derivedKey.toString('hex'))
        })
      })
      return `$scrypt$${salt}$${hash}`
    },
    async verify(password, hash) {
      let [, algorithm, salt, storedHash] = hash.split('$')
      if (algorithm !== 'scrypt') return false
      let derivedHash = await new Promise((resolve, reject) => {
        scrypt(password, salt, 64, (err, derivedKey) => {
          if (err) reject(err)
          else resolve(derivedKey.toString('hex'))
        })
      })
      return derivedHash === storedHash
    },
  },
})
```

## Type-Safe Error Handling

Each operation returns specific error types for precise error handling:

```ts
import type { SignInError, SignUpError, PasswordResetError } from '@remix-run/auth'

// Sign in errors
let result = await auth.signIn.password({ email, password })
if ('error' in result) {
  switch (result.error) {
    case 'invalid_credentials':
      console.log('Wrong email or password')
      break
  }
}

// Sign up errors
let result = await auth.signUp.password({ email, password })
if ('error' in result) {
  switch (result.error) {
    case 'email_taken':
      console.log('Email already registered')
      break
  }
}

// Password reset errors
let result = await auth.passwordReset.reset(token, newPassword)
if ('error' in result) {
  switch (result.error) {
    case 'invalid_or_expired_token':
      console.log('Reset link expired')
      break
    case 'user_not_found':
      console.log('User no longer exists')
      break
  }
}
```

## Integration with fetch-router

For automatic session management and request-scoped user context, use with [`@remix-run/auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware):

```ts
import { createRouter } from '@remix-run/fetch-router'
import { session } from '@remix-run/session-middleware'
import { createAuthMiddleware } from '@remix-run/auth-middleware'

let authMiddleware = createAuthMiddleware(auth)
let { getCurrentUser } = authMiddleware

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage), authMiddleware()],
})

router.get('/dashboard', () => {
  let user = getCurrentUser()
  if (!user) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    })
  }
  return new Response(`Welcome, ${user.email}!`)
})
```

## API Reference

### `createAuthClient(config)`

Creates an authentication client instance.

**Config:**

- `session.cookie` - Cookie configuration from `@remix-run/cookie`
- `session.storage` - Session storage from `@remix-run/session`
- `session.key` - (Optional) Session key for user ID (default: `'userId'`)
- `storage.user` - User storage adapter with `findById`, `findByEmail`, and `create` methods
- `passwordAlgorithm` - (Optional) Either `'pbkdf2'` (default) or custom `{ hash, verify }` functions

**Returns:** `AuthClient`

### `AuthClient`

- `signUp.password({ email, password })` - Create new user account
- `signIn.password({ email, password, rememberMe? })` - Authenticate user
- `getUser(session)` - Get current authenticated user
- `signOut(session)` - Clear authentication
- `passwordReset.request(email)` - Generate password reset token
- `passwordReset.reset(token, newPassword)` - Reset password with token
- `session.setUserId(session, userId)` - Set user ID in session
- `session.getUserId(session)` - Get user ID from session

### `hashPassword(password)` / `verifyPassword(password, hash)`

Low-level password hashing primitives using PBKDF2.

```ts
import { hashPassword, verifyPassword } from '@remix-run/auth'

let hash = await hashPassword('my-password')
let isValid = await verifyPassword('my-password', hash)
```

## Related Packages

- [`@remix-run/auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Router middleware for authentication
- [`@remix-run/session`](https://github.com/remix-run/remix/tree/main/packages/session) - Session management
- [`@remix-run/cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - Cookie handling
- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Web standards router

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
