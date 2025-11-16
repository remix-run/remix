# cookie

Simplify HTTP cookie management in JavaScript with type-safe, secure cookie handling. `@remix-run/cookie` provides a clean, intuitive API for creating, parsing, and serializing HTTP cookies with built-in support for signing, secret rotation, and comprehensive cookie attribute management.

HTTP cookies are essential for web applications, from session management and user preferences to authentication tokens and tracking. While the standard cookie parsing libraries provide basic functionality, they often leave complex scenarios like secure signing, secret rotation, and type-safe value handling up to you.

## Features

- **Secure Cookie Signing:** Built-in cryptographic signing using HMAC-SHA256 to prevent cookie tampering, with support for secret rotation without breaking existing cookies.
- **Secret Rotation Support:** Seamlessly rotate signing secrets while maintaining backward compatibility with existing cookies.
- **Comprehensive Cookie Attributes:** Full support for all standard cookie attributes including `Path`, `Domain`, `Secure`, `HttpOnly`, `SameSite`, `Max-Age`, and `Expires`.
- **Reusable Cookie Containers:** Create logical cookie containers that can be used to parse and serialize multiple values over time.
- **Web Standards Compliant:** Built on Web Crypto API and standard cookie parsing, making it runtime-agnostic (Node.js, Bun, Deno, Cloudflare Workers).

## Installation

```sh
npm install @remix-run/cookie
```

## Usage

```tsx
import { createCookie } from '@remix-run/cookie'

let sessionCookie = createCookie('session', { secrets: ['s3cret1'] })

// Get the value of the "session" cookie from the request's `Cookie` header
let value = await sessionCookie.parse(request.headers.get('Cookie'))

// Set the value of the cookie in a Response's `Set-Cookie` header
let response = new Response('Hello, world!', {
  headers: {
    'Set-Cookie': await sessionCookie.serialize(value),
  },
})
```

### Signing Cookies

This library supports signing cookies, which is useful for ensuring the integrity of the cookie value and preventing tampering. Signing happens automatically when you provide a `secrets` option to the `Cookie` constructor.

Secret rotation is also supported, so you can easily rotate in new secrets without breaking existing cookies.

```tsx
import { Cookie } from '@remix-run/cookie'

// Start with a single secret
let sessionCookie = createCookie('session', {
  secrets: ['secret1'],
})

console.log(sessionCookie.isSigned) // true

let response = new Response('Hello, world!', {
  headers: {
    'Set-Cookie': await sessionCookie.serialize(value),
  },
})
```

All cookies sent in this scenario will be signed with the secret `secret1`. Later, when it's time to rotate secrets, add a new secret to the beginning of the array and all existing cookies will still be able to be parsed.

```tsx
let sessionCookie = createCookie('session', {
  secrets: ['secret2', 'secret1'],
})

// This works for cookies signed with either secret
let value = await sessionCookie.parse(request.headers.get('Cookie'))

// Newly serialized cookies will be signed with the new secret
let response = new Response('Hello, world!', {
  headers: {
    'Set-Cookie': await sessionCookie.serialize(value),
  },
})
```

### Custom Encoding

By default, the library will use `encodeURIComponent` and `decodeURIComponent` to encode and decode the cookie value. This is suitable for most use cases, but you can provide your own functions to customize the encoding and decoding of the cookie value.

```tsx
let sessionCookie = createCookie('session', {
  encode: (value) => value,
  decode: (value) => value,
})
```

This can be useful for viewing the value of cookies in a human-readable format in the browser's developer tools. But you should be sure that the cookie value contains only characters that are [valid in a cookie value](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#attributes).

## Related Packages

- [`headers`](https://github.com/remix-run/remix/tree/main/packages/headers) - Type-safe HTTP header manipulation
- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Build HTTP routers using the web fetch API
- [`node-fetch-server`](https://github.com/remix-run/remix/tree/main/packages/node-fetch-server) - Build HTTP servers on Node.js using the web fetch API

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
