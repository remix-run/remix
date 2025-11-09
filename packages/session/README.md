# session

A web-standards-based session management library for JavaScript. This package provides a flexible and secure way to manage user sessions in server-side applications using various storage backends.

## Features

- **Web Standards First:** Built on web standards including the Fetch API, making it portable across runtimes (Node.js, Deno, Bun, Cloudflare Workers)
- **Multiple Storage Options:** Includes memory, cookie, and file-based session storage implementations
- **Flash Messages:** Support for flash data that persists only for the next request
- **Session Security:** Built-in protection against session fixation attacks
- **TypeScript Support:** Fully typed API for better developer experience
- **Flexible API:** Easy to extend with custom storage backends

## Installation

```sh
npm install @remix-run/session
```

## Usage

### Basic Example

```ts
import { Session, MemorySessionStorage } from '@remix-run/session'

let storage = new MemorySessionStorage()

// Create a new session
let session = new Session()
session.set('userId', '123')
session.set('theme', 'dark')

// Save the session
let cookieValue = await storage.update(session.id, session.data)

// Later, retrieve the session
let retrievedSession = await storage.read(cookieValue)
console.log(retrievedSession.get('userId')) // '123'
console.log(retrievedSession.get('theme')) // 'dark'
```

### Flash Messages

Flash messages are values that persist only for the next request, perfect for displaying one-time notifications:

```ts
let session = new Session()
session.flash('message', 'Successfully logged in!')

// Save and reload
let cookieValue = await storage.update(session.id, session.data)
let nextSession = await storage.read(cookieValue)

console.log(nextSession.get('message')) // 'Successfully logged in!'

// On the following request, the flash message is gone
let cookieValue2 = await storage.update(nextSession.id, nextSession.data)
let laterSession = await storage.read(cookieValue2)
console.log(laterSession.get('message')) // undefined
```

### Session ID Regeneration

For security, regenerate the session ID after privilege changes like login:

```ts
let session = await storage.read(cookieValue)

// User just logged in
session.regenerateId()
session.set('userId', authenticatedUserId)

let newCookieValue = await storage.update(session.id, session.data)
```

### Storage Implementations

#### Memory Storage

Fast in-memory storage, suitable for development or single-instance deployments:

```ts
import { MemorySessionStorage } from '@remix-run/session'

let storage = new MemorySessionStorage()
```

#### Cookie Storage

Stores all session data in the session cookie itself:

```ts
import { Cookie } from '@remix-run/cookie'
import { CookieSessionStorage } from '@remix-run/session'

let cookie = new Cookie('session', {
  secrets: ['your-secret-key'],
})

let storage = new CookieSessionStorage(cookie)
```

#### File Storage

Persists sessions to disk:

```ts
import { FileSessionStorage } from '@remix-run/session'

let storage = new FileSessionStorage('./sessions')
```

### Destroying Sessions

To log out or delete a session:

```ts
let session = await storage.read(cookieValue)
session.destroy()

// This will clear the session
let emptyValue = await storage.delete(session.id)
```

## Related Packages

- [`@remix-run/cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - Cookie parsing and serialization
- [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router with built-in session middleware

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
