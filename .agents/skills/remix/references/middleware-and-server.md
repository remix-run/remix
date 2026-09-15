# Middleware and Server Setup

Read for request ordering, typed context, custom middleware, or server lifecycle changes.

Installed API docs: `src/fetch-router/README.md`, the mapped `src/<name>-middleware/README.md`, and `src/node-fetch-server/README.md`. HMR coordination is covered once in [assets and browser modules](assets-and-browser-modules.md#development-hmr).

## Order by Dependencies

Middleware wraps downstream handling in registration order. Every middleware must either return a `Response` (short-circuit) or call `next()`; the router throws otherwise. Middleware that only sets context still ends with `return next()`. Use `await next()` when a wrapper needs to inspect or modify the downstream response.

| Dependency                                                   | Ordering consequence                            |
| ------------------------------------------------------------ | ----------------------------------------------- |
| Logging, compression, or error handling must wrap a response | Install the wrapper before the work it observes |
| Public static files or CORS preflights can exit early        | Put them before expensive request enrichment    |
| Method override or CSRF reads form fields                    | Parse the body before those consumers           |
| Auth or CSRF reads a session                                 | Install `session()` first                       |
| Auth verifies an identity against a database                 | Provide the database before auth resolution     |
| Helpers use `getContext()`                                   | Install `asyncContext()` before calling them    |
| Actions render UI                                            | Install `render({ assets })` before the actions |

Do not turn this into one mandatory stack for every app. Scope CORS to genuinely cross-origin endpoints and route protection to the controllers/actions that need it. Public static-file shortcuts must not expose private downloads.

For ordinary session-backed forms, use `session()` → `formData()` → optional `methodOverride()` → `csrf()`, with `auth()` before protected handlers. `cop()` may reject unsafe cross-origin traffic before body parsing. For uploads, parsing can write data: use the [upload workflow](file-uploads.md) rather than a global storage callback before authorization.

## Preserve Context Types

The scaffolded `app/router.ts` derives `AppContext` from a tuple of its middleware types and registers it on `RouterTypes`. Extend that tuple as the stack grows; do not add a competing declaration.

```ts
// app/router.ts
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createRouter, type MiddlewareContext } from 'remix/router'

import { assets } from './assets.ts'

const formDataMiddleware = formData()
const renderMiddleware = render({ assets })
type AppContext = MiddlewareContext<[typeof formDataMiddleware, typeof renderMiddleware]>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({
  middleware: [staticFiles('./public', { index: false }), formDataMiddleware, renderMiddleware],
})
```

The tuple only needs the middleware that provide context; `staticFiles()` provides none. `RouterContext<typeof router>` is an equivalent shortcut when the array is written inline. A plain `let middleware = []` built with `.push()` widens to `AnyMiddleware[]`, so `MiddlewareContext<typeof middleware>` cannot infer anything from it; keep an explicit tuple type or use `createMiddleware(...)` for a stored chain.

## Describe What Custom Middleware Provides

A context key's value type does not prove the middleware ran. Declare the provided entry in the middleware return type so downstream `get(databaseContext)` is defined without an assertion:

```ts
// app/middleware/database.ts
import type { Database } from 'remix/data-table'
import { createContextKey } from 'remix/router'
import type { Middleware } from 'remix/router'

export const databaseContext = createContextKey<Database>()

export function loadDatabase(db: Database): Middleware<{
  key: typeof databaseContext
  value: Database
}> {
  return (context, next) => {
    context.set(databaseContext, db)
    return next()
  }
}
```

Add `ReturnType<typeof loadDatabase>` to the `AppContext` tuple so `context.get(databaseContext)` is typed in actions. Create the database connection in the app's persistence setup and pass it to this middleware. If the application needs dialect-specific methods, retain that concrete database type instead of widening it to `Database`.

Prefer explicit context parameters in helpers unless ambient request access is useful. `getContext()` requires `asyncContext()` and an active request; do not call it during module initialization or background jobs.

## Errors and Lifecycle

- An action cannot catch a failure that happened in earlier body-parsing or auth middleware. Handle known middleware errors in a wrapper installed before the failing middleware, or move the operation into a guarded action.
- Return the response from `next()` when modifying downstream headers. Rethrow unexpected errors to the app's existing logging/error boundary; do not expose stack traces or secrets to clients.
- Propagate request cancellation to outbound work where supported. Do not treat aborted work as a successful mutation.
- Keep the generated `server.ts` unless the task needs runtime changes such as TLS, proxy trust, WebSockets, or deployment lifecycle. Read the Node adapter README for those details.
- Close HTTP servers, database connections, asset watchers, and HMR runners during shutdown or test cleanup. Avoid opening new global resources merely by importing a helper or controller.
