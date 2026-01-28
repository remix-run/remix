# `fetch-router` CHANGELOG

This is the changelog for [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router). It follows [semantic versioning](https://semver.org/).

## v0.16.0

### Minor Changes

- BREAKING CHANGE: Remove `Router.size` property

  `Matcher`s no longer keep track of size, so `Router` cannot wrap `Matcher.size` anymore.

### Patch Changes

- Bumped `@remix-run/*` dependencies:
  - [`@remix-run/route-pattern@0.18.0`](https://github.com/remix-run/remix/releases/tag/route-pattern@0.18.0)

## v0.15.1

### Patch Changes

- Changed `@remix-run/*` peer dependencies to regular dependencies

## v0.15.0

### Minor Changes

- BREAKING CHANGE: `RequestContext.headers` now returns a standard `Headers` instance instead of the `SuperHeaders`/`Headers` subclass from `@remix-run/headers`. As a result, the `@remix-run/headers` peer dependency has now been removed.

  If you were relying on the type-safe property accessors on `RequestContext.headers`, you should use the new parse functions from `@remix-run/headers` instead:

  ```ts
  // Before:
  router.get('/api/users', (context) => {
    let acceptsJson = context.headers.accept.accepts('application/json')
    // ...
  })

  // After:
  import { Accept } from '@remix-run/headers'

  router.get('/api/users', (context) => {
    let accept = Accept.from(context.headers.get('accept'))
    let acceptsJson = accept.accepts('application/json')
    // ...
  })
  ```

## v0.14.0 (2025-12-18)

- BREAKING CHANGE: Remove `BuildRequestHandler` type. Use `RequestHandler` type directly instead.

- BREAKING CHANGE: Remove `T` generic parameter from `RequestHandler` type. Request handlers always return a `Response`.

- Export the `MatchData` type from the public API. This type is required when creating custom matchers for use with the router's `matcher` option.

## v0.13.0 (2025-12-01)

- BREAKING CHANGE: Renamed "route handlers" terminology to "controller/action" throughout the package. This is a breaking change for anyone using the types or properties from this package. Update your code:

  ```tsx
  // Before
  import type { RouteHandlers } from '@remix-run/fetch-router'

  let routeHandlers = {
    middleware: [auth()],
    handlers: {
      home() {
        return new Response('Home')
      },
      admin: {
        middleware: [requireAdmin()],
        handler() {
          return new Response('Admin')
        },
      },
    },
  } satisfies RouteHandlers<typeof routes>

  router.map(routes, routeHandlers)

  // After
  import type { Controller } from '@remix-run/fetch-router'

  let controller = {
    middleware: [auth()],
    actions: {
      home() {
        return new Response('Home')
      },
      admin: {
        middleware: [requireAdmin()],
        action() {
          return new Response('Admin')
        },
      },
    },
  } satisfies Controller<typeof routes>

  router.map(routes, controller)
  ```

  Summary of changes:

  - `RouteHandlers` type => `Controller`
  - `RouteHandler` type => `Action`
  - `BuildRouteHandler` type => `BuildAction`
  - `handlers` property => `actions`
  - `handler` property => `action`

- BREAKING CHANGE: Renamed `formAction` route helper to `form` and moved route helpers to `lib/route-helpers/` subdirectory. Update your imports:

  ```tsx
  // Before
  import { route, formAction } from '@remix-run/fetch-router'

  let routes = route({
    login: formAction('/login'),
  })

  // After
  import { route, form } from '@remix-run/fetch-router'

  let routes = route({
    login: form('/login'),
  })
  ```

  The `FormActionOptions` type has also been renamed to `FormOptions`.

- BREAKING CHANGE: The `middleware` property is now required (not optional) in controller and action objects that use the `{ middleware, actions }` or `{ middleware, action }` format. This eliminates ambiguity when route names like `action` collide with the `action` property name.

  ```tsx
  // Before: { action } without middleware was allowed
  router.any(routes.home, {
    action() {
      return new Response('Home')
    },
  })

  // After: just use a plain request handler function instead
  router.any(routes.home, () => {
    return new Response('Home')
  })

  // Before: { actions } without middleware was allowed
  router.map(routes, {
    actions: {
      home() {
        return new Response('Home')
      },
    },
  })

  // After: just use a plain controller object instead
  router.map(routes, {
    home() {
      return new Response('Home')
    },
  })

  // With middleware, the syntax remains the same (but middleware is now required)
  router.map(routes, {
    middleware: [auth()],
    actions: {
      home() {
        return new Response('Home')
      },
    },
  })
  ```

- Add functional aliases for creating routes that respond to a single request method

  ```tsx
  import { del, get, patch, post } from '@remix-run/fetch-router'

  let routes = route({
    home: get('/'),
    login: post('/login'),
    logout: post('/logout'),
    profile: {
      show: get('/profile'),
      edit: get('/profile/edit'),
      update: patch('/profile'),
      destroy: del('/profile'),
    },
  })
  ```

## v0.12.0 (2025-11-25)

- BREAKING CHANGE: Moved all response helpers to `@remix-run/response`. Update your imports:

  ```tsx
  // Before
  import * as res from '@remix-run/fetch-router/response-helpers'

  res.file(file, request)
  res.html(body)
  res.redirect(location, status, headers)

  // After
  import { createFileResponse } from '@remix-run/response/file'
  import { createHtmlResponse } from '@remix-run/response/html'
  import { createRedirectResponse } from '@remix-run/response/redirect'

  createFileResponse(file, request)
  createHtmlResponse(body)
  createRedirectResponse(location, status)
  ```

- BREAKING CHANGE: Rename `InferRequestHandler` => `BuildRequestHandler`
- Add `exclude` option to `resource()` and `resources()` route map helpers (#10858)

## v0.11.0 (2025-11-21)

- BREAKING CHANGE: `Router` is no longer exported as a class, use `createRouter()` instead.

  ```tsx
  // Before
  import { Router } from '@remix-run/fetch-router'
  let router = new Router()

  // After
  import { createRouter } from '@remix-run/fetch-router'
  let router = createRouter()

  // For type annotations, use the Router interface
  import type { Router } from '@remix-run/fetch-router'
  function setupRoutes(router: Router) {
    // ...
  }
  ```

  This change improves the ergonomics of the router by eliminating the need to bind methods when passing `router.fetch` as a callback, for example in `node-fetch-server`'s `createRequestListener(router.fetch)`.

- Make `middleware` optional in route handler(s) objects passed to `router.map()`

  ```tsx
  // Before
  router.map('/', {
    middleware: [], // required
    handler() {
      return new Response('Home')
    },
  })

  // After
  router.map('/', {
    // middleware is optional!
    handler() {
      return new Response('Home')
    },
  })
  ```

## v0.10.0 (2025-11-19)

- BREAKING CHANGE: All middleware has been extracted into separate npm packages for independent versioning and deployment. Update your imports:

  ```tsx
  // Before
  import { asyncContext } from '@remix-run/fetch-router/async-context-middleware'
  import { formData } from '@remix-run/fetch-router/form-data-middleware'
  import { logger } from '@remix-run/fetch-router/logger-middleware'
  import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'
  import { session } from '@remix-run/fetch-router/session-middleware'
  import { staticFiles } from '@remix-run/fetch-router/static-middleware'

  // After
  import { asyncContext } from '@remix-run/async-context-middleware'
  import { formData } from '@remix-run/form-data-middleware'
  import { logger } from '@remix-run/logger-middleware'
  import { methodOverride } from '@remix-run/method-override-middleware'
  import { session } from '@remix-run/session-middleware'
  import { staticFiles } from '@remix-run/static-middleware'
  ```

  Each middleware now has its own package with independent dependencies, changelog, and versioning.

- `html()` response helper now automatically prepends `<!DOCTYPE html>` to the body if it is not already present

## v0.9.0 (2025-11-18)

- Add `session` middleware for automatic management of `context.session` across requests

  ```tsx
  import { createCookie } from '@remix-run/cookie'
  import { createFileStorage } from '@remix-run/session/file-storage'
  import { session } from '@remix-run/fetch-router/session-middleware'

  let cookie = createCookie('session', { secrets: ['s3cr3t'] })
  let storage = createFileStorage('/tmp/sessions')

  let router = createRouter({
    middleware: [session(cookie, storage)],
  })

  router.map('/', ({ session }) => {
    session.set('count', Number(session.get('count') ?? 0) + 1)
    return new Response(`Count: ${session.get('count')}`)
  })
  ```

- Add `asyncContext` middleware for storing the request context in `AsyncLocalStorage` so it is available to all functions in the same async execution context

  ```tsx
  import * as assert from 'node:assert/strict'
  import { asyncContext } from '@remix-run/fetch-router/async-context-middleware'

  let router = createRouter({
    middleware: [asyncContext()],
  })

  router.map('/', (context) => {
    assert.equal(context, getContext())
    return new Response('Home')
  })
  ```

- Add `file` response helper for serving files

  ```tsx
  import * as res from '@remix-run/fetch-router/response-helpers'
  import { openFile } from '@remix-run/fs'

  router.get('/assets/:filename', async ({ request, params }) => {
    let file = openFile(`./public/assets/${params.filename}`)
    return res.file(file, request)
  })
  ```

- Add `staticFiles` middleware for serving static files

  ```tsx
  import { staticFiles } from '@remix-run/fetch-router/static-middleware'

  let router = createRouter({
    middleware: [staticFiles('./public')],
  })
  ```

## v0.8.0 (2025-11-03)

- BREAKING CHANGE: Rework how middleware works in the router. This change has far-reaching implications.

  Previously, the router would associate all middleware with a route. If no routes matched, middleware would not run. We partially addressed this in 0.7 by always running global middleware, even when no route matches. However, the router would still run its route matching algorithm before determining that no routes matched, so it could proceed to run global middleware and the default handler.

  In this release, `router.use()` has been replaced with `createRouter({ middleware })`. Middleware that is provided to `createRouter()` is "router middleware" (aka "global" middleware) that runs before the router tries to do any route matching. Router middleware may therefore modify the request context in ways that may affect route matching, including modifying `context.method` and/or `context.url`. Router middleware runs on every request, even when no routes match.

  Middleware is still supported at the route level on individual routes, but it is only invoked when that route matches. This is "route middleware" (or "inline" middleware) and runs downstream from router middleware.

  To migrate, move middleware from `router.use()` to `createRouter({ middleware })`.

  ```tsx
  // before
  let router = createRouter()
  router.use(middleware)
  router.map(routes.home, () => new Response('Home'))

  // after
  let router = createRouter({
    middleware: [middleware],
  })
  router.map(routes.home, () => new Response('Home'))
  ```

- BREAKING CHANGE: Rename `use` => `middleware` in route handler definitions

  ```tsx
  // before
  router.map(routes.home, {
    use: [middleware],
    handler() {
      return new Response('Home')
    },
  })

  // after
  router.map(routes.home, {
    middleware: [middleware],
    handler() {
      return new Response('Home')
    },
  })
  ```

- BREAKING CHANGE: Remove `router.mount()` and support for sub-routers. We may add this back in a future release if there is demand for it.

- BREAKING CHANGE: Move `FormData` parsing and method override handling out of the router and into separate middleware exports. Since `methodOverride()` provides `context.method` (used for route matching), it must be router (or "global") middleware. Also, it requires `context.formData`, so it must be after the `formData()` middleware in the middleware chain. This change also moves the `createRouter({ parseFormData, methodOverride, uploadHandler })` options to the `formData()` and `methodOverride()` middlewares.

  ```tsx
  // before
  let router = createRouter({ parseFormData: true, methodOverride: true, uploadHandler })

  // after
  import { formData } from '@remix-run/fetch-router/form-data-middleware'
  import { methodOverride } from '@remix-run/fetch-router/method-override-middleware'

  let router = createRouter()
  router.use(formData({ uploadHandler }))
  router.use(methodOverride())
  ```

  This change makes things a little more verbose but should ultimately lead to more flexible middleware composition and a smaller core build.

## v0.7.0 (2025-10-31)

- BREAKING CHANGE: Move `@remix-run/form-data-parser`, `@remix-run/headers`, and `@remix-run/route-pattern` to `peerDependencies`.
- BREAKING CHANGE: Rename `InferRouteHandler` => `BuildRouteHandler` and add a `Method` generic parameter to build a `RouteHandler` type from a string, route pattern, or route.
- BREAKING CHANGE: Removed support for passing a `Route` object to `redirect()` response helper. Use `redirect(routes.home.href())` instead.
- BREAKING CHANGE: Move `html()`, `json()`, and `redirect()` response helpers to `@remix-run/fetch-router/response-helpers` export
- Always run global middleware, even when no route matches
- More precise type inference for `router.get()`, `router.post()`, etc. route handlers.
- Add support for nesting route maps via object spread syntax

  ```tsx
  import { route, resources } from '@remix-run/fetch-router'

  let routes = route({
    brands: {
      ...resources('brands', { only: ['index', 'show'] }),
      products: resources('brands/:brandId/products', { only: ['index', 'show'] }),
    },
  })

  routes.brands.index // Route<'GET', '/brands'>
  routes.brands.show // Route<'GET', '/brands/:id'>
  routes.brands.products.index // Route<'GET', '/brands/:brandId/products'>
  routes.brands.products.show // Route<'GET', '/brands/:brandId/products/:id'>
  ```

- Add support for `URL` objects in `redirect()` response helper
- Add support for `request.signal` abort, which now short-circuits the middleware chain. `router.fetch()` will now throw `DOMException` with `error.name === 'AbortError'` when a request is aborted
- Fix an issue where `Router`'s `fetch` wasn't spec-compliant
- Provide empty `context.formData` to `POST`/`PUT`/etc handlers when `parseFormData: false`

## v0.6.0 (2025-10-10)

- BREAKING CHANGE: Rename
  - `resource('...', { routeNames })` to `resource('...', { names })`
  - `resources('...', { routeNames })` to `resources('...', { names })`
  - `formAction('...', { routeNames })` to `formAction('...', { names })`
  - `formAction('...', { submitMethod })` to `formAction('...', { formMethod })`
- Integrate form data handling directly into the router, along with support for method override and file uploads. The `methodOverride` field overrides the request method used for matching with the value submitted in the request body. This makes it possible to use HTML forms to simulate RESTful API request methods like PUT and DELETE.

  ```tsx
  let router = createRouter({
    // Options for parsing form data, or `false` to disable
    parseFormData: {
      maxFiles: 5, // Maximum number of files that can be uploaded in a single request
      maxFileSize: 10 * 1024 * 1024, // 10MB maximum size of each file
      maxHeaderSize: 1024 * 1024, // 1MB maximum size of the header
    },
    // A function that handles file uploads. It receives a `FileUpload` object and may return any value that is valid in a `FormData` object
    uploadHandler(file: FileUpload) {
      // save the file to disk/storage...
      return '/uploads/file.jpg'
    },
    // The name of the form field to check for method override, or `false` to disable
    methodOverride: '_method',
  })
  ```

- Export `InferRouteHandler` and `InferRequestHandler` types
- Re-export `FormDataParseError`, `FileUpload`, and `FileUploadHandler` from `@remix-run/form-data-parser`
- Fix an issue where per-route middleware was not being applied to a route handler nested inside a route map with its own middleware

## v0.5.0 (2025-10-05)

- Add `formData` middleware for parsing `FormData` objects from the request body

  ```tsx
  import { formData } from '@remix-run/fetch-router/form-data-middleware'

  let router = createRouter()

  router.use(formData())

  router.map('/', ({ formData, files }) => {
    console.log(formData) // FormData from the request body
    console.log(files) // Record<string, File> from the request body
    return new Response('Home')
  })
  ```

- Add `storage.has(key)` for checking if a value is stored for a given key
- Add `next(moreContext)` API for passing additional context to the next middleware or handler in the chain
- Move `logger` middleware to `@remix-run/fetch-router/logger-middleware` export
- Add `json` and `redirect` response helpers

  ```tsx
  import { json, redirect, createRouter } from '@remix-run/fetch-router'

  let router = createRouter()

  router.map('/api', () => {
    return json({ message: 'Hello, world!' })
  })

  router.map('/*path/', ({ params }) => {
    // Strip all trailing slashes from URL paths
    return redirect(`/${params.path}`, 301)
  })
  ```

  `redirect` also accepts a `Route` object for type-safe redirects:

  ```tsx
  let routes = createRoutes({
    home: '/',
  })

  let response = redirect(routes.home)
  ```

  Note: the route must support `GET` (or `ANY`) for redirects and must not have any required params, so the helper can safely construct the redirect URL.

## v0.4.0 (2025-10-04)

- BREAKING CHANGE: Remove "middleware as an optional 2nd arg" from all router methods and introduced support for defining middleware inline in route handler definitions. This greatly reduces the number of overloads required in the router API and also provides a means whereby middleware may be coupled to request handler definitions

  ```tsx
  // before
  router.map('/', [middleware], () => {
    return new Response('Home')
  })

  // after
  router.map('/', {
    use: [middleware],
    handler(ctx) {
      return new Response('Home')
    },
  })
  ```

- Add `routeNames` option to `createResource` and `createResources` for customizing the names of the resource routes. This is a map of the default route name to a custom name.

  ```tsx
  let books = createResources('books', {
    routeNames: { index: 'list', show: 'view' },
  })

  books.list // Route<'GET', '/books'>
  books.view // Route<'GET', '/books/:id'>
  ```

- Add `route` shorthand for `createRoutes` to public exports
- Add support for any `BodyInit` in `html(body)` response helper
- Add `createFormAction` (also exported as `formAction` for short) for creating route maps with `index` (`GET`) and `action` (`POST`) routes. This is well-suited to showing a standard HTML `<form>` and handling its submit action at the same URL.
- Export `RouteHandlers` and `RouteHandler` types

## v0.3.0 (2025-10-03)

- Add `router.map()` for registering routes and middleware either one at a time or in bulk

  One at a time:

  ```tsx
  let router = createRouter()
  router.map('/', () => new Response('Home'))
  router.map('/blog', () => new Response('Blog'))
  ```

  In bulk:

  ```tsx
  let routes = createRoutes({
    home: '/',
    blog: '/blog',
  })

  let router = createRouter()

  router.map(routes, {
    home() {
      return new Response('Home')
    },
    blog() {
      return new Response('Blog')
    },
  })
  ```

- Add `createResource` and `createResources` functions for creating resource-based route maps

  ```tsx
  import { resource, resources, createRoutes } from '@remix-run/fetch-router'

  let routes = createRoutes({
    home: '/',
    books: resources('books'), // Plural resources
    profile: resource('profile'), // Singleton resource
  })

  let router = createRouter()

  // Plural resources
  router.map(routes.books, {
    // GET /books
    index() {
      return new Response('Books Index')
    },
    // POST /books
    create() {
      return new Response('Book Created', { status: 201 })
    },
    // GET /books/new
    new() {
      return new Response('New Book')
    },
    // GET /books/:id
    show({ params }) {
      return new Response(`Book ${params.id}`)
    },
    // GET /books/:id/edit
    edit({ params }) {
      return new Response(`Edit Book ${params.id}`)
    },
    // PUT /books/:id
    update({ params }) {
      return new Response(`Updated Book ${params.id}`)
    },
    // DELETE /books/:id
    destroy({ params }) {
      return new Response(`Destroyed Book ${params.id}`)
    },
  })

  // Singleton resource
  router.map(routes.profile, {
    // GET /profile/:id
    show({ params }) {
      return new Response(`Profile ${params.id}`)
    },
    // GET /profile/new
    new() {
      return new Response('New Profile')
    },
    // POST /profile
    create() {
      return new Response('Profile Created', { status: 201 })
    },
    // GET /profile/:id/edit
    edit({ params }) {
      return new Response(`Edit Profile ${params.id}`)
    },
    // PUT /profile/:id
    update({ params }) {
      return new Response(`Updated Profile ${params.id}`)
    },
    // DELETE /profile/:id
    destroy({ params }) {
      return new Response(`Destroyed Profile ${params.id}`)
    },
  })
  ```

## v0.2.0 (2025-10-02)

- Add `router.mount(prefix, router)` method for mounting a router at a given pathname prefix in another router

  ```tsx
  let apiRouter = createRouter()
  apiRouter.get('/', () => new Response('API'))

  let router = createRouter()
  router.mount('/api', apiRouter)

  let response = await router.fetch('https://remix.run/api')

  assert.equal(response.status, 200)
  assert.equal(await response.text(), 'API')
  ```

## v0.1.0 (2025-10-01)

- Initial release
