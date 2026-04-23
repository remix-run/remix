---
name: remix
description: Build and review Remix 3 applications using the `remix` npm package and subpath imports. Use when working on Remix app structure, routes, controllers, middleware, validation, data access, auth, sessions, file uploads, server setup, UI components, hydration, navigation, or tests.
---

# Build a Remix App

Use this skill for end-to-end Remix app work. It should help the agent choose the right layer
first, reach for the right package, and avoid the most common Remix-specific mistakes.

## What Remix Is

Remix 3 is a server-first web framework built on Web APIs such as `Request`, `Response`, `URL`,
and `FormData`. All packages ship from a single npm package, `remix`, and are imported via
subpath. There is no top-level `remix` import.

A Remix app has four main pieces:

- **Routes** in `app/routes.ts` define the typed URL contract and power `href()` generation.
- **Controllers and actions** implement that contract and return `Response` objects.
- **Middleware** composes request lifecycle behavior and populates typed context via
  `context.set(Key, value)`.
- **Components** render UI with `remix/component`. This is not React. A component is a setup
  function that returns a render function.

## When To Use This Skill

Use this skill for:

- new features or refactors that touch routing, controllers, middleware, data, auth, sessions, UI,
  or tests
- reviewing Remix app code for correctness, architecture, or framework usage
- answering "how should this be structured in Remix?" questions
- finding the right package, reference doc, or default pattern for a task

## Load Only The References You Need

Classify the task first, then load the smallest useful reference set:

- **Routes, controllers, params, `href()` generation, resources** ->
  [./references/routing-and-controllers.md](./references/routing-and-controllers.md)
- **Server bootstrap, middleware ordering, context keys, static files, uploads, request
  lifecycle** -> [./references/middleware-and-server.md](./references/middleware-and-server.md)
- **Browser module serving, asset URL namespaces, preloads, and fingerprinted client scripts** ->
  [./references/assets-and-browser-modules.md](./references/assets-and-browser-modules.md)
- **Schemas, FormData parsing, database tables, queries, migrations** ->
  [./references/data-and-validation.md](./references/data-and-validation.md)
- **Sessions, auth providers, route protection, login/logout flows** ->
  [./references/auth-and-sessions.md](./references/auth-and-sessions.md)
- **Core component shape, state, `queueTask`, global listeners** ->
  [./references/component-model.md](./references/component-model.md)
- **Host behavior, styles, refs, keyboard and press helpers, animation mixins** ->
  [./references/mixins-styling-events.md](./references/mixins-styling-events.md)
- **`clientEntry`, `run`, frames, navigation, `<head>`, prop serialization** ->
  [./references/hydration-frames-navigation.md](./references/hydration-frames-navigation.md)
- **Router tests and component tests** ->
  [./references/testing-patterns.md](./references/testing-patterns.md)
- **Animation-heavy work** -> [./references/animate-elements.md](./references/animate-elements.md)
- **Reusable mixins** -> [./references/create-mixins.md](./references/create-mixins.md)

Common bundles:

- **Form or CRUD feature** -> routing, data and validation, testing; add auth if user-specific
- **Protected area** -> auth and sessions, routing, testing
- **Interactive widget** -> component model, mixins and styling; add hydration only if it runs in
  the browser
- **Browser asset pipeline** -> assets and browser modules, hydration, middleware and server
- **File upload** -> middleware and server, data and validation, testing
- **Navigation or frames** -> hydration, frames, navigation

## Default Workflow

1. **Classify the change.** Decide whether it changes the route contract, request lifecycle, data
   model, auth or session behavior, or only UI.
2. **Start from the server contract.** Add or update `app/routes.ts` before wiring handlers or UI.
3. **Put code in the narrowest owner.** Favor route-local code first, then promote only when reuse
   is real.
4. **Make the server path correct before adding browser behavior.** A route should return the right
   `Response` via `router.fetch(...)` before you add `clientEntry(...)`, animations, or DOM
   effects.
5. **Add middleware deliberately.** Keep fast-exit middleware early and request-enriching
   middleware later. Export a typed `AppContext` from the root middleware stack and use it in
   controllers.
6. **Validate input at the boundary.** Parse and validate `Request`, `FormData`, params, cookies,
   and external payloads before they reach rendering or persistence logic.
7. **Hydrate only when necessary.** Prefer server-rendered UI. Use `clientEntry(...)` and `run(...)`
   only for real browser interactivity or browser-only APIs.
8. **Test the narrowest meaningful layer.** Prefer router tests for route behavior. Use component
   tests when the behavior is truly interactive or DOM-specific.
9. **Finish with verification.** Re-read the route flow, confirm auth and authorization boundaries,
   and run the smallest relevant test and typecheck loop.

## Project Layout

Use these root directories consistently:

- `app/` for runtime application code
- `db/` for migrations and local database files
- `public/` for static assets served as-is
- `test/` for shared helpers, fixtures, and integration coverage
- `tmp/` for uploads, caches, local session files, and other scratch data

Inside `app/`, organize by responsibility:

- `assets/` for client entrypoints and client-owned browser behavior
- `controllers/` for route-owned handlers and route-local UI
- `data/` for schema, queries, persistence setup, migrations, and runtime data initialization
- `middleware/` for request lifecycle concerns such as auth, sessions, uploads, and database
  injection
- `ui/` for shared cross-route UI primitives
- `utils/` only for genuinely cross-layer helpers that do not clearly belong elsewhere
- `routes.ts` for the route contract
- `router.ts` for router setup and wiring

### Placement Precedence

When code could live in multiple places:

1. Put it in the narrowest owner first.
2. If it belongs to one route, keep it with that route.
3. If it is shared UI across route areas, move it to `app/ui/`.
4. If it is request lifecycle setup, keep it in `app/middleware/`.
5. If it is schema, query, persistence, or startup data logic, keep it in `app/data/`.
6. Use `app/utils/` only as a last resort for truly cross-layer helpers.

### Route Ownership

- Use a flat file in `app/controllers/` for a simple leaf action, such as `app/controllers/home.tsx`
- Use a folder with `controller.tsx` when a route owns nested routes or multiple actions, such as
  `app/controllers/account/controller.tsx`
- Mirror nested route structure on disk, such as `app/controllers/auth/login/controller.tsx`
- Keep route-local UI next to its owner, such as `app/controllers/contact/page.tsx`
- Move shared UI to `app/ui/`
- If a flat leaf grows child routes or multiple actions, promote it to a controller folder

### Layout Anti-Patterns

- Do not create `app/lib/` as a generic dumping ground
- Do not create `app/components/` as a second shared UI bucket when `app/ui/` already owns that
  role
- Do not put shared cross-route UI in `app/controllers/`
- Do not put middleware or persistence helpers in `app/utils/` when they have a clearer home
- Do not create folders for simple leaf actions unless they are real controllers

## Core Remix Rules

- Import from `remix/<subpath>`, never `import { ... } from 'remix'`
- Treat `app/routes.ts` as the source of truth for URLs. Use `routes.<name>.href(...)` for
  redirects, links, tests, and internal URL construction
- Controllers and actions should return explicit `Response` objects, including redirects, 404s, and
  validation failures
- Model HTTP behavior explicitly. Status codes, headers, redirects, cache rules, and content types
  are part of the route contract
- Derive `AppContext` from the root middleware stack so `get(Database)`, `get(Session)`,
  `get(Auth)`, and similar keys stay typed
- Outside actions and controllers, only use `getContext()` when `asyncContext()` is in the
  middleware stack
- Remix Component is not React: keep state in setup-scope variables, call `handle.update()`
  explicitly, and do DOM-sensitive work in event handlers or `queueTask(...)`, not in render
- Prefer host-element mixins via `mix={[...]}` for behavior and styling instead of inventing custom
  host prop conventions
- Hydrated `clientEntry(...)` props must be serializable. Do not pass functions, class instances, or
  opaque runtime objects

## Security And Session Defaults

- Never ship demo secrets. In non-test environments, require session and provider secrets from the
  environment and fail fast if they are missing
- Use hardened cookies: `httpOnly` always, `sameSite` by default, and `secure` when serving over
  HTTPS
- Regenerate session IDs on login, logout, and privilege changes
- Use `requireAuth()` to protect authenticated route areas, but still authorize resource ownership
  inside handlers and data writes
- Add CSRF protection when browser forms mutate state using cookie-backed sessions
- Add CORS only for endpoints that must be called cross-origin. Prefer same-origin by default
- Prefer JSX or `remix/html-template` for HTML generation so escaping stays correct
- Validate uploads for size, type, and destination. Treat filenames and content as untrusted input

## Testing Defaults

- Prefer server and router tests first. Drive the app with `router.fetch(new Request(...))` and
  assert on the returned `Response`
- Build a fresh router per test or per suite so sessions, in-memory storage, and database state
  stay isolated
- Use `routes.<name>.href(...)` in tests so URLs stay coupled to the route contract
- For auth or session scenarios, use a test cookie and `createMemorySessionStorage()` instead of
  production storage
- Use component tests only for interactive or DOM-specific behavior. Render with `createRoot(...)`,
  interact with the real DOM, and call `root.flush()` between steps
- Prefer one representative behavior test over many repetitive assertion variants

## Common Mistakes To Avoid

- Treating Remix Component like React and reaching for hooks or implicit rerendering
- Importing from a top-level `remix` entry instead of a subpath
- Adding `clientEntry(...)` before the server-rendered route behavior is correct
- Passing non-serializable props into `clientEntry(...)`
- Calling `getContext()` without `asyncContext()` in the middleware stack
- Getting middleware order wrong; fast exits like static files belong early, request enrichment later
- Skipping boundary validation and trusting raw `FormData`, params, cookies, or external payloads
- Assuming authentication is enough without per-resource authorization checks
- Dropping shared code into vague buckets like `utils.ts`, `helpers.ts`, or `common.ts` when
  ownership is known
- Writing only component tests for a feature whose main behavior is really an HTTP route concern

## Package Map

### Routing, Server, and Responses

- `remix/fetch-router` -> `createRouter`, middleware and controller types
- `remix/fetch-router/routes` -> `route`, `get`, `post`, `put`, `del`, `form`, `resources`
- `remix/node-fetch-server` -> `createRequestListener` for Node `http`
- `remix/assets` -> `createAssetServer` for browser module serving, public asset hrefs, and preloads
- `remix/headers` -> `Accept`, `Cookie`, `SetCookie`, `CacheControl`, `Vary`, and raw header helpers
- `remix/response/redirect` -> `redirect`
- `remix/response/html` -> `createHtmlResponse`
- `remix/response/compress` -> `compressResponse`
- `remix/response/file` -> file download responses
- `remix/route-pattern` -> URL matching and generation
- `remix/fetch-proxy` -> HTTP proxying via Fetch API

### Data, Validation, and Persistence

- `remix/data-schema` -> schema builders, `parse`, `parseSafe`
- `remix/data-schema/checks` -> `email`, `minLength`, `maxLength`, and other checks
- `remix/data-schema/coerce` -> coercion helpers for strings, numbers, booleans, dates, and ids
- `remix/data-schema/form-data` -> `f.object`, `f.field` for `FormData` parsing
- `remix/data-table` -> `table`, `column`, `createDatabase`, `Database`
- `remix/data-table-sqlite`, `remix/data-table-postgres`, `remix/data-table-mysql` -> database
  adapters
- `remix/data-table/migrations` -> `createMigration`, `createMigrationRunner`
- `remix/data-table/migrations/node` -> `loadMigrations` from disk
- `remix/data-table/operators` -> query operators such as `inList(...)`

### Auth, Sessions, and Cookies

- `remix/auth` -> credentials, OAuth, and OIDC providers
- `remix/auth-middleware` -> `auth`, `requireAuth`, `Auth`
- `remix/session` -> `Session`, `createSession`
- `remix/session-middleware` -> session middleware factory
- `remix/session-storage-redis` -> Redis-backed shared session storage
- `remix/session-storage-memcache` -> Memcache-backed shared session storage
- `remix/session/fs-storage`, `remix/session/memory-storage`, `remix/session/cookie-storage` ->
  session storage backends
- `remix/cookie` -> `createCookie`

### UI, Hydration, and Browser Behavior

- `remix/component` -> components, mixins, `clientEntry`, `run`
- `remix/component/server` -> `renderToStream`
- `remix/component/jsx-runtime` -> JSX transform
- `remix/html-template` -> escaped HTML templates
- `remix/file-storage` -> backend-agnostic `File` storage interface
- `remix/file-storage/fs`, `remix/file-storage/memory`, `remix/file-storage-s3` -> file storage
  backends

### Middleware

- `remix/static-middleware` -> `staticFiles`
- `remix/form-data-middleware` -> `formData`
- `remix/form-data-parser` -> `parseFormData`, `FileUpload`
- `remix/compression-middleware` -> `compression`
- `remix/logger-middleware` -> `logger`
- `remix/method-override-middleware` -> `methodOverride`
- `remix/async-context-middleware` -> `asyncContext`, `getContext`
- `remix/cors-middleware` -> CORS headers
- `remix/csrf-middleware` -> CSRF protection
- `remix/cop-middleware` -> cross-origin protection

### Test

- `remix/test` -> `remix-test`, `describe`, `it`, hooks
- `remix/assert` -> assertions

## Canonical Patterns

### Define routes first

```typescript
import { form, get, post, resources, route } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',
  contact: form('contact'),
  books: {
    index: '/books',
    show: '/books/:slug',
  },
  auth: route('auth', {
    login: form('login'),
    logout: post('logout'),
  }),
  admin: route('admin', {
    index: get('/'),
    books: resources('books', { param: 'bookId' }),
  }),
})
```

### Type controllers against the route contract

```typescript
import { requireAuth } from 'remix/auth-middleware'
import type { BuildAction, Controller } from 'remix/fetch-router'

import type { AppContext } from '../router.ts'
import { routes } from '../routes.ts'

export const home: BuildAction<'GET', typeof routes.home> = {
  handler() {
    return render(<HomePage />)
  },
}

export default {
  middleware: [requireAuth()],
  actions: {
    async index({ get }) {
      let db = get(Database)
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
      return render(<IndexPage allBooks={allBooks} />)
    },
  },
} satisfies Controller<typeof routes.admin, AppContext>
```

### Compose middleware deliberately

```typescript
import {
  createRouter,
  type AnyParams,
  type MiddlewareContext,
  type WithParams,
} from 'remix/fetch-router'

export type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends AnyParams = AnyParams> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>

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

### Build UI as setup plus render

```tsx
import { on, type Handle } from 'remix/component'

function Counter(handle: Handle, initialCount = 0) {
  let count = initialCount

  return (props: { label: string }) => (
    <button
      mix={[
        on('click', () => {
          count++
          handle.update()
        }),
      ]}
    >
      {props.label}: {count}
    </button>
  )
}
```

Only add `clientEntry(...)` and `run(...)` when the component needs browser interactivity or
browser-only APIs.

