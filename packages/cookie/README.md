# @remix-run/cookie

Simplify HTTP cookie management in JavaScript with type-safe, secure cookie handling. `@remix-run/cookie` provides a clean, intuitive API for creating, parsing, and serializing HTTP cookies with built-in support for signing, secret rotation, and comprehensive cookie attribute management.

HTTP cookies are essential for web applications—from session management and user preferences to authentication tokens and tracking. While the standard cookie parsing libraries provide basic functionality, they often leave complex scenarios like secure signing, secret rotation, and type-safe value handling up to you.

`@remix-run/cookie` solves this by offering:

- **Secure Cookie Signing:** Built-in cryptographic signing using HMAC-SHA256 to prevent cookie tampering, with support for secret rotation without breaking existing cookies.
- **Type-Safe Value Handling:** Automatically serializes and deserializes JavaScript values (strings, objects, booleans, numbers) to/from cookie-safe formats.
- **Comprehensive Cookie Attributes:** Full support for all standard cookie attributes including `Path`, `Domain`, `Secure`, `HttpOnly`, `SameSite`, `Max-Age`, and `Expires`.
- **Reusable Cookie Containers:** Create logical cookie containers that can be used to parse and serialize multiple values over time.
- **Web Standards Compliant:** Built on Web Crypto API and standard cookie parsing, making it runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers).
- **Secret Rotation Support:** Seamlessly rotate signing secrets while maintaining backward compatibility with existing cookies.

Perfect for building secure, maintainable cookie management in your JavaScript and TypeScript applications!

## Installation

```sh
npm install @remix-run/cookie
```

## Overview

The following should give you a sense of what kinds of things you can do with this library:

```ts
import { Cookie } from '@remix-run/cookie'

// Create a basic cookie
let sessionCookie = new Cookie('session')

// Serialize a value to a Set-Cookie header
let setCookieHeader = await sessionCookie.serialize({
  userId: '12345',
  theme: 'dark',
})
console.log(setCookieHeader)
// session=eyJ1c2VySWQiOiIxMjM0NSIsInRoZW1lIjoiZGFyayJ9; Path=/; SameSite=Lax

// Parse a Cookie header to get the value back
let cookieHeader = 'session=eyJ1c2VySWQiOiIxMjM0NSIsInRoZW1lIjoiZGFyayJ9'
let sessionData = await sessionCookie.parse(cookieHeader)
console.log(sessionData) // { userId: '12345', theme: 'dark' }

// Create a signed cookie for security
let secureCookie = new Cookie('secure-session', {
  secrets: ['Secr3t'], // Array to support secret rotation
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 7, // 7 days
})

// Signed cookies prevent tampering
let signedValue = await secureCookie.serialize({ admin: true })
console.log(signedValue)
// secure-session=eyJhZG1pbiI6dHJ1ZX0.signature; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Strict

let parsedValue = await secureCookie.parse('secure-session=eyJhZG1pbiI6dHJ1ZX0.signature')
console.log(parsedValue) // { admin: true }

// Tampered cookies return null
let tamperedValue = await secureCookie.parse('secure-session=eyJhZG1pbiI6ZmFsc2V9.badsignature')
console.log(tamperedValue) // null

// Cookie properties
console.log(secureCookie.name) // 'secure-session'
console.log(secureCookie.isSigned) // true
console.log(secureCookie.expires) // Date object (calculated from maxAge)

// Handle different data types
let preferencesCookie = new Cookie('preferences')

// Strings
await preferencesCookie.serialize('light-mode')

// Objects
await preferencesCookie.serialize({
  theme: 'dark',
  language: 'en-US',
  notifications: true,
})

// Booleans
await preferencesCookie.serialize(false)

// Numbers
await preferencesCookie.serialize(42)
```

## Cookie Configuration

Cookies can be configured with comprehensive options:

```ts
import { Cookie } from '@remix-run/cookie'

let cookie = new Cookie('my-cookie', {
  // Security options
  secrets: ['secret1', 'secret2'], // For signing (first used for new cookies)
  httpOnly: true, // Prevent JavaScript access
  secure: true, // Require HTTPS

  // Scope options
  domain: '.example.com', // Cookie domain
  path: '/admin', // Cookie path

  // Expiration options
  maxAge: 60 * 60 * 24, // Max age in seconds
  expires: new Date('2025-12-31'), // Absolute expiration date

  // SameSite options
  sameSite: 'strict', // 'strict' | 'lax' | 'none'

  // Encoding options (from 'cookie' package)
  encode: (value) => encodeURIComponent(value),
  decode: (value) => decodeURIComponent(value),
})
```

## Secret Rotation

One of the key features is seamless secret rotation for signed cookies:

```ts
// Start with an initial secret
let cookie = new Cookie('session', {
  secrets: ['secret-v1'],
})

let setCookie1 = await cookie.serialize({ user: 'alice' })

// Later, rotate to a new secret while keeping the old one
cookie = new Cookie('session', {
  secrets: ['secret-v2', 'secret-v1'], // New secret first, old ones after
})

// New cookies use the new secret
let setCookie2 = await cookie.serialize({ user: 'bob' })

// But old cookies still work
let oldValue = await cookie.parse(setCookie1.split(';')[0])
console.log(oldValue) // { user: 'alice' } - still works!

let newValue = await cookie.parse(setCookie2.split(';')[0])
console.log(newValue) // { user: 'bob' }
```

## Advanced Usage

### Custom Serialization Options

You can override cookie options when serializing:

```ts
let cookie = new Cookie('flexible', {
  maxAge: 60 * 60, // Default 1 hour
})

// Override for a specific use case
let longLivedCookie = await cookie.serialize('remember-me', {
  maxAge: 60 * 60 * 24 * 365, // 1 year
})

let sessionCookie = await cookie.serialize('temp-data', {
  maxAge: undefined, // Session cookie (no expiration)
  secure: false, // Maybe for development
})
```

### Error Handling

The library handles various error scenarios gracefully:

```ts
let cookie = new Cookie('test')

// Missing or malformed cookie headers return null
await cookie.parse(null) // null
await cookie.parse('') // null
await cookie.parse('other=value') // null

// Malformed cookie values return empty object or null
await cookie.parse('test=invalid-base64@#$') // {}

// Signed cookies with bad signatures return null
let signedCookie = new Cookie('signed', { secrets: ['secret'] })
await signedCookie.parse('signed=value.badsignature') // null
```

## API Reference

### `Cookie` Class

A cookie container class for managing HTTP cookies.

**Constructor:**

```ts
new Cookie(name: string, options?: CookieOptions)
```

**Parameters:**

- `name: string` - The cookie name
- `options?: CookieOptions` - Configuration options

**Properties:**

- `name: string` - The cookie name (readonly)
- `isSigned: boolean` - Whether the cookie uses signing (readonly)
- `expires?: Date` - Calculated expiration date (readonly)

**Methods:**

- `parse(cookieHeader: string | null, options?: ParseOptions): Promise<any>` - Parse cookie value from header
- `serialize(value: any, options?: SerializeOptions): Promise<string>` - Serialize value to Set-Cookie header

### `CookieOptions`

Configuration options for cookies (extends options from the [`cookie`](https://www.npmjs.com/package/cookie) package):

```ts
interface CookieOptions {
  // Signing
  secrets?: string[]

  // Standard cookie attributes
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none' | boolean

  // Encoding (from cookie package)
  encode?: (value: string) => string
  decode?: (value: string) => string
}
```

## Related Packages

- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Type-safe HTTP header manipulation
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Build HTTP routers using the web fetch API
- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Build HTTP servers on Node.js using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
