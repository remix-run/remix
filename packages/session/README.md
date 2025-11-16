# session

A web-standards-based session management library for JavaScript. This package provides a flexible and secure way to manage user sessions in server-side applications with a flexible API for different session storage strategies.

## Features

- **Multiple Storage Strategies:** Includes memory, cookie, and file-based [session storage strategies](#storage-strategies)
- **Flash Messages:** Support for [flash data](#flash-messages) that persists only for the next request
- **Session Security:** Built-in protection against [session fixation attacks](#regenerating-session-ids)

## Installation

```sh
npm install @remix-run/session
```

## Usage

### Basic Example

The following example shows how to use a session to persist data across requests.

The standard pattern when working with sessions is to read the session from the request, modify it, and save it back to storage and write the session cookie to the response.

```ts
import { createCookie } from '@remix-run/cookie'
import { createCookieStorage } from '@remix-run/session/cookie-storage'

// Create a session cookie and session storage
// Note: The session cookie must be signed for security
let cookie = createCookie('session', { secrets: ['s3cr3t'] })
let storage = createCookieStorage(cookie)

async function handleRequest(request: Request) {
  let session = await storage.read(request)
  session.set('count', (session.get('count') ?? 0) + 1)

  let response = new Response(`Count: ${session.get('count')}`)
  await storage.save(session, response)

  return response
}

let response1 = await handleRequest(new Request('https://remix.run'))
assert.match(await response1.text(), /Count: 1/)

// Note: createRequest(response) here is pseudo-code for creating a new request
// object with cookie from the previous response.
let response2 = await handleRequest(createRequest(response1))
assert.match(await response2.text(), /Count: 2/)

let response3 = await handleRequest(createRequest(response2))
assert.match(await response3.text(), /Count: 3/)
```

### Flash Messages

Flash messages are values that persist only for the next request, perfect for displaying one-time notifications:

```ts
async function handleIndex(request: Request) {
  let session = await storage.read(request)
  let response = new Response(`Message: ${session.get('message') ?? 'undefined'}`)
  await storage.save(session, response)
  return response
}

async function handleSubmit(request: Request) {
  let session = await storage.read(request)
  session.flash('message', 'success!')
  await storage.save(session, response)
  return response
}

// Flash data is undefined on the first request.
let response1 = await handleIndex(new Request('https://remix.run'))
assert.match(await response1.text(), /Message: undefined/)

// The next request sets the flash message. This is typically a POST handler that
// redirects back to a GET handler.
let response2 = await handleSubmit(createRequest(response1))

// The next request shows the flash message.
let response3 = await handleIndex(createRequest(response2))
assert.match(await response3.text(), /Message: success!/)

// The following request doesn't have access to flash data.
let response4 = await handleIndex(createRequest(response3))
assert.match(await response4.text(), /Message: undefined/)
```

### Regenerating Session IDs

For security, regenerate the session ID after privilege changes like a login. This helps prevent session fixation attacks by issuing a new session ID in the response to the client.

```ts
import { createFileStorage } from '@remix-run/session/file-storage'
import { createCookie } from '@remix-run/cookie'

let cookie = createCookie('session', { secrets: ['s3cr3t'] })
let storage = createFileStorage(cookie, './sessions')

async function handleLogin(request: Request) {
  let session = await storage.read(request)
  let authenticatedUserId = 'mj'
  session.regenerateId()
  session.set('userId', authenticatedUserId)
  let response = new Response(`Logged in as ${authenticatedUserId}`)
  await storage.save(session, response)
  return response
}

let response = await handleLogin(new Request('https://remix.run'))
assert.match(await response.text(), /Logged in as \w+/)
```

To delete the old session data when the session is saved, use `session.regenerateId(true)`. This can help to prevent session fixation attacks by deleting the old session data when the session is saved. However, it may not be desirable in a situation with mobile clients on flaky connections that may need to resume the session using an old session ID.

### Destroying Sessions

When a user logs out, you should destroy the session.

```ts
async function handleLogout(request: Request) {
  let session = await storage.read(request)
  // This will clear the session the next time it is saved
  session.destroy()
  let response = new Response('Logged out')
  await storage.save(session, response)
  return response
}
```

### Storage Strategies

Several strategies are provided out of the box for storing session data across requests, depending on your needs.

A session storage object must always be initialized with a _signed_ session cookie. This is used to identify the session and to store the session data in the response.

#### File Storage

File storage is a good choice for production environments. It requires access to a persistent filesystem, which is readily available on most servers. And it can scale to handle sessions with a lot of data easily.

```ts
import { createCookie } from '@remix-run/cookie'
import { createFileStorage } from '@remix-run/session/file-storage'

let cookie = createCookie('session', { secrets: ['s3cr3t'] })
let storage = createFileStorage(cookie, '/tmp/sessions')
```

#### Cookie Storage

Cookie storage is suitable for production environments. In this strategy, all session data is stored directly in the session cookie itself, which means it doesn't require any additional storage.

The main limitation of cookie storage is that the total size of the session cookie is limited to the browser's maximum cookie size, typically 4096 bytes.

```ts
import { createCookie } from '@remix-run/cookie'
import { createCookieStorage } from '@remix-run/session/cookie-storage'

let cookie = createCookie('session', { secrets: ['s3cr3t'] })
let storage = createCookieStorage(cookie)
```

#### Memory Storage

Memory storage is a good choice for testing and development. In this strategy, all session data is stored in memory, which means it doesn't require any additional storage. However, all session data is lost when the server restarts.

```ts
import { createCookie } from '@remix-run/cookie'
import { createMemoryStorage } from '@remix-run/session/memory-storage'

let cookie = createCookie('session', { secrets: ['s3cr3t'] })
let storage = createMemoryStorage(cookie)
```

## Related Packages

- [`@remix-run/cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - Cookie parsing and serialization
- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router with built-in session middleware

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
