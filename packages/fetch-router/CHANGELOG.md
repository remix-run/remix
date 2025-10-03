# `fetch-router` CHANGELOG

This is the changelog for [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router). It follows [semantic versioning](https://semver.org/).

## HEAD

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
