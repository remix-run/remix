# fetch-router

A minimal, composable router built on the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`route-pattern`](../route-pattern).

## Features

- Built on the web Fetch API (`Request`, `Response`, `ReadableStream`, etc.)
- Flexible URL pattern matching using [`route-pattern`](../route-pattern)
- Powerful middleware system with strong typing
- Universal runtime support (Node.js, Bun, Deno, Cloudflare Workers, browsers)

## Basic Routing

```tsx
import { createRoutes, createRouter } from '@remix-run/fetch-router'

// Create a route map
let routes = createRoutes({
  home: '/',
  about: '/about',
})

// Create a router
let router = createRouter()

// Add some "route handlers" to the router
router.addRoutes(routes, {
  home() {
    return new Response('Home')
  },
  about() {
    return new Response('About')
  },
})

// Fetch the about page
let response = await router.fetch('https://remix.run/about')

console.log(response.status) // 200
console.log(await response.text()) // "About"
```

A "route handler" is a function that returns a response. By default, route handlers run on GET (and HEAD) requests. To restrict a route handler to a specific HTTP method, use an object with `method` and `handler` properties.

```tsx
let routes = createRoutes({
  home: '/',
  articles: {
    index: '/articles',
    create: { method: 'POST', pattern: '/articles' },
    show: '/articles/:id',
  },
})

let router = createRouter()

router.addRoutes(routes, {
  home() {
    return new Response('Home')
  },
  articles: {
    index() {
      return new Response('Articles')
    },
    create() {
      return new Response('Create article')
    },
    show({ params }) {
      // `params` is type-safe
      return new Response(`Article ${params.id}`)
    },
  },
})
```

## Using Resources

A resource is a collection of routes that are related to a single entity. For example, an "articles" resource might have routes for creating, reading, updating, and deleting articles. You can think about these like Rails' `resource`/`resources` helpers.

`fetch-router` provides `createResource` and `createResources` helpers for creating route maps with sets of related routes.

```tsx
import {
  createRoutes,
  createResources as resources,
  createResource as resource,
} from '@remix-run/fetch-router'

let routes = createRoutes({
  api: {
    // The `resources` helper is the same as the following:
    // articles: {
    //   index: { method: 'GET', pattern: '/api/articles' },
    //   new: { method: 'GET', pattern: '/api/articles/new' },
    //   create: { method: 'POST', pattern: '/api/articles' },
    //   show: { method: 'GET', pattern: '/api/articles/:id' },
    //   edit: { method: 'GET', pattern: '/api/articles/:id/edit' },
    //   update: { method: 'PUT', pattern: '/api/articles/:id' },
    //   destroy: { method: 'DELETE', pattern: '/api/articles/:id' },
    // }
    articles: resources('articles'),
  },
})

let router = createRouter()

router.addRoutes(routes, {
  api: {
    articles: {
      async index() {
        let articles = await Article.all()
        return Response.json({ articles })
      },
      async new() {
        let article = await Article.new()
        return Response.json(article)
      },
      async create({ request }) {
        let article = await Article.create(request)
        return Response.json(article, { status: 201 })
      },
      async show({ params }) {
        let article = await Article.get(params.id)
        return Response.json(article)
      },
      async edit({ params }) {
        let article = await Article.get(params.id)
        return Response.json(article)
      },
      async update({ params, request }) {
        await Article.update(params.id, request)
        return new Response(null, { status: 204 })
      },
      async destroy({ params }) {
        await Article.destroy(params.id)
        return new Response(null, { status: 204 })
      },
    },
  },
})

let response = await router.fetch('https://remix.run/api/articles')

console.log(response.status) // 200
console.log(await response.json()) // { articles: ... }
```

## Using Middleware

`fetch-router` is extensible via middleware. Middleware is run in order from left to right, and comes in two flavors:

- **Global middleware** is provided up front to `createRouter` and runs on every request, regardless of the route. This is generic middleware that doesn't know anything about which route matches the request, but can be useful for things like logging, rate limiting, and authentication.
- **Route middleware** is defined directly on the route handler and runs only on the routes it's defined on. This gives middleware type-safe access to the current route's `params`.

```tsx
import type { RequestContext, NextFunction } from '@remix-run/fetch-router'

// A middleware that checks if the request is authorized
function auth({ request }: RequestContext) {
  if (request.headers.get('Authorization') !== 'Bearer 123') {
    // Middleware that returns a response short-circuits the chain
    return new Response('Unauthorized', { status: 401 })
  }

  // Middleware that returns undefined automatically invokes the
  // downstream middleware or route handler
}

// A middleware that logs the profile view
function profileLogger({ params }: RequestContext<{ id: string }>) {
  console.log(`Viewing profile ${params.id}`)
}

let routes = createRoutes({
  admin: {
    index: '/admin',
    profile: '/admin/profiles/:id',
  },
})

// The `auth` middleware runs on every request
let router = createRouter([auth])

router.addRoutes(routes, {
  admin: {
    index() {
      return new Response('Admin dashboard')
    },
    profile: {
      // The `profileLogger` middleware runs only on this route
      use: [profileLogger],
      handler({ params }) {
        return new Response(`Viewing profile ${params.id}`)
      },
    },
  },
})
```

## Route Composition

`fetch-router` is designed to be composable. Both route and route handler maps may be composed of smaller pieces, preserving full type-safety along the way. This is useful for building larger applications by breaking down the route handlers into separate files.

```tsx
import { createHandlers, createRoutes, createRouter } from '@remix-run/fetch-router'
import type { RequestContext } from '@remix-run/fetch-router'

// routes.ts
let blogRoutes = createResource('blog', {
  base: '/blog',
  param: 'slug',
  only: ['index', 'show'],
})

let routes = createRoutes({
  admin: {
    index: '/admin',
    profile: '/admin/profiles/:id',
  },
  // Attach the blog routes map to this map
  blog: blogRoutes,
})

// app/admin.ts
function authAdmin({ request }: RequestContext) {
  if (request.headers.get('Authorization') !== 'Bearer 123') {
    return new Response('Unauthorized', { status: 401 })
  }
}

// Define handlers for all routes in `routes.admin`
let adminHandlers = createHandlers(routes.admin, [authAdmin], {
  index() {
    return new Response('Admin dashboard')
  },
  profile({ params }) {
    return new Response(`Viewing profile ${params.id}`)
  },
})

// app/blog.ts
// Define handlers for all routes in `routes.blog`
let blogHandlers = createHandlers(routes.blog, {
  index() {
    return new Response('Blog index')
  },
  show({ params }) {
    return new Response(`Blog post ${params.slug}`)
  },
})

// server.ts
let router = createRouter()

router.addRoutes(routes, {
  // Stitch them all together in a final route handler map that defines
  // handlers for all routes in the map
  admin: adminHandlers,
  blog: blogHandlers,
})
```

## Demos

The [`demos` directory](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos) contains working demos:

- [`demos/bookstore`](https://github.com/remix-run/remix/tree/main/packages/fetch-router/demos/bookstore) - A full-featured bookstore application with authentication, middleware, and resource routes

## Related Packages

- [`route-pattern`](../route-pattern) - Flexible URL pattern matching
- [`fetch-proxy`](../fetch-proxy) - Build HTTP proxy servers using the web fetch API
- [`node-fetch-server`](../node-fetch-server) - Build HTTP servers on Node.js using the web fetch API
