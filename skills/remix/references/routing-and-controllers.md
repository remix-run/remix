# Routing and Controllers

## What This Covers

Patterns for declaring URLs, handling requests, and wiring routes to controllers. Read this when
the task involves:

- Defining or changing the URL surface of the app
- Writing or reorganizing controllers and actions
- Reading request data (`params`, `url`, `request`, context values)
- Returning a `Response` for HTML, redirects, JSON, or errors
- Generating internal URLs with `.href()`

The companion reference for shaping `Request` bodies, validating input, and dealing with persisted
data is `data-and-validation.md`. For request lifecycle and middleware ordering, see
`middleware-and-server.md`.

## Route Builders

Import all route builders from `remix/fetch-router/routes`.

### `route(prefix, map)` — nested route group

Adds a URL prefix to all children. Can also be called as `route(map)` without a prefix for a
top-level grouping. Inside `route(...)`, a nested map may be either a `route('prefix', { ... })`
call (when you want a shared URL prefix) or a plain object literal (when each leaf already owns
its absolute path).

```typescript
import { route, get, post } from 'remix/fetch-router/routes'

export const routes = route({
  home: '/',

  // Plain object — no shared prefix, each leaf has an absolute path.
  books: {
    index: '/books',
    show: '/books/:slug',
  },

  // route('auth', ...) — every leaf is prefixed with /auth.
  auth: route('auth', {
    login: get('login'),
    logout: post('logout'),
  }),
})
```

### Leaf route builders

| Builder | HTTP method | Example |
|---------|-------------|---------|
| `get(path)` | GET | `get('/search')` |
| `post(path)` | POST | `post('/logout')` |
| `put(path)` | PUT | `put('/api/update')` |
| `del(path)` | DELETE | `del('/api/remove')` |
| String literal | ANY | `'/about'` |

### `form(path, options?)` — form route

Creates a GET + POST pair for HTML form workflows. Expands to an `index` (GET) and an `action`
(POST) by default.

```typescript
contact: form('contact')
// Produces routes.contact.index (GET /contact) and routes.contact.action (POST /contact)

settings: form('settings', { formMethod: 'PUT', names: { action: 'update' } })
// Produces routes.settings.index (GET) and routes.settings.update (PUT)
```

### `resources(name, options?)` — REST resources

Expands to conventional CRUD routes: `index`, `new`, `create`, `show`, `edit`, `update`, `destroy`.

```typescript
books: resources('books', { param: 'bookId' })
// GET /books, GET /books/new, POST /books, GET /books/:bookId, ...

orders: resources('orders', { only: ['index', 'show'], param: 'orderId' })
// GET /orders, GET /orders/:orderId
```

### URL generation with `.href()`

Route objects expose `.href()` for type-safe URL generation:

```typescript
redirect(routes.home.href())
redirect(routes.account.orders.show.href({ orderId: '42' }))
```

## Actions

An action is a handler for a single leaf route. Type it with `BuildAction`:

```typescript
import type { BuildAction } from 'remix/fetch-router'

export const search: BuildAction<'GET', typeof routes.search> = {
  async handler({ url }) {
    let query = url.searchParams.get('q') ?? ''
    let results = await searchIndex(query)
    return render(<SearchPage query={query} results={results} />)
  },
}
```

The handler receives a context object with:

- `get(key)` — read a value set by middleware (e.g. `get(Database)`, `get(Session)`, `get(Auth)`)
- `params` — typed route params
- `url` — the request URL
- `request` — the raw `Request`

Actions with inline middleware:

```typescript
import { requireAuth } from 'remix/auth-middleware'

router.get(routes.account, {
  middleware: [requireAuth()],
  handler: accountAction.handler,
})
```

## Returning Responses

An action returns a `Response`. The shape of that response is part of the route contract, and
choosing it well saves a lot of glue elsewhere.

### Render HTML

For pages, render a component tree and return the resulting `Response`:

```typescript
async handler({ get }) {
  let db = get(Database)
  let books = await db.findMany(books, { orderBy: ['id', 'asc'] })
  return render(<IndexPage books={books} />)
}
```

### Redirect after a mutation

For state-changing routes (POST, PUT, PATCH, DELETE), the canonical reply is a redirect to the
resulting page. Pass `303` explicitly when you want a POST-redirect-GET flow:

```typescript
import { redirect } from 'remix/response/redirect'

async create({ get }) {
  let formData = get(FormData)
  let parsed = s.parseSafe(bookSchema, formData)
  if (!parsed.success) {
    return render(<NewBookPage errors={parsed.issues} />, { status: 400 })
  }

  let db = get(Database)
  let book = await db.create(books, parsed.value)

  return redirect(routes.books.show.href({ slug: book.slug }), 303)
}
```

This pattern works without JavaScript and stays compatible with `clientEntry(...)` enhancements
on top.

### Return an error response

For expected failures — validation, conflict, not found — return a `Response` directly. Reserve
thrown errors for genuinely unexpected failures.

```typescript
async show({ get, params }) {
  let db = get(Database)
  let book = await db.find(books, params.bookId)
  if (!book) return new Response('Not Found', { status: 404 })
  return render(<ShowPage book={book} />)
}
```

For form re-rendering with errors, return the page component with the parsed issues:

```typescript
let formData = get(FormData)
let parsed = s.parseSafe(signupSchema, formData)
if (!parsed.success) {
  return render(<SignupPage errors={parsed.issues} values={Object.fromEntries(formData)} />, {
    status: 400,
  })
}
```

### Return JSON

For routes consumed by client code rather than rendered as a page (autocomplete endpoints, polling
APIs, inter-service calls), return a JSON `Response`. Use `remix/headers` for cache headers
instead of hand-formatting strings:

```typescript
import { CacheControl } from 'remix/headers'

return new Response(JSON.stringify({ results }), {
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': new CacheControl({ noStore: true }).toString(),
  },
})
```

If you find yourself returning JSON for what is really a browser form submission, prefer the
redirect-after-POST pattern instead. JSON-only mutation endpoints make it harder to support
non-JS clients, harder to share rendering logic, and easier for the client to drift out of sync
with the server.

## Controllers

A controller mirrors a route map. Each key in `actions` matches a key in the route definition.
Pass `AppContext` as the second generic to `Controller` so `get(Database)`, `get(Session)`,
`get(Auth)`, etc. are typed against your middleware stack.

```typescript
import type { Controller } from 'remix/fetch-router'
import type { AppContext } from '../router.ts'

export default {
  actions: {
    async index({ get }) {
      let db = get(Database)
      let items = await db.findMany(books, { orderBy: ['id', 'asc'] })
      return render(<IndexPage items={items} />)
    },

    async show({ get, params }) {
      let db = get(Database)
      let book = await db.find(books, params.bookId)
      if (!book) return new Response('Not Found', { status: 404 })
      return render(<ShowPage book={book} />)
    },
  },
} satisfies Controller<typeof routes.books, AppContext>
```

### Nested controllers

When a route map contains nested maps, the controller nests too:

```typescript
// routes.ts
export const routes = route({
  account: route('account', {
    index: '/',
    settings: form('settings', { formMethod: 'PUT', names: { action: 'update' } }),
    orders: resources('orders', { only: ['index', 'show'], param: 'orderId' }),
  }),
})

// controllers/account/controller.tsx
import settingsController from './settings/controller.tsx'
import ordersController from './orders/controller.tsx'

export default {
  middleware: [requireAuth()],
  actions: {
    index() { return render(<AccountPage />) },
    settings: settingsController,
    orders: ordersController,
  },
} satisfies Controller<typeof routes.account, AppContext>
```

### Controller middleware

The `middleware` array on a controller runs for every action in that subtree, before action-level
middleware:

```typescript
export default {
  middleware: [requireAuth(), requireAdmin()],
  actions: { /* all actions require auth + admin */ },
} satisfies Controller<typeof routes.admin, AppContext>
```

## Registering Routes

Use `router.map` for route maps (controllers) and verb methods for leaf routes:

```typescript
let router = createRouter({ middleware })

// Route map → controller
router.map(routes.auth, authController)
router.map(routes.admin, adminController)

// Leaf route → action
router.map(routes.home, home)
router.get(routes.search, searchAction)
router.post(routes.logout, logoutAction)
```

## Typed Context

Define an `AppContext` type from your middleware stack for use in actions and controllers:

```typescript
import type { MiddlewareContext, WithParams, AnyParams } from 'remix/fetch-router'

type RootMiddleware = [
  ReturnType<typeof formData>,
  ReturnType<typeof session>,
  ReturnType<typeof loadDatabase>,
  ReturnType<typeof loadAuth>,
]

export type AppContext<params extends AnyParams = AnyParams> = WithParams<
  MiddlewareContext<RootMiddleware>,
  params
>
```

This gives typed `context.get(Database)`, `context.get(Session)`, `context.get(Auth)`, etc.
