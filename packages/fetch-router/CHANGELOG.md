# `fetch-router` CHANGELOG

This is the changelog for [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router). It follows [semantic versioning](https://semver.org/).

## HEAD

- Support nested routes in `createResource` & `createResources`
  ```ts
  let books = {
    ...resources('books'),
    author: 'books/:id/author',
    reviews: resources('books/:id/reviews', { param: 'reviewId' }),
  }
  let profile = {
    ...resource('profile'),
    admin: '/profile/admin',
    todos: resource('profile/todos'),
  }
  ```
  Now becomes
  ```ts
  let books = resources('books', {
    children: { author: 'author', reviews: resources('reviews', { param: 'reviewId' }) },
  })
  let profile = resource('profile', { children: { admin: 'admin', todos: resource('todos') } })
  ```

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
