# @remix-run/session

Powerful, flexible session management for JavaScript applications with built-in support for flash messages, multiple storage backends, and type-safe session handling. `@remix-run/session` provides a clean, intuitive API for managing user sessions with comprehensive security features and runtime-agnostic design.

Sessions are fundamental to web applications—from user authentication and shopping carts to temporary messages and multi-step forms. While basic cookie handling can work for simple cases, real applications need robust session management with features like flash messages, secure storage, and flexible backends.

`@remix-run/session` solves this by offering:

- **Multiple Storage Backends:** Choose from cookie-based sessions (no server storage needed), in-memory storage (for development), or build custom storage adapters for databases and external services.
- **Flash Messages:** Built-in support for temporary values that automatically expire after one read—perfect for success messages, error notifications, and form validation feedback.
- **Type-Safe Session Data:** Full TypeScript support with generic interfaces for strongly-typed session and flash data.
- **Secure by Default:** Automatic warnings for unsigned cookies, secure cookie defaults, and protection against session tampering.
- **Custom Storage Strategies:** Extensible architecture allows you to implement any storage backend using the `SessionIdStorageStrategy` interface.
- **Web Standards Compliant:** Built on standard APIs, making it runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers).
- **Cookie Size Management:** Automatic validation and error handling for cookie size limits when using cookie storage.

Perfect for building secure, scalable session management in your JavaScript and TypeScript applications!

## Installation

```sh
npm install @remix-run/session
```

## Overview

The following should give you a sense of what kinds of things you can do with this library:

```ts
import {
  createCookieSessionStorage,
  createMemorySessionStorage,
  createSessionStorage,
} from '@remix-run/session'

// Cookie-based sessions (no server storage required)
let cookieStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    secrets: ['s3cr3t'], // Required for security
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
})

// Get session from request
let session = await cookieStorage.getSession(request.headers.get('Cookie'))

// Store regular session data
session.set('userId', '12345')
session.set('theme', 'dark')
session.set('cartItems', ['item1', 'item2'])

// Store flash messages (disappear after one read)
session.flash('successMessage', 'Profile updated successfully!')
session.flash('errorMessage', 'Invalid email address')

// Check if values exist
console.log(session.has('userId')) // true
console.log(session.has('successMessage')) // true

// Get values
console.log(session.get('userId')) // '12345'
console.log(session.get('successMessage')) // 'Profile updated successfully!'
console.log(session.get('successMessage')) // undefined (flash messages disappear)

// Commit session to Set-Cookie header
let setCookieHeader = await cookieStorage.commitSession(session)
response.headers.set('Set-Cookie', setCookieHeader)

// Memory-based sessions (for development/testing)
let memoryStorage = createMemorySessionStorage({
  cookie: {
    name: '__session',
    secrets: ['s3cr3t'],
    maxAge: 60 * 60 * 24, // 24 hours
  },
})

// Same API as cookie storage
let memorySession = await memoryStorage.getSession()
memorySession.set('user', { id: '123', name: 'Alice' })
let memorySetCookie = await memoryStorage.commitSession(memorySession)

// Destroy sessions
await cookieStorage.destroySession(session)
await memoryStorage.destroySession(memorySession)

// Session type checking
import { isSession } from '@remix-run/session'
console.log(isSession(session)) // true
console.log(isSession({})) // false
```

## Storage Types

### Cookie Sessions

Store all session data directly in encrypted cookies. No server-side storage required:

```ts
import { createCookieSessionStorage } from '@remix-run/session'

let storage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    secrets: ['secret1', 'secret2'], // Support secret rotation
    httpOnly: true, // Prevent XSS attacks
    secure: true, // HTTPS only
    sameSite: 'strict', // CSRF protection
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
})

// Automatic cookie size validation
try {
  let largeSession = await storage.getSession()
  largeSession.set('data', 'x'.repeat(5000)) // Very large data
  await storage.commitSession(largeSession) // Throws error if > 4KB
} catch (error) {
  console.log(error.message) // "Cookie length will exceed browser maximum"
}
```

### Memory Sessions

Simple in-memory storage, useful for development and testing:

```ts
import { createMemorySessionStorage } from '@remix-run/session'

let storage = createMemorySessionStorage({
  cookie: {
    name: '__session',
    secrets: ['dev-secret'],
    // Session ID stored in cookie, data stored in memory
  },
})

// Data persists across requests until server restart
let session = await storage.getSession()
session.set('user', { id: '123', role: 'admin' })
await storage.commitSession(session)

// Later request with same session ID
let sameSession = await storage.getSession(cookieHeader)
console.log(sameSession.get('user')) // { id: '123', role: 'admin' }
```

### Custom Storage

Implement your own storage backend using `createSessionStorage`:

```ts
import { createSessionStorage } from '@remix-run/session'

// Example: Database-backed session storage
let dbStorage = createSessionStorage({
  cookie: {
    name: '__session',
    secrets: ['db-secret'],
    secure: true,
    httpOnly: true,
  },
  async createData(data, expires) {
    // Create new session in database
    let id = await db.sessions.create({
      data: JSON.stringify(data),
      expires,
    })
    return id
  },
  async readData(id) {
    // Read session from database
    let session = await db.sessions.findById(id)
    if (!session || (session.expires && session.expires < new Date())) {
      return null
    }
    return JSON.parse(session.data)
  },
  async updateData(id, data, expires) {
    // Update session in database
    await db.sessions.update(id, {
      data: JSON.stringify(data),
      expires,
    })
  },
  async deleteData(id) {
    // Delete session from database
    await db.sessions.delete(id)
  },
})

// Example: Redis-backed session storage
let redisStorage = createSessionStorage({
  cookie: {
    name: '__session',
    secrets: [process.env.SESSION_SECRET],
  },
  async createData(data, expires) {
    let id = generateSessionId()
    let ttl = expires ? Math.floor((expires.getTime() - Date.now()) / 1000) : undefined
    await redis.setex(id, ttl || 86400, JSON.stringify(data))
    return id
  },
  async readData(id) {
    let data = await redis.get(id)
    return data ? JSON.parse(data) : null
  },
  async updateData(id, data, expires) {
    let ttl = expires ? Math.floor((expires.getTime() - Date.now()) / 1000) : 86400
    await redis.setex(id, ttl, JSON.stringify(data))
  },
  async deleteData(id) {
    await redis.del(id)
  },
})
```

## Flash Messages

Flash messages are perfect for one-time notifications:

```ts
// Set flash messages (they disappear after first read)
session.flash('success', 'Account created successfully!')
session.flash('error', 'Invalid password')
session.flash('info', 'Please verify your email')

// In your template/component
let successMessage = session.get('success') // 'Account created successfully!'
let errorMessage = session.get('error') // 'Invalid password'
let infoMessage = session.get('info') // 'Please verify your email'

// Second call returns undefined (messages are consumed)
let noMessage = session.get('success') // undefined

// Check if flash message exists before consuming
if (session.has('success')) {
  let message = session.get('success')
  console.log(message)
}

// Flash messages work alongside regular session data
session.set('userId', '123') // Persistent
session.flash('welcome', 'Welcome back!') // One-time

console.log(session.get('userId')) // '123'
console.log(session.get('welcome')) // 'Welcome back!'
console.log(session.get('userId')) // '123' (still there)
console.log(session.get('welcome')) // undefined (consumed)
```

## Type Safety

Full TypeScript support with generic interfaces:

```ts
interface UserData {
  userId: string
  role: 'admin' | 'user'
  preferences: {
    theme: string
    notifications: boolean
  }
}

interface FlashData {
  successMessage: string
  errorMessage: string
  warningMessage: string
}

// Type-safe session storage
let typedStorage = createCookieSessionStorage<UserData, FlashData>({
  cookie: { secrets: ['secret'] },
})

let session = await typedStorage.getSession()

// TypeScript ensures type safety
session.set('userId', '123') // ✅ Valid
session.set('role', 'admin') // ✅ Valid
session.set('role', 'invalid') // ❌ TypeScript error

session.flash('successMessage', 'Done!') // ✅ Valid
session.flash('errorMessage', 'Oops!') // ✅ Valid
session.flash('invalidKey', 'Bad') // ❌ TypeScript error

// Return types are properly inferred
let userId: string | undefined = session.get('userId')
let role: 'admin' | 'user' | undefined = session.get('role')
let success: string | undefined = session.get('successMessage')
```

## Advanced Usage

### Session Expiration

Control session lifetime with flexible expiration options:

```ts
let storage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    secrets: ['secret'],
    maxAge: 60 * 60 * 24, // Default 24 hours
  },
})

// Override expiration per commit
await storage.commitSession(session, {
  maxAge: 60 * 60, // This session expires in 1 hour
})

await storage.commitSession(session, {
  expires: new Date(Date.now() + 60 * 60 * 1000), // Absolute expiration
})

// Create session cookies (no expiration)
await storage.commitSession(session, {
  maxAge: undefined,
})
```

### Session Management Patterns

```ts
// Remix loader example
export async function loader({ request }) {
  let session = await storage.getSession(request.headers.get('Cookie'))

  // Check authentication
  if (!session.get('userId')) {
    // Flash message for login redirect
    session.flash('error', 'Please log in to continue')
    return redirect('/login', {
      headers: {
        'Set-Cookie': await storage.commitSession(session),
      },
    })
  }

  return {
    user: await getUserById(session.get('userId')),
    successMessage: session.get('success'), // Flash message
  }
}

// Remix action example
export async function action({ request }) {
  let session = await storage.getSession(request.headers.get('Cookie'))

  try {
    // Process form submission
    await updateUserProfile(formData)

    // Set success flash message
    session.flash('success', 'Profile updated successfully!')

    return redirect('/profile', {
      headers: {
        'Set-Cookie': await storage.commitSession(session),
      },
    })
  } catch (error) {
    // Set error flash message
    session.flash('error', error.message)

    return (
      {
        error: error.message,
      },
      {
        headers: {
          'Set-Cookie': await storage.commitSession(session),
        },
      }
    )
  }
}

// Shopping cart example
export async function addToCart({ request, params }) {
  let session = await storage.getSession(request.headers.get('Cookie'))

  let cart = session.get('cart') || []
  cart.push(params.productId)
  session.set('cart', cart)

  session.flash('success', 'Item added to cart!')

  return redirect('/products', {
    headers: {
      'Set-Cookie': await storage.commitSession(session),
    },
  })
}
```

### Error Handling

Sessions handle various error scenarios gracefully:

```ts
// Invalid or missing cookies return empty sessions
let session = await storage.getSession(null) // Empty session
let session2 = await storage.getSession('') // Empty session
let session3 = await storage.getSession('invalid') // Empty session

// Corrupted signed cookies return empty sessions
let storage = createCookieSessionStorage({
  cookie: { secrets: ['secret'] },
})

let session = await storage.getSession('__session=corrupted.signature')
console.log(session.id) // '' (empty session)
console.log(session.get('anything')) // undefined

// Cookie size limit handling
try {
  let session = await storage.getSession()
  session.set('data', 'x'.repeat(5000))
  await storage.commitSession(session)
} catch (error) {
  console.log(error.message) // "Cookie length will exceed browser maximum. Length: 5234"
}
```

## API Reference

### `createCookieSessionStorage(options?)`

Creates a session storage that stores all data in encrypted cookies.

**Parameters:**

- `options.cookie?: Cookie | CookieOptions` - Cookie configuration

**Returns:** `SessionStorage<Data, FlashData>`

### `createMemorySessionStorage(options?)`

Creates a session storage that stores data in server memory.

**Parameters:**

- `options.cookie?: Cookie | CookieOptions` - Cookie configuration for session ID

**Returns:** `SessionStorage<Data, FlashData>`

### `createSessionStorage(strategy)`

Creates a custom session storage using the provided strategy.

**Parameters:**

- `strategy: SessionIdStorageStrategy<Data, FlashData>` - Custom storage implementation

**Returns:** `SessionStorage<Data, FlashData>`

### `createSession(initialData?, id?)`

Creates a new session object (typically used internally).

**Parameters:**

- `initialData?: Data` - Initial session data
- `id?: string` - Session ID

**Returns:** `Session<Data, FlashData>`

### `isSession(object)`

Type guard to check if an object is a session.

**Parameters:**

- `object: any` - Object to test

**Returns:** `boolean`

### `Session` Interface

**Properties:**

- `id: string` - Unique session identifier (readonly)
- `data: FlashSessionData<Data, FlashData>` - Raw session data (readonly)

**Methods:**

- `has(name: string): boolean` - Check if session has a value
- `get<Key>(name: Key): Value | undefined` - Get session value (consumes flash messages)
- `set<Key>(name: Key, value: Value): void` - Set persistent session value
- `flash<Key>(name: Key, value: Value): void` - Set flash message (one-time value)
- `unset(name: string): void` - Remove session value

### `SessionStorage` Interface

**Methods:**

- `getSession(cookieHeader?: string, options?: ParseOptions): Promise<Session>` - Parse session from cookie
- `commitSession(session: Session, options?: SerializeOptions): Promise<string>` - Serialize session to Set-Cookie header
- `destroySession(session: Session, options?: SerializeOptions): Promise<string>` - Delete session and return clearing Set-Cookie header

### `SessionIdStorageStrategy` Interface

For implementing custom storage backends:

```ts
interface SessionIdStorageStrategy<Data, FlashData> {
  cookie?: Cookie | CookieOptions
  createData: (data: FlashSessionData<Data, FlashData>, expires?: Date) => Promise<string>
  readData: (id: string) => Promise<FlashSessionData<Data, FlashData> | null>
  updateData: (id: string, data: FlashSessionData<Data, FlashData>, expires?: Date) => Promise<void>
  deleteData: (id: string) => Promise<void>
}
```

## Related Packages

- [`cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - Secure HTTP cookie management with signing and type safety
- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Type-safe HTTP header manipulation
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Build HTTP routers using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
