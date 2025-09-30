# fetch-router

A minimal router built on the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`route-pattern`](../route-pattern).

## Features

- Built on the web Fetch API (`Request`, `Response`, `ReadableStream`, etc.)
- Flexible URL pattern matching using [`route-pattern`](../route-pattern)
- Powerful middleware system with strong typing
- Universal runtime support (Node.js, Bun, Deno, Cloudflare Workers, browsers)

## Examples

### Basic Routing

```tsx
import { createRoutes } from '@remix-run/route-pattern'
import { createRouter } from '@remix-run/fetch-router'

// Create a route map
let routes = createRoutes({
  home: '/',
  about: '/about',
})

// Create a router with route handlers for each route in the route map
let router = createRouter(routes, {
  home() {
    return new Response('Home')
  },
  about() {
    return new Response('About')
  },
})

let response = await router.fetch('https://remix.run/about')

console.log(response.status) // 200
console.log(await response.text()) // "About"
```

Route handlers that are functions are run for any HTTP method that matches the route pattern. To restrict a route handler to a specific HTTP method, use the `method` or `methods` properties.

```tsx
let routes = createRoutes({
  home: '/',
  articles: '/articles',
})

let router = createRouter(routes, {
  home: {
    method: 'GET',
    handler() {
      return new Response('Home')
    },
  },
  articles: {
    methods: ['GET', 'POST'],
    handler({ request }) {
      if (request.method === 'GET') {
        return new Response('Articles')
      }

      // You know this is a POST because the router will only call this
      // handler for HTTP methods specified in the `methods` property.
      invariant(request.method === 'POST')

      return new Response('Create article')
    },
  },
})
```

### HTTP Method Shorthand Handlers

A convenient shorthand for declaring HTTP method-specific route handlers is to use an object keyed by HTTP method names as the route handler.

The following is a Rails-inspired example of a router with an "articles" resource.

```tsx
import { createRoutes } from '@remix-run/route-pattern'
import { createRouter } from '@remix-run/fetch-router'

let routes = createRoutes({
  articles: {
    index: '/articles',
    new: '/articles/new',
    edit: '/articles/:id/edit',
  },
  article: '/articles/:id',
})

let router = createRouter(routes, {
  articles: {
    index: {
      // GET /articles
      get() {
        return new Response('Articles')
      },
      // POST /articles
      post() {
        return new Response('Create article')
      },
    },
    new: {
      // GET /articles/new
      get() {
        return new Response('New article')
      },
    },
    edit: {
      // GET /articles/:id/edit
      get({ params }) {
        return new Response(`Edit article ${params.id}`)
      },
    },
  },

  // Note: /articles/:id and /articles/new overlap each other, so add
  // /articles/:id route handlers AFTER /articles/new (defined above).
  article: {
    // GET /articles/:id
    get({ params }) {
      return new Response(`Show article ${params.id}`)
    },
    // PUT /articles/:id
    put({ params }) {
      return new Response(`Update article ${params.id}`)
    },
    // DELETE /articles/:id
    delete({ params }) {
      return new Response(`Delete article ${params.id}`)
    },
  },
})
```

### Using Middleware

`fetch-router` supports Express-style middleware. Middleware is run in order from left to right, and can short-circuit the chain by returning a `Response` object.

Middleware that returns `undefined` will invoke the downstream handler automatically.

```tsx
import type { RequestContext, NextFunction } from '@remix-run/fetch-router'

let routes = createRoutes({
  admin: {
    index: '/admin',
    profile: '/admin/profiles/:id',
  },
})

// Log the request and response
function logger({ request, url }: RequestContext, next: NextFunction) {
  console.log(`${request.method} ${url.pathname}`)
  let response = await next() // Invoke the downstream handler and get its response
  console.log(`${response.status} ${response.statusText}`)
  return response
}

// Check if the request is authorized
function auth({ request }: RequestContext) {
  if (request.headers.get('Authorization') !== 'Bearer 123') {
    return new Response('Unauthorized', { status: 401 })
  }
}

let router = createRouter(routes, {
  admin: {
    use: [logger, auth],
    index() {
      return new Response('Admin dashboard')
    },
    profile({ params }) {
      return new Response(`Viewing profile ${params.id}`)
    },
  },
})
```

Middleware is defined directly on the route handler object, not on the router itself. This means that middleware has type-safe access to the current route's params.

```tsx
import type { RequestContext } from '@remix-run/fetch-router'

let routes = createRoutes({
  admin: {
    profile: '/admin/profiles/:id',
  },
})

function logger({ params }: RequestContext<{ id: string }>, next) {
  // `params` is type-safe
  console.log(`Viewing profile ${params.id}`)
  let response = await next()
  console.log(`${response.status} ${response.statusText}`)
  return response
}

let router = createRouter(routes, {
  admin: {
    use: [logger],
    profile({ params }) {
      return new Response(`Viewing profile ${params.id}`)
    },
  },
})
```

You can define middlware for many route handlers at once by using the `createHandlers` helper.

```tsx
import { createHandlers, createRouter } from '@remix-run/fetch-router'
import type { RequestContext } from '@remix-run/fetch-router'

let routes = createRoutes({
  admin: {
    index: '/admin',
    profile: '/admin/profiles/:id',
  },
})

function auth({ request }: RequestContext) {
  if (request.headers.get('Authorization') !== 'Bearer 123') {
    return new Response('Unauthorized', { status: 401 })
  }
}

let adminHandlers = createHandlers(routes.admin, [auth], {
  index() {
    return new Response('Admin dashboard')
  },
  profile({ params }) {
    return new Response(`Viewing profile ${params.id}`)
  },
})

let router = createRouter(routes, {
  admin: adminHandlers,
})
```

## Demos

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos) contains working demos:

- [`demos/bookstore`](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/bookstore) - A full-featured bookstore application with authentication, middleware, and resource routes

## Related Packages

- [`route-pattern`](../route-pattern) - Flexible URL pattern matching
- [`fetch-proxy`](../fetch-proxy) - Build HTTP proxy servers using the web fetch API
- [`node-fetch-server`](../node-fetch-server) - Build HTTP servers on Node.js using the web fetch API
