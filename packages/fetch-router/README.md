# fetch-router

A minimal router and middleware runtime built on the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`route-pattern`](https://github.com/remix-run/remix/tree/main/packages/route-pattern). Use it to compose mounted router scopes, share request-scoped context, and keep route patterns type-safe across Node.js, Bun, Deno, Cloudflare Workers, and browsers.

## Features

- **Fetch API runtime**: Register handlers that consume `Request` and return `Response`
- **Mounted router scopes**: Compose nested router trees with `mount()` and inherit parent params and context automatically
- **Typed route constants**: Define reusable paths and `href()` helpers with `route()`, `form()`, `resource()`, and `resources()`
- **Router-scoped middleware**: Attach middleware to a router scope and let it flow naturally into mounted subtrees
- **Request-scoped context**: Share typed data between middleware and handlers with `createContextKey()` and `context.get()`
- **Phase-1 compatibility**: Keep using `router.map()`, `createController()`, and `createAction()` while migrating older code

## Installation

```sh
npm i remix
```

## Usage

The main purpose of `fetch-router` is to map incoming requests to request handlers and middleware. Import route definition helpers from `remix/fetch-router/routes` and runtime APIs from `remix/fetch-router`.

```ts
import { createRouter } from 'remix/fetch-router'
import { route } from 'remix/fetch-router/routes'

let routes = route({
  home: '/',
  blog: {
    index: '/blog',
    show: '/blog/:slug',
  },
})

let router = createRouter()

router.get(routes.home, () => new Response('Home'))

let blog = createRouter()
blog.get('/', () => new Response('Blog Index'))
blog.get('/:slug', ({ params }) => new Response(`Post ${params.slug}`))

router.mount('/blog', blog)

let response = await router.fetch('https://remix.run/blog/hello-remix')
console.log(await response.text()) // "Post hello-remix"
```

Mounted child routers register patterns relative to their mount point. In the example above, `blog.get('/:slug', ...)` handles `/blog/:slug` because the child router was mounted at `/blog`.

Route maps still keep the same nested object shape you pass to `route()`, but in the mount-based API they are primarily used as typed path constants and `href()` helpers.

## Mounting Routers

`mount()` is the primary composition primitive in the new API. It has two forms:

- `router.mount('/path', child => { ... })` for inline mounted scopes
- `router.mount('/path', childRouter)` for reusable child routers

Callback mounts are the most ergonomic because the child router inherits parent context and params automatically.

```ts
import { createRouter } from 'remix/fetch-router'

let router = createRouter()

router.mount('/orgs/:orgId', org => {
  org.mount('/users/:userId', users => {
    users.get('/posts/:postId', ({ params }) => {
      return Response.json({
        orgId: params.orgId,
        userId: params.userId,
        postId: params.postId,
      })
    })
  })
})
```

In that handler, `params` includes all three params:

- `orgId` from the first mount
- `userId` from the nested mount
- `postId` from the route itself

Duplicate param names across mount paths and route paths are rejected so handlers never see ambiguous params.

Mounted child routers also get a scoped `context.url.pathname`. Inside a child mounted at `/blog`, a handler for `/:slug` sees `context.url.pathname === '/hello-remix'`, while `context.request.url` still contains the full original URL.

## Route Constants and `href()` Helpers

Route helpers from `remix/fetch-router/routes` let you define reusable paths once and use them for both registration and navigation.

```ts
import { createRouter } from 'remix/fetch-router'
import { formData } from 'remix/form-data-middleware'
import { form, route } from 'remix/fetch-router/routes'
import { createHtmlResponse } from 'remix/response/html'

let routes = route({
  home: '/',
  contact: form('contact'),
})

let router = createRouter({ middleware: [formData()] })

router.get(routes.home, () => {
  return createHtmlResponse(`
    <html>
      <body>
        <a href="${routes.contact.index.href()}">Contact</a>
      </body>
    </html>
  `)
})

router.get(routes.contact.index, () => {
  return createHtmlResponse(`
    <html>
      <body>
        <form method="POST" action="${routes.contact.action.href()}">
          <input type="text" name="message" />
          <button type="submit">Send</button>
        </form>
      </body>
    </html>
  `)
})

router.post(routes.contact.action, ({ get }) => {
  let formData = get(FormData)
  let message = formData.get('message') as string
  return Response.json({ message })
})
```

The `route()`, `form()`, `resource()`, and `resources()` helpers are all still useful in the new API:

- `route()` creates arbitrary nested path constants
- `form()` creates `index` and `action` routes for a form-style endpoint
- `resource()` creates a singleton resource route map
- `resources()` creates a collection-style resource route map

For example, resource helpers work naturally with direct route registration:

```ts
import { createRouter } from 'remix/fetch-router'
import { resources, route } from 'remix/fetch-router/routes'

let routes = route({
  posts: resources('posts', { only: ['index', 'show', 'create'] }),
})

let router = createRouter()

router.get(routes.posts.index, () => new Response('All Posts'))
router.get(routes.posts.show, ({ params }) => new Response(`Post ${params.id}`))
router.post(routes.posts.create, () => new Response('Created', { status: 201 }))
```

## Router-Scoped Middleware

Middleware now fits most naturally at the router level. Parent router middleware runs before child router middleware, and both run before the final route handler.

```ts
import type { Middleware } from 'remix/fetch-router'
import { createRouter } from 'remix/fetch-router'

function logger(): Middleware {
  return async (context, next) => {
    let start = Date.now()
    let response = await next()
    let duration = Date.now() - start

    console.log(`${context.request.method} ${context.request.url} ${response.status} ${duration}ms`)

    return response
  }
}

function requireAdmin(): Middleware {
  return context => {
    if (context.headers.get('x-admin') !== 'true') {
      return new Response('Forbidden', { status: 403 })
    }
  }
}

let router = createRouter({ middleware: [logger()] })
let admin = createRouter({ middleware: [requireAdmin()] })

admin.get('/dashboard', () => new Response('Admin'))
router.mount('/admin', admin)
```

If you need one-off protection for a single route, prefer a tiny mounted child router instead of attaching middleware directly to the route:

```ts
let account = createRouter({ middleware: [requireAdmin()] })
account.get('/', () => new Response('Account'))

router.mount('/account', account)
```

Legacy route-level middleware on `{ action, middleware }` objects still works, but it is now considered the compatibility path.

## Reusable Child Routers

Inline mount callbacks inherit parent context automatically. Reusable child routers need to declare only the minimum incoming context they require from their parent.

```ts
import {
  createContextKey,
  createRouter,
  type Middleware,
  type RequestContext,
} from 'remix/fetch-router'

type User = { id: string; email: string }
const CurrentUser = createContextKey<User | null>(null)

type UserContext = RequestContext<{}, [[typeof CurrentUser, User]]>

function loadCurrentUser(): Middleware<any, any, [[typeof CurrentUser, User]]> {
  return async (context, next) => {
    context.set(CurrentUser, { id: '1', email: 'hello@remix.run' })
    return next()
  }
}

function createSettingsRouter() {
  let router = createRouter<UserContext>()

  router.get('/profile', context => {
    let user = context.get(CurrentUser)
    return Response.json({ id: user.id, email: user.email })
  })

  return router
}

let app = createRouter({ middleware: [loadCurrentUser()] })
app.mount('/settings', createSettingsRouter())
```

That child router does not require a specific parent router type. It only requires that the parent provide `CurrentUser` in request context.

## Request Context

Every handler and middleware receives a `RequestContext` with useful request data and request-scoped storage.

```ts
import { createContextKey } from 'remix/fetch-router'

let currentUser = createContextKey<{ id: string } | null>(null)

router.get('/posts/:id', context => {
  console.log(context.request.method)
  console.log(context.request.headers.get('Accept'))

  console.log(context.url.pathname)
  console.log(context.url.searchParams.get('sort'))

  console.log(context.params.id)

  context.set(currentUser, { id: 'user-1' })
  let user = context.get(currentUser)
  console.log(user?.id)

  return new Response(`Post ${context.params.id}`)
})
```

The most important pieces of `RequestContext` are:

- `request`: the original `Request`
- `headers`: a mutable copy of request headers
- `url`: the current router-scoped `URL`
- `params`: typed route params accumulated from mounts and the matched route
- `get(key)` / `set(key, value)` / `has(key)`: typed request-scoped storage
- `router`: the current router scope handling the request

## Legacy Compatibility APIs

The old controller-centric APIs are still available during the migration:

- `router.map()`
- `createController()`
- `createAction()`
- route-local middleware via `{ action, middleware }`

They are now compatibility APIs layered on top of the mounted router core. Existing apps can keep using them while migrating incrementally, but new code should prefer direct `router.get()` / `router.post()` registration and `mount()`.

## Testing

Testing is straightforward because `fetch-router` uses the standard `fetch()` API.

```ts
import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRouter } from 'remix/fetch-router'

describe('blog routes', () => {
  it('creates a post', async () => {
    let router = createRouter()
    router.post('/posts', () => Response.json({ title: 'Hello' }, { status: 201 }))

    let response = await router.fetch('https://api.remix.run/posts', {
      method: 'POST',
    })

    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { title: 'Hello' })
  })
})
```

No special test harness or mocking required. Just call `router.fetch()` like you would in production.

## Related Packages

- [`auth-middleware`](https://github.com/remix-run/remix/tree/main/packages/auth-middleware) - Request-time auth resolution and route protection
- [`session-middleware`](https://github.com/remix-run/remix/tree/main/packages/session-middleware) - Load and persist sessions in request context
- [`static-middleware`](https://github.com/remix-run/remix/tree/main/packages/static-middleware) - Serve static assets from router middleware
- [`response`](https://github.com/remix-run/remix/tree/main/packages/response) - Response helpers for HTML, JSON, redirects, files, and compression

## Related Work

- [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [URL Pattern matching and params](https://github.com/remix-run/remix/tree/main/packages/route-pattern)
- [Express](https://expressjs.com/)
- [Hono](https://hono.dev/)

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
