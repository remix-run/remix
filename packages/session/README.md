# session

A session management library for JavaScript. This package provides a flexible and secure way to manage user sessions in server-side applications with a flexible API for different session storage strategies.

## Features

- **Multiple Storage Strategies:** Includes memory, cookie, and file-based [session storage strategies](#storage-strategies) for different use cases
- **Flash Messages:** Support for [flash data](#flash-messages) that persists only for the next request
- **Session Security:** Built-in protection against [session fixation attacks](#regenerating-session-ids)

## Installation

```sh
npm i remix
```

## Usage

The following example shows how to use a session to persist data across requests.

The standard pattern when working with sessions is to read the session from the request, modify it, and save it back to storage and write the session cookie to the response.

```ts
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

// Create a session storage. This is used to store session data across requests.
let storage = createCookieSessionStorage()

// This function simulates a typical request flow where the session is read from
// the request cookie, modified, and the new cookie is returned in the response.
async function handleRequest(cookie: string | null) {
  let session = await storage.read(cookie)
  session.set('count', Number(session.get('count') ?? 0) + 1)
  return {
    session, // The session data from this "request"
    cookie: await storage.save(session), // The cookie to use on the next request
  }
}

let response1 = await handleRequest(null)
assert.equal(response1.session.get('count'), 1)

let response2 = await handleRequest(response1.cookie)
assert.equal(response2.session.get('count'), 2)

let response3 = await handleRequest(response2.cookie)
assert.equal(response3.session.get('count'), 3)
```

The example above is a low-level illustration of how to use this package for session management. In practice, you would use the `session` middleware in [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) to automatically manage the session for you.

### Flash Messages

Flash messages are values that persist only for the next request, perfect for displaying one-time notifications:

```ts
async function requestIndex(cookie: string | null) {
  let session = await storage.read(cookie)
  return { session, cookie: await storage.save(session) }
}

async function requestSubmit(cookie: string | null) {
  let session = await storage.read(cookie)
  session.flash('message', 'success!')
  return { session, cookie: await storage.save(session) }
}

// Flash data is undefined on the first request
let response1 = await requestIndex(null)
assert.equal(response1.session.get('message'), undefined)

// Flash data is undefined on the same request it is set. This response
// is typically a redirect to a route that displays the flash data.
let response2 = await requestSubmit(response1.cookie)
assert.equal(response2.session.get('message'), undefined)

// Flash data is available on the next request
let response3 = await requestIndex(response2.cookie)
assert.equal(response3.session.get('message'), 'success!')

// Flash data is not available on subsequent requests
let response4 = await requestIndex(response3.cookie)
assert.equal(response4.session.get('message'), undefined)
```

### Regenerating Session IDs

For security, regenerate the session ID after privilege changes like a login. This helps prevent session fixation attacks by issuing a new session ID in the response.

```ts
import { createFsSessionStorage } from 'remix/session/fs-storage'

let sessionStorage = createFsSessionStorage('/tmp/sessions')

async function requestIndex(cookie: string | null) {
  let session = await sessionStorage.read(cookie)
  return { session, cookie: await sessionStorage.save(session) }
}

async function requestLogin(cookie: string | null) {
  let session = await sessionStorage.read(cookie)
  session.set('userId', 'mj')
  session.regenerateId()
  return { session, cookie: await sessionStorage.save(session) }
}

let response1 = await requestIndex(null)
assert.equal(response1.session.get('userId'), undefined)

let response2 = await requestLogin(response1.cookie)
assert.notEqual(response2.session.id, response1.session.id)

let response3 = await requestIndex(response2.cookie)
assert.equal(response3.session.get('userId'), 'mj')
```

To delete the old session data when the session is saved, use `session.regenerateId(true)`. This can help to prevent session fixation attacks by deleting the old session data when the session is saved. However, it may not be desirable in a situation with mobile clients on flaky connections that may need to resume the session using an old session ID.

### Destroying Sessions

When a user logs out, you should destroy the session using `session.destroy()`.

This will clear all session data from storage the next time it is saved. It also clears the session ID on the client in the next response, so it will start with a new session on the next request.

### Storage Strategies

Several strategies are provided out of the box for storing session data across requests, depending on your needs.

A session storage object must always be initialized with a _signed_ session cookie. This is used to identify the session and to store the session data in the response.

#### Filesystem Storage

Filesystem storage is a good choice for production environments. It requires access to a persistent filesystem, which is readily available on most servers. And it can scale to handle sessions with a lot of data easily.

```ts
import { createFsSessionStorage } from 'remix/session/fs-storage'

let sessionStorage = createFsSessionStorage('/tmp/sessions')
```

#### Cookie Storage

Cookie storage is suitable for production environments. In this strategy, all session data is stored directly in the session cookie itself, which means it doesn't require any additional storage.

The main limitation of cookie storage is that the total size of the session cookie is limited to the browser's maximum cookie size, typically 4096 bytes.

```ts
import { createCookieSessionStorage } from 'remix/session/cookie-storage'

let sessionStorage = createCookieSessionStorage()
```

#### Memory Storage

Memory storage is useful in testing and development environments. In this strategy, all session data is stored in memory, which means no additional storage is required. However, all session data is lost when the server restarts.

```ts
import { createMemorySessionStorage } from 'remix/session/memory-storage'

let sessionStorage = createMemorySessionStorage()
```

## Related Packages

- [`@remix-run/cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - Cookie parsing and serialization
- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router with built-in session middleware

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
