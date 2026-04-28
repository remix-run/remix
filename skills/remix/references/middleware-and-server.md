# Middleware and Server Setup

## What This Covers

How to compose the request lifecycle and bridge the router to a runtime. Read this when the task
involves:

- Choosing or ordering built-in middleware in the root stack
- Writing custom middleware that sets typed context values
- Adding fast-exit handling (static files, CORS preflights) versus request-enriching layers
  (sessions, auth, data loading)
- Booting a Node `http` server with `createRequestListener`

For data and persistence specifics, see `data-and-validation.md`. For session and auth specifics,
see `auth-and-sessions.md`.

## Middleware Stack

Middleware runs in order for every request. Place fast-exit middleware (static files) early and
request-enriching middleware (session, auth) later.

Recommended ordering:

```typescript
import { createRouter } from 'remix/fetch-router'
import { compression } from 'remix/compression-middleware'
import { formData } from 'remix/form-data-middleware'
import { logger } from 'remix/logger-middleware'
import { methodOverride } from 'remix/method-override-middleware'
import { session } from 'remix/session-middleware'
import { staticFiles } from 'remix/static-middleware'
import { asyncContext } from 'remix/async-context-middleware'

let middleware = []

if (process.env.NODE_ENV === 'development') {
  middleware.push(logger())
}

middleware.push(compression())
middleware.push(staticFiles('./public'))
middleware.push(formData())
middleware.push(methodOverride())
middleware.push(session(cookie, storage))
middleware.push(asyncContext())
middleware.push(loadDatabase())
middleware.push(loadAuth())

let router = createRouter({ middleware })
```

### Built-in middleware catalog

| Middleware | Import | Use when | Notes |
|-----------|--------|----------|-------|
| `staticFiles(dir, opts?)` | `remix/static-middleware` | Serve files from `public/` or another directory exactly as they exist on disk | Fast exit; usually near the top |
| `compression()` | `remix/compression-middleware` | Compress text-like responses | Usually global |
| `logger()` | `remix/logger-middleware` | Log requests and responses | Often development-only; `colors` can force color output on/off |
| `cors(opts?)` | `remix/cors-middleware` | Endpoints must serve cross-origin browsers or preflight `OPTIONS` requests | Usually early so preflights can short-circuit |
| `cop(opts?)` | `remix/cop-middleware` | Reject unsafe cross-origin browser requests without synchronizer tokens | Put before session or CSRF when used |
| `formData(opts?)` | `remix/form-data-middleware` | Parse `FormData` bodies, especially forms and uploads | Needed for `_csrf` form field extraction |
| `methodOverride()` | `remix/method-override-middleware` | HTML forms need `PUT`, `PATCH`, or `DELETE` semantics | Run after form parsing |
| `session(cookie, storage)` | `remix/session-middleware` | Cookie-backed sessions | Must run before session-backed auth or CSRF |
| `csrf(opts?)` | `remix/csrf-middleware` | Session-backed form workflows need synchronizer-token CSRF protection | Requires `session()` before it |
| `asyncContext()` | `remix/async-context-middleware` | Helpers outside handlers need request context via `getContext()` | Add before helpers rely on it |
| `auth({ schemes })` | `remix/auth-middleware` | Resolve auth state into `context.get(Auth)` | Run after `session()` for session-backed auth |
| `requireAuth()` | `remix/auth-middleware` | A controller or action must reject anonymous access | Usually controller-level or action-level, not global |

### Static files vs browser modules

- Use `staticFiles()` for files that should be served directly from disk, such as images, fonts,
  or already-built assets in `public/`
- Use `remix/assets` when browser modules should be compiled and served from source files with
  import rewriting, preloads, or fingerprinted URLs

### Ordering notes

- Put fast exits early: `staticFiles()`, `cors()` preflight handling, and `cop()` when used
- Parse request bodies before middleware that depends on them, such as `methodOverride()` and form
  field token extraction in `csrf()`
- Run `session()` before `csrf()` and before session-backed `auth()`
- Add `asyncContext()` before helpers or shared code call `getContext()`
- Keep route protection like `requireAuth()` at controller or action scope unless the entire app is
  private

### Common stacks

- **Session-backed HTML app** -> `compression()`, `staticFiles()`, optional `cop()`, `formData()`,
  `methodOverride()`, `session()`, optional `csrf()`, `asyncContext()`, `auth({ schemes })`
- **Cross-origin API** -> `compression()`, `cors()`, optional `asyncContext()`, optional
  `auth({ schemes })`
- **Upload flow** -> `compression()`, `staticFiles()`, `formData({ uploadHandler })`, then
  sessions, auth, and data-loading middleware as needed

### Middleware with options

```typescript
// Static files with cache headers
staticFiles('./public', {
  cacheControl: 'no-store, must-revalidate',
  etag: false,
  lastModified: false,
})

// Form data with upload handler
import { FileUpload } from 'remix/form-data-parser'
import { createFsFileStorage } from 'remix/file-storage/fs'

let fileStorage = createFsFileStorage('./tmp/uploads')

formData({
  uploadHandler(fileUpload: FileUpload) {
    return fileStorage.set(fileUpload.name, fileUpload)
  },
})
```

Errors thrown or rejected by `uploadHandler` propagate directly. Catch domain-specific upload
errors at the route boundary when they should become user-facing `Response` objects.

## Writing Custom Middleware

Middleware is a function that receives `(context, next)` and returns a `Response`. Call `next()` to
continue the chain.

### Setting context values

Use `context.set(key, value)` to add typed values accessible downstream via `context.get(key)`.

```typescript
import type { Middleware } from 'remix/fetch-router'
import { Database } from 'remix/data-table'

export function loadDatabase(): Middleware {
  return async (context, next) => {
    context.set(Database, db)
    return next()
  }
}
```

### Guarding routes

```typescript
import { Auth } from 'remix/auth-middleware'

export function requireAdmin(): Middleware {
  return (context, next) => {
    let auth = context.get(Auth)
    if (auth.identity?.role !== 'admin') {
      return new Response('Forbidden', { status: 403 })
    }
    return next()
  }
}
```

### Async context for helpers

`asyncContext()` stores the request context in `AsyncLocalStorage` so helpers can reach it
without the context being threaded through every call. Wrap `getContext()` in app-specific
helpers:

```typescript
// app/utils/context.ts
import { getContext } from 'remix/async-context-middleware'
import { Auth } from 'remix/auth-middleware'
import { Database } from 'remix/data-table'
import { Session } from 'remix/session'

export function getCurrentDb() {
  return getContext().get(Database)
}

export function getCurrentSession() {
  return getContext().get(Session)
}

export function getCurrentUser() {
  let auth = getContext().get(Auth)
  if (!auth.ok) {
    throw new Error('Expected an authenticated user. Run requireAuth() before this code.')
  }
  return auth.identity
}

export function getCurrentUserSafely() {
  let auth = getContext().get(Auth)
  return auth.ok ? auth.identity : null
}
```

## Middleware Layers

Middleware can be applied at three levels:

1. **Router-level** — runs for every request:
   ```typescript
   let router = createRouter({ middleware: [...] })
   ```

2. **Controller-level** — runs for all actions in a controller subtree:
   ```typescript
   export default {
     middleware: [requireAuth()],
     actions: { ... },
   } satisfies Controller<typeof routes.account>
   ```

3. **Action-level** — runs for a single route:
   ```typescript
   router.get(routes.account, {
     middleware: [requireAuth()],
     handler: accountAction.handler,
   })
   ```

## Node Server Setup

Use `createRequestListener` to bridge Node's `http` module to the Fetch API router:

```typescript
import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

let server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

let port = Number(process.env.PORT) || 3000
server.listen(port, () => {
  console.log(`http://localhost:${port}`)
})
```
