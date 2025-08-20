# fetch-router

Work in progress router built on the Fetch API and [`route-pattern`](../route-pattern).

## Routing

Routes are defined in an array that determines the order in which they are tried, from first to last. Routes may be defined with a simple string or a `RoutePattern` for matching the incoming request's URL.

Route handlers are functions that receive a request `context` object and return a `Response` (sync) or a `Promise<Response>` (async).

Properties of the request `context` object include:

- `request` - the incoming `Request` object
- `params` - an object of `Params` that were parsed from the URL (from `route-pattern`'s `match.params` object)
- `url` - the parsed request URL (an actual `URL` object, from `match.url`)
- `set(key, value)` - sets a custom value in the request context
- `get(key)` - retrieves a custom value from the request context

```tsx
import { createRouter, createRoutes } from '@remix-run/fetch-router'
import { RoutePattern } from '@remix-run/route-pattern'
import { parseFormData } from '@remix-run/form-data-parser'

// Routes are defined in an array and are tried in order
let routes = createRoutes((route) => [
  // Routes may be declared with a simple path and a handler function
  // The default is to match any HTTP method (GET, POST, etc.)
  route('/', () => {
    return new Response('Home')
  }),
  // Routes may also use a RoutePattern, which allows users to specify { ignoreCase: true } on specific routes
  // This route matches /admin, /ADMIN, /Admin, etc.
  route(new RoutePattern('/admin', { ignoreCase: true }), () => {
    return new Response('Admin')
  }),
  // The `route` function also has properties that make it easy to narrow to specific HTTP methods
  route.post('/login', ({ request }) => {
    let formData = await parseFormData(request)
    let username = formData.get('username')
    let password = formData.get('password')
    let auth = await authorizeUser(username, password)
    return auth == null ? new Response(null, { status: 401 }) : Response.redirect('/', 302)
  }),
  route.del('/users/:id', async ({ params }) => {
    await deleteUser(params.id)
    return Response.redirect('/', 302)
  }),
  // Routes may also be declared longhand in an object with explicit properties
  route({
    method: 'GET', // Only check this route on GET requests
    pattern: '/users/:id',
    handler({ url, params }) {
      // simple logging
      console.log(`[${new Date()}] GET ${url}`)
      return new Response(`Hello user ${params.id}`)
    },
  }),
])

let router = createRouter({
  routes,
})

let response = await router.fetch(new Request('https://remix.run/users/mj'))
```

The `route` argument passed to the `createRoutes` callback is a "route builder".

## Mounting Routes

Routes may be "mounted" at a given URL prefix using the route builder's `mount()` function. Nesting `mount()` calls nests the URL pattern prefix used for all routes in that mount point. When joining mount paths, exactly one slash is used; trailing slashes on the parent are ignored (so `mount('/admin/', ...)` behaves the same as `mount('/admin', ...)`).

```tsx
import { createRoutes } from '@remix-run/fetch-router'
import type { PatternsFromRoutes } from '@remix-run/fetch-router'
import { createHrefBuilder } from '@remix-run/route-pattern'

let routes = createRoutes(({ mount }) => [
  mount('/admin', (route) => [
    route.get('/', () => {
      return new Response('Admin')
    }),
    mount('dashboard', (route) => [
      route('/', () => new Response('Admin Dashboard')),
      route('users', () => new Response('Admin Users')),
    ]),
  ]),
])

// PatternsFromRoutes is a string union type of all route patterns in an array of routes
// Routes that are nested under a prefix are prefixed with the parent mount point's pattern
type P = PatternsFromRoutes<typeof routes> // '/admin' | '/admin/dashboard' | '/admin/dashboard/users'

// This is useful for creating a type-safe href builder
let href = createHrefBuilder<P>()
```

## Middleware

Middleware are functions that appear at any point in the routes array. Middleware functions receive the current routing context and a `next` function that they can use to invoke the next middleware in the stack. Middleware may be synchronous or asynchronous; the general signature is `(context, next) => Response | void | Promise<Response | void>`. The route builder's `use()` helper accepts one or more middleware functions as varargs, e.g. `use(fn1, fn2, fn3)`.

Middleware may return one of 2 things:

- return a `Response`. This is a way to short-circuit the rest of the downstream request handling stack (including downstream middleware) and return a response immediately. Of course, if the response that is returned here was obtained by calling `next()` then nothing is actually skipped.
- return `void` (or `undefined`). If a middleware returns `undefined` the response from the downstream route handler (or middleware) is used. If the middleware did not invoke `next()` to get the response from downstream, it is automatically invoked.

```tsx
import { createRoutes } from '@remix-run/fetch-router'

function logger(context, next) {
  // Log the request on the way in
  console.log(`[${new Date()}] ${context.request.method} ${context.url}`)
  // Return the response from downstream
  return next()
}

async function responseLogger(context, next) {
  // Get the response from downstream
  let response = await next()
  // Log it
  console.log(`Response status: ${response.status}`)
  // Don't return anything, the same response as above will automatically be used
}

let routes = createRoutes((route) => [
  route.use(logger, responseLogger),
  route('/', () => {
    return new Response('Home')
  }),
])
```

## Custom Context

Middleware may set custom values in the routing context using `context.set(key, value)`. Values may be retrieved in downstream middleware and route handlers using `context.get(key)`. If a `key` has not been set, `context.get(key)` will throw an `UnsetContextError`.

The `key` should be a singleton object that is shared between the callers of `context.set()` and `context.get()`. It could be a simple string, but to avoid collision with other middleware providers it is recommended to use a unique `Symbol`.

If the `key` is an object with a `defaultValue` property, `context.get(key)` will return the value of that property when no context has been set for that key.

```tsx
import { use, route } from '@remix-run/fetch-router'

const CurrentUser = Symbol('CurrentUser')

function authMiddleware(context) {
  let currentUser = login(context.request)
  if (!currentUser) return new Response(null, { status: 401 })
  context.set(CurrentUser, currentUser)
}

let routes = [
  use(authMiddleware),
  route('/', (context) => {
    let currentUser = context.get(CurrentUser)
    return new Response(`Hello, ${currentUser}`)
  }),
]
```

## Error Handling

Errors that occur in either route handlers or middleware may be caught with a `try/catch` either around:

- a `next()` call in a middleware or
- the `router.fetch()` call at the top level

This makes it easy to embed the router in a server environment with robust error handling.

```tsx
import * as http from 'node:http'
import { createRequestListener } from '@remix-run/node-fetch-server'

let router = createRouter({
  routes: [
    // ...
  ],
})

http.createServer(
  createRequestListener(async (request) => {
    try {
      let response = await router.fetch(request)
      return response
    } catch (error) {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)
```
