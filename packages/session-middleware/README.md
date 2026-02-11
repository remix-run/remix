# session-middleware

Session middleware for Remix using signed cookies. It loads session state from incoming requests, exposes it on `context.session`, and persists updates automatically.

## Features

- **Session Lifecycle Handling** - Reads and saves session state per request
- **Context Integration** - Exposes session APIs directly on request context
- **Secure Cookie Support** - Designed for signed session cookies

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createRouter } from 'remix/fetch-router'
import { createCookie } from 'remix/cookie'
import { createCookieSessionStorage } from 'remix/session/cookie-storage'
import { session } from 'remix/session-middleware'

let sessionCookie = createCookie('__session', {
  secrets: ['s3cr3t'], // session cookies must be signed!
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
})

let sessionStorage = createCookieSessionStorage()

let router = createRouter({
  middleware: [session(sessionCookie, sessionStorage)],
})

router.get('/', (context) => {
  context.session.set('count', Number(context.session.get('count') ?? 0) + 1)
  return new Response(`Count: ${context.session.get('count')}`)
})
```

The middleware:

- Reads the session from the cookie on incoming requests
- Makes it available as `context.session`
- Automatically saves session changes and sets the cookie on responses

Note: The session cookie must be signed for security. This prevents tampering with the session data on the client.

### Login/Logout Flow

A basic login/logout flow could look like this:

```ts
import * as res from 'remix/fetch-router/response-helpers'

router.get('/login', ({ session }) => {
  let error = session.get('error')
  return res.html(`
    <html>
      <body>
        <h1>Login</h1>
        ${typeof error === 'string' ? <div class="error">${error}</div> : null}
        <form method="POST" action="/login">
          <input type="text" name="username" placeholder="Username" />
          <input type="password" name="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `)
})

router.post('/login', ({ session, formData }) => {
  let username = formData.get('username')
  let password = formData.get('password')

  let user = authenticateUser(username, password)
  if (!user) {
    session.flash('error', 'Invalid username or password')
    return res.redirect('/login')
  }

  session.regenerateId()
  session.set('userId', user.id)

  return res.redirect('/dashboard')
})

router.post('/logout', ({ session }) => {
  session.destroy()
  return res.redirect('/')
})
```

## Related Packages

- [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - Router for the web Fetch API
- [`session`](https://github.com/remix-run/remix/tree/main/packages/session) - Session management and storage
- [`cookie`](https://github.com/remix-run/remix/tree/main/packages/cookie) - Cookie parsing and serialization

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
