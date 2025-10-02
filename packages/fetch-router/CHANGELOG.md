# `fetch-router` CHANGELOG

This is the changelog for [`fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router). It follows [semantic versioning](https://semver.org/).

## HEAD

- Add `router.map()` for registering routes and middleware either one at a time or in bulk

  ```tsx
  let router = createRouter()
  router.map('/', () => new Response('Home'))
  router.map('/blog', () => new Response('Blog'))
  ```

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
