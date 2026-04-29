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
- **Components** render UI with `remix/ui`. This is not React. A component receives a
  `handle`, reads current props from `handle.props`, and returns a render function.

## When To Use This Skill

Use this skill for:

- new features or refactors that touch routing, controllers, middleware, data, auth, sessions, UI,
  or tests
- reviewing Remix app code for correctness, architecture, or framework usage
- answering "how should this be structured in Remix?" questions
- finding the right package, reference doc, or default pattern for a task

## Load Only The References You Need

Classify the task first, then load the smallest useful reference set. Each reference file starts
with a "What This Covers" section that lists the topics inside it — read that first to confirm
the file is relevant before reading the rest.

Use the table below to find candidates. Loading more than two or three files at once is usually a
sign that the task hasn't been narrowed enough yet.

| Task involves...                                                              | Start with                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------- |
| Defining URLs, writing controllers and actions, returning responses           | `references/routing-and-controllers.md`     |
| Composing the request lifecycle, ordering middleware, bridging to a server    | `references/middleware-and-server.md`       |
| Compiling and serving browser modules, asset URL namespaces, preloads         | `references/assets-and-browser-modules.md`  |
| Parsing input, validating with schemas, defining tables, querying, migrations | `references/data-and-validation.md`         |
| Per-browser state, login flows, route protection, identity                    | `references/auth-and-sessions.md`           |
| Component setup, state, lifecycle, updates, `queueTask`, context              | `references/component-model.md`             |
| Event handlers, styles, refs, click/key behavior, simple animations           | `references/mixins-styling-events.md`       |
| `clientEntry`, `run`, `<Frame>`, navigation, `<head>`                         | `references/hydration-frames-navigation.md` |
| Router tests, component tests, test isolation                                 | `references/testing-patterns.md`            |
| Spring physics, tweens, layout transitions                                    | `references/animate-elements.md`            |
| Authoring custom reusable mixins                                              | `references/create-mixins.md`               |

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
  validation failures. At the route boundary, prefer returning a `Response` for expected outcomes
  (validation errors, conflicts, not found) over throwing for control flow
- Model HTTP behavior explicitly. Status codes, headers, redirects, cache rules, and content types
  are part of the route contract
- Make the server route correct first. A POST should already return the right HTML, redirect, or
  error response on its own before `clientEntry(...)` layers interactivity on top
- Validate input at the boundary using `remix/data-schema` (and `remix/data-schema/form-data` for
  forms). `parseSafe` makes the failure path a return value instead of an exception
- Derive `AppContext` from the root middleware stack so `get(Database)`, `get(Session)`,
  `get(Auth)`, and similar keys stay typed. If the controller never reads from context, it doesn't
  need the harness
- Outside actions and controllers, only use `getContext()` when `asyncContext()` is in the
  middleware stack
- Remix Component is not React: read props from `handle.props`, keep state in setup-scope
  variables, call `handle.update()` explicitly, and do DOM-sensitive work in event handlers or
  `queueTask(...)`, not in render
- Prefer host-element mixins via `mix={mixin(...)}` for behavior and styling instead of inventing
  custom host prop conventions. Use `mix={[...]}` only when composing multiple mixins
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
- Letting route-local domain errors leak out of the controller. Translate expected outcomes
  (validation, conflicts, not-found) into the HTTP `Response` the route means to return rather than
  throwing a custom `Error` subclass and catching it elsewhere
- Reaching for `createCookie` when a tamper-sensitive or server-managed per-browser fact really
  wants `remix/session`. If editing the value would be a bug, use a session
- Building a JSON-only RPC layer when a normal form POST, redirect, or resource route would be
  simpler. Fetch-from-the-client is a layer on top of sound route behavior, not a replacement for
  it
- Treating JSON state endpoints and `<Frame>` reloads as mutually exclusive patterns. Pick the
  lightest sync mechanism that fits the UX; small widgets may reasonably poll a JSON endpoint
- Assuming authentication is enough without per-resource authorization checks
- Dropping shared code into vague buckets like `utils.ts`, `helpers.ts`, or `common.ts` when
  ownership is known
- Writing only component tests for a feature whose main behavior is really an HTTP route concern

## Package Map

Use this map to find the right package quickly. Each entry says what the package is for, not just
what it exports. Open the linked reference file when you need full examples.

### Routing, Server, and Responses

- `remix/fetch-router` — the router itself. Use for `createRouter`, controller and middleware
  types, and registering routes
- `remix/fetch-router/routes` — declarative route builders. Use for `route`, `get`, `post`, `put`,
  `del`, `form`, `resources` when defining `app/routes.ts`
- `remix/node-fetch-server` — adapter from Node's `http` module to a Fetch-style router. Use for
  `createRequestListener` in `server.ts`
- `remix/assets` — browser asset server. Use for `createAssetServer` when serving compiled
  scripts and styles, getting public hrefs, and emitting preloads. Shared compiler options such as
  `target`, `sourceMaps`, `sourceMapSourcePaths`, and `minify` live at the top level
- `remix/headers` — typed header parsers and builders. Use when reading `Accept`, `Cookie`, or
  setting `CacheControl`, `Vary`, etc., instead of hand-formatting strings
- `remix/response/redirect` — `redirect(href, status?)`. Use for the canonical "POST then redirect"
  pattern and other location changes
- `remix/response/html` — `createHtmlResponse`. Use when you need an HTML `Response` from a string
  or stream without rendering through `remix/ui`
- `remix/response/compress` — `compressResponse`. Use when compressing one-off responses outside
  the global `compression()` middleware
- `remix/response/file` — file-download responses. Use for `Content-Disposition: attachment`
  responses
- `remix/route-pattern` — low-level URL matching and generation. Use when working with raw
  patterns outside the router (custom matchers, scripts)
- `remix/fetch-proxy` — Fetch-based HTTP proxying. Use to forward a request to another origin; pass
  `xForwardedHeaders` when the upstream needs forwarded proto, host, and port

### Data, Validation, and Persistence

- `remix/data-schema` — schema builders for runtime validation. Use for `parse` and `parseSafe`
  to validate any input that crosses a trust boundary, and `.transform(...)` when validated output
  should map to a different value or type
- `remix/data-schema/checks` — common check helpers (`email`, `minLength`, `maxLength`, etc.).
  Use to compose into a schema
- `remix/data-schema/coerce` — coercion helpers for strings, numbers, booleans, dates, and ids.
  Use when input arrives as a string but should be a typed value
- `remix/data-schema/form-data` — `f.object` and `f.field` for parsing `FormData` directly. Use
  in actions that read browser forms
- `remix/data-table` — typed tables and a `Database` interface. Use for `table`, `column`,
  `createDatabase` when modeling persisted data
- `remix/data-table-sqlite`, `remix/data-table-postgres`, `remix/data-table-mysql` — adapters.
  Use to back `createDatabase` with a real engine. SQLite accepts Node, Bun, and compatible
  synchronous clients with the shared `prepare`/`exec` surface
- `remix/data-table/migrations` — migration authoring and runners. Use for `createMigration`,
  `createMigrationRunner`
- `remix/data-table/migrations/node` — `loadMigrations` from disk. Use in startup scripts that
  apply migrations
- `remix/data-table/operators` — query operators such as `inList(...)`. Use when `where` clauses
  need set or comparison logic

### Auth, Sessions, and Cookies

- `remix/session` — the `Session` object: `get`, `set`, `flash`, `unset`, `regenerateId`. Use for
  any per-browser state where tampering would be a bug (login, "I submitted this form already",
  cart, flash messages)
- `remix/session-middleware` — `session(cookie, storage)`. Use to wire a session cookie and
  storage backend into the root middleware stack
- `remix/session/fs-storage`, `remix/session/memory-storage`, `remix/session/cookie-storage` —
  storage backends. Use `fs-storage` for single-process apps, `memory-storage` for tests,
  `cookie-storage` for stateless deployments where data fits in a cookie
- `remix/session-storage-redis` — Redis-backed storage. Use for multi-process or multi-host
  deployments
- `remix/session-storage-memcache` — Memcache-backed storage. Same multi-host use case as Redis
- `remix/cookie` — `createCookie` for plain signed/unsigned cookies. Use for non-sensitive
  preferences where the client is allowed to control the value (theme, locale, dismissed banner).
  For state where tampering matters, prefer `remix/session`
- `remix/auth` — credentials, OAuth, OIDC, and Atmosphere providers. Use to define how identity is
  verified, start/finish external login, and refresh stored OAuth/OIDC token bundles with
  `refreshExternalAuth(...)`
- `remix/auth-middleware` — `auth({ schemes })`, `requireAuth`, the `Auth` context key. Use to
  resolve identity into the request context and to gate routes

### UI, Hydration, and Browser Behavior

- `remix/ui` — the component runtime: components, core mixins, `clientEntry`, `run`, `<Frame>`,
  navigation helpers, and `createRoot`. Use for app UI behavior
- `remix/ui/server` — server rendering: `renderToStream`, `renderToString`. Use in the
  `render(...)` helper that returns HTML responses
- `remix/ui/animation` — animation APIs: `animateEntrance`, `animateExit`, `animateLayout`,
  `spring`, `tween`, and `easings`
- `remix/ui/<primitive>` — UI primitives, mixins, glyphs, and theme helpers. Import from
  `remix/ui/accordion`, `remix/ui/button`, `remix/ui/select`, etc.
- `remix/ui/test` — component test rendering helpers such as `render`
- `remix/ui/jsx-runtime` — JSX transform target. Configured in `tsconfig.json`, rarely
  imported directly
- `remix/html-template` — escaped HTML template literals. Use when generating HTML outside the
  component system (RSS feeds, email bodies, error pages)
- `remix/file-storage` — backend-agnostic `File` storage interface. Use as the type bound for
  upload destinations
- `remix/file-storage/fs`, `remix/file-storage/memory`, `remix/file-storage-s3` — storage
  backends. Use to implement an upload destination

### Middleware

- `remix/static-middleware` — `staticFiles(dir)`. Use to serve files from `public/` exactly as
  they exist on disk
- `remix/form-data-middleware` — `formData()`. Use to parse `FormData` once and expose it via
  `get(FormData)` instead of calling `await request.formData()` in each action
- `remix/form-data-parser` — lower-level `parseFormData`, `FileUpload`. Use when implementing
  custom upload handlers. Upload handler errors propagate directly
- `remix/multipart-parser` and `remix/multipart-parser/node` — low-level multipart stream parsing.
  `MultipartPart.headers` is a plain object keyed by lower-case header name; read values with
  bracket notation such as `part.headers['content-type']`
- `remix/compression-middleware` — `compression()`. Use globally for text-like responses
- `remix/logger-middleware` — `logger()`. Use in development for request logs; pass `colors` to
  force terminal color output on or off
- `remix/method-override-middleware` — `methodOverride()`. Use when HTML forms need `PUT`,
  `PATCH`, or `DELETE`
- `remix/async-context-middleware` — `asyncContext()`, `getContext()`. Use when helpers outside
  actions need request context without threading it through every call
- `remix/cors-middleware` — `cors(opts?)`. Use for endpoints called cross-origin
- `remix/csrf-middleware` — `csrf(opts?)`. Use when session-backed forms mutate state and need
  synchronizer-token CSRF protection
- `remix/cop-middleware` — cross-origin protection. Use to reject unsafe cross-origin browser
  requests

### Test

- `remix/test` — `describe`, `it`, and lifecycle hooks. Use as the test framework
- `remix/test/cli` — programmatic test runner APIs such as `runRemixTest`
- `remix/cli` — programmatic Remix CLI API. Use the `remix` executable for project commands such
  as `remix test`, `remix routes`, `remix skills`, and `remix doctor`
- `remix/assert` — assertion helpers. Use in place of `node:assert` so messages render cleanly
  in the runner
- `remix/terminal` — ANSI styles, color detection, style factories, and testable terminal streams.
  Use for CLIs and terminal output instead of hand-rolled escape sequences

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
import type { Controller } from 'remix/fetch-router'

import type { AppContext } from '../router.ts'
import { routes } from '../routes.ts'

export default {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let allBooks = await db.findMany(books, { orderBy: ['id', 'asc'] })
      return render(<BooksIndexPage allBooks={allBooks} />)
    },
    async show({ get, params }) {
      let db = get(Database)
      let book = await db.findOne(books, { where: { slug: params.slug } })
      if (!book) return new Response('Not Found', { status: 404 })
      return render(<BookShowPage book={book} />)
    },
  },
} satisfies Controller<typeof routes.books, AppContext>
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

### Mutate, validate, and respond

```typescript
import { redirect } from 'remix/response/redirect'
import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { Session } from 'remix/session'
import { Database } from 'remix/data-table'

let bookSchema = f.object({
  slug: f.field(s.string()),
  title: f.field(s.string()),
})

export default {
  actions: {
    async create({ get }) {
      let parsed = s.parseSafe(bookSchema, get(FormData))
      if (!parsed.success) {
        return render(<NewBookPage errors={parsed.issues} />, { status: 400 })
      }

      let db = get(Database)
      let book = await db.create(books, parsed.value)

      let session = get(Session)
      session.flash('message', `Added ${book.title}.`)

      return redirect(routes.books.show.href({ slug: book.slug }))
    },
  },
} satisfies Controller<typeof routes.books, AppContext>
```

This shape works without JavaScript, returns a `Response` for every outcome, and is ready for
`clientEntry(...)` interactivity when the UI needs it.

### Build UI from handle props plus render

```tsx
import { on, type Handle } from 'remix/ui'

function Counter(handle: Handle<{ initialCount?: number; label: string }>) {
  let count = handle.props.initialCount ?? 0

  return () => (
    <button
      mix={on('click', () => {
        count++
        handle.update()
      })}
    >
      {handle.props.label}: {count}
    </button>
  )
}
```

Only add `clientEntry(...)` and `run(...)` when the component needs browser interactivity or
browser-only APIs.
