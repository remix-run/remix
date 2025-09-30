import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from '@remix-run/route-pattern'

import type { Assert, IsEqual } from './type-utils.ts'
import { createRoutes, createHandlers, createRouter, createRoute, createHandler } from './router.ts'
import type { NextFunction, RequestContext, Route } from './router.ts'
import { createStorageKey } from './app-storage.ts'

describe('createRoutes()', () => {
  it('creates a route map', () => {
    let routes = createRoutes({
      home: '/',
      users: {
        index: '/users',
        show: {
          pattern: '/users/:id',
        },
        edit: {
          method: 'POST',
          pattern: '/users/:id/edit',
        },
      },
    })

    assert.equal(routes.home.method, 'GET')
    assert.deepEqual(routes.home.pattern, new RoutePattern('/'))

    assert.equal(routes.users.index.method, 'GET')
    assert.deepEqual(routes.users.index.pattern, new RoutePattern('/users'))

    assert.equal(routes.users.show.method, 'GET')
    assert.deepEqual(routes.users.show.pattern, new RoutePattern('/users/:id'))

    assert.equal(routes.users.edit.method, 'POST')
    assert.deepEqual(routes.users.edit.pattern, new RoutePattern('/users/:id/edit'))
  })

  it('creates a route map with a base pattern', () => {
    let categoriesRoutes = createRoutes('categories', {
      index: '/',
      edit: {
        method: 'POST',
        pattern: '/:slug/edit',
      },
    })

    let routes = createRoutes('https://remix.run', {
      home: '/',
      users: {
        index: '/users',
        show: '/users/:id',
      },
      // nested route map
      categories: categoriesRoutes,
    })

    type T = [
      Assert<IsEqual<typeof routes.home, Route<'GET', 'https://remix.run'>>>,
      Assert<
        IsEqual<
          typeof routes.users,
          {
            readonly index: Route<'GET', 'https://remix.run/users'>
            readonly show: Route<'GET', 'https://remix.run/users/:id'>
          }
        >
      >,
      Assert<
        IsEqual<
          typeof routes.categories,
          {
            readonly index: Route<'GET', 'https://remix.run/categories'>
            readonly edit: Route<'POST', 'https://remix.run/categories/:slug/edit'>
          }
        >
      >,
    ]

    assert.equal(routes.home.method, 'GET')
    assert.deepEqual(routes.home.pattern, new RoutePattern('https://remix.run/'))

    assert.equal(routes.users.index.method, 'GET')
    assert.deepEqual(routes.users.index.pattern, new RoutePattern('https://remix.run/users'))

    assert.equal(routes.users.show.method, 'GET')
    assert.deepEqual(routes.users.show.pattern, new RoutePattern('https://remix.run/users/:id'))

    assert.equal(routes.categories.index.method, 'GET')
    assert.deepEqual(
      routes.categories.index.pattern,
      new RoutePattern('https://remix.run/categories'),
    )

    assert.equal(routes.categories.edit.method, 'POST')
    assert.deepEqual(
      routes.categories.edit.pattern,
      new RoutePattern('https://remix.run/categories/:slug/edit'),
    )
  })

  it('creates a route map with nested routes', () => {
    let showUserRoute = createRoute('users/:id')
    let routes = createRoutes({
      home: '/',
      users: {
        index: '/users',
        // nested route
        show: showUserRoute,
      },
    })

    assert.equal(routes.home.method, 'GET')
    assert.deepEqual(routes.home.pattern, new RoutePattern('/'))

    assert.equal(routes.users.index.method, 'GET')
    assert.deepEqual(routes.users.index.pattern, new RoutePattern('/users'))

    assert.equal(routes.users.show.method, 'GET')
    assert.deepEqual(routes.users.show.pattern, new RoutePattern('/users/:id'))
  })
})

describe('createHandlers()', () => {
  it('creates a route handler map', () => {
    let routes = createRoutes({
      home: '/',
      users: {
        index: '/users',
        show: '/users/:id',
      },
    })

    let handlers = createHandlers(routes, {
      home() {
        return new Response('Home')
      },
      users: {
        index() {
          return new Response('Users')
        },
        show() {
          return new Response('User')
        },
      },
    })

    assert.equal(handlers.home.route.method, 'GET')
    assert.deepEqual(handlers.home.route.pattern, new RoutePattern('/'))
    assert.equal(handlers.home.use, undefined)
    assert.equal(typeof handlers.home.handler, 'function')

    assert.equal(handlers.users.index.route.method, 'GET')
    assert.deepEqual(handlers.users.index.route.pattern, new RoutePattern('/users'))
    assert.equal(handlers.users.index.use, undefined)
    assert.equal(typeof handlers.users.index.handler, 'function')

    assert.equal(handlers.users.show.route.method, 'GET')
    assert.deepEqual(handlers.users.show.route.pattern, new RoutePattern('/users/:id'))
    assert.equal(handlers.users.show.use, undefined)
    assert.equal(typeof handlers.users.show.handler, 'function')
  })

  it('creates a route handler map with middleware', async () => {
    let routes = createRoutes({
      home: '/',
      posts: {
        comments: '/posts/:id/comments',
      },
    })

    let requestLog: string[] = []

    function pushUrl({ url }: any) {
      requestLog.push(url.toString())
    }

    let router = createRouter()

    router.addRoutes(routes, [pushUrl], {
      home() {
        return new Response('Home')
      },
      posts: {
        comments({ params }) {
          return new Response(`Comments on post ${params.id}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    response = await router.fetch('https://remix.run/posts/1/comments')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Comments on post 1')

    assert.deepEqual(requestLog, ['https://remix.run/', 'https://remix.run/posts/1/comments'])
  })

  it('creates a route handler map with nested route handlers', async () => {
    let routes = createRoutes({
      home: '/',
      posts: {
        index: '/posts',
        comments: '/posts/:id/comments',
      },
    })

    let commentsHandler = createHandler(routes.posts.comments, ({ params }) => {
      return new Response(`Comments on post ${params.id}`)
    })

    let handlers = createHandlers(routes, {
      home() {
        return new Response('Home')
      },
      posts: {
        index() {
          return new Response('Posts')
        },
        // nested route handler
        comments: commentsHandler,
      },
    })
  })
})

describe('router.fetch()', () => {
  it('handles a simple route', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      home() {
        return new Response('Home')
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('handles a route with a method', async () => {
    let routes = createRoutes({
      home: {
        method: 'POST',
        pattern: '/',
      },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        handler() {
          return new Response('POST home')
        },
      },
    })

    let response = await router.fetch('https://remix.run', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'POST home')
  })

  it('calls a GET handler for a HEAD request', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      home() {
        return new Response('home', { headers: { 'X-Test': 'test' } })
      },
    })

    let response = await router.fetch('https://remix.run', { method: 'HEAD' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), '')
    assert.equal(response.headers.get('X-Test'), 'test')
  })

  it('handles concurrent requests correctly', async () => {
    let routes = createRoutes({
      users: '/users/:id',
      posts: '/posts/:id',
      api: '/api/:endpoint',
    })

    let requestLog: string[] = []

    let handlers = createHandlers(routes, {
      users({ params }) {
        requestLog.push(`users-${params.id}`)
        return new Response(`Users ${params.id}`)
      },
      posts({ params }) {
        requestLog.push(`posts-${params.id}`)
        return new Response(`Posts ${params.id}`)
      },
      api({ params }) {
        requestLog.push(`api-get-${params.endpoint}`)
        return new Response(`API ${params.endpoint}`)
      },
    })

    let router = createRouter(undefined, handlers)

    let responses = await Promise.all([
      router.fetch('https://remix.run/users/123'),
      router.fetch('https://remix.run/posts/456'),
      router.fetch('https://remix.run/api/data'),
      router.fetch('https://remix.run/users/789'),
    ])

    // Verify all responses are correct
    assert.equal(responses[0].status, 200)
    assert.equal(await responses[0].text(), 'Users 123')

    assert.equal(responses[1].status, 200)
    assert.equal(await responses[1].text(), 'Posts 456')

    assert.equal(responses[2].status, 200)
    assert.equal(await responses[2].text(), 'API data')

    assert.equal(responses[3].status, 200)
    assert.equal(await responses[3].text(), 'Users 789')
  })

  it('handles URL object as input', async () => {
    let routes = createRoutes({
      api: '/api/:endpoint',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api({ params, url }) {
        return new Response(`API ${params.endpoint}, Query: ${url.search}`)
      },
    })

    let response = await router.fetch(new URL('https://remix.run/api/users?include=posts'))

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'API users, Query: ?include=posts')
  })

  it('handles Request object as input', async () => {
    let routes = createRoutes({
      api: '/api/:endpoint',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api({ params, request }) {
        let auth = request.headers.get('Authorization')
        return new Response(`API ${params.endpoint}, Auth: ${auth}`)
      },
    })

    let request = new Request('https://remix.run/api/users', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token123',
        'User-Agent': 'Test Client',
      },
    })
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'API users, Auth: Bearer token123')
  })

  it('preserves request headers and body', async () => {
    let routes = createRoutes({
      echo: { method: 'POST', pattern: '/echo' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      async echo({ request }) {
        let body = await request.text()
        return new Response(`Header: ${request.headers.get('X-Custom')}, Body: "${body}"`)
      },
    })

    let response = await router.fetch('https://remix.run/echo', {
      method: 'POST',
      body: JSON.stringify({ message: 'Hello!' }),
      headers: { 'X-Custom': 'test-value' },
    })

    assert.equal(await response.text(), 'Header: test-value, Body: "{"message":"Hello!"}"')
  })
})

describe('request methods', () => {
  it('handles PUT requests', async () => {
    let routes = createRoutes({
      users: { method: 'PUT', pattern: '/users/:id' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      users({ params }) {
        return new Response(`Updated user ${params.id}`)
      },
    })

    let response = await router.fetch('https://remix.run/users/123', { method: 'PUT' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Updated user 123')
  })

  it('handles PATCH requests', async () => {
    let routes = createRoutes({
      users: { method: 'PATCH', pattern: '/users/:id' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      users({ params }) {
        return new Response(`Patched user ${params.id}`)
      },
    })

    let response = await router.fetch('https://remix.run/users/456', { method: 'PATCH' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Patched user 456')
  })

  it('handles DELETE requests', async () => {
    let routes = createRoutes({
      users: { method: 'DELETE', pattern: '/users/:id' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      users({ params }) {
        return new Response(`Deleted user ${params.id}`)
      },
    })

    let response = await router.fetch('https://remix.run/users/789', { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Deleted user 789')
  })

  it('handles OPTIONS requests', async () => {
    let routes = createRoutes({
      api: { method: 'OPTIONS', pattern: '/api' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api() {
        return new Response(null, {
          headers: {
            Allow: 'GET, POST, OPTIONS',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Origin': '*',
          },
        })
      },
    })

    let response = await router.fetch('https://remix.run/api', { method: 'OPTIONS' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Allow'), 'GET, POST, OPTIONS')
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS')
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
  })
})

describe('url pattern edge cases', () => {
  it('handles routes with query parameters', async () => {
    let routes = createRoutes({
      search: '/search',
      api: '/api/users/:id',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      search({ url }) {
        let query = url.searchParams.get('q')
        let filter = url.searchParams.get('filter')
        return new Response(`Search: ${query}, Filter: ${filter}`)
      },
      api({ params, url }) {
        let include = url.searchParams.get('include')
        return new Response(`User ${params.id}, Include: ${include}`)
      },
    })

    // Test query parameters
    let response = await router.fetch('https://remix.run/search?q=test&filter=active')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Search: test, Filter: active')

    // Test query parameters with route parameters
    response = await router.fetch('https://remix.run/api/users/123?include=posts')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'User 123, Include: posts')
  })

  it('handles routes with URL fragments', async () => {
    let routes = createRoutes({
      docs: '/docs/:section',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      docs({ params, url }) {
        // URL fragments are not sent to server, but we can test the URL parsing
        return new Response(`Docs section: ${params.section}, URL: ${url.pathname}`)
      },
    })

    // Test URL with fragment (fragment won't be sent to server, but URL parsing should work)
    let response = await router.fetch('https://remix.run/docs/api#authentication')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Docs section: api, URL: /docs/api')
  })

  it('handles routes with special characters in paths', async () => {
    let routes = createRoutes({
      special: '/special/:name',
      unicode: '/unicode/:text',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      special({ params }) {
        return new Response(`Special: ${params.name}`)
      },
      unicode({ params }) {
        return new Response(`Unicode: ${params.text}`)
      },
    })

    // Test with special characters
    let response = await router.fetch('https://remix.run/special/hello-world_123')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Special: hello-world_123')

    // Test with unicode characters (URL will be encoded)
    response = await router.fetch('https://remix.run/unicode/café')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Unicode: caf%C3%A9')
  })

  it('handles routes with encoded URLs', async () => {
    let routes = createRoutes({
      files: '/files/:filename',
      search: '/search/:term',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      files({ params }) {
        return new Response(`File: ${params.filename}`)
      },
      search({ params }) {
        return new Response(`Search: ${params.term}`)
      },
    })

    // Test with URL encoded spaces (parameters are not auto-decoded)
    let response = await router.fetch('https://remix.run/files/my%20file.txt')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'File: my%20file.txt')

    // Test with URL encoded special characters (parameters are not auto-decoded)
    response = await router.fetch('https://remix.run/search/hello%20world%26more')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Search: hello%20world%26more')
  })

  it('handles wildcard routes and catch-all patterns', async () => {
    let routes = createRoutes({
      files: '/files/*',
      api: '/api/v1/*',
      catchAll: '*',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      files({ url }) {
        let path = url.pathname.replace('/files/', '')
        return new Response(`File path: ${path}`)
      },
      api({ url }) {
        let path = url.pathname.replace('/api/v1/', '')
        return new Response(`API path: ${path}`)
      },
      catchAll({ url }) {
        return new Response(`Catch-all: ${url.pathname}`)
      },
    })

    // Test file wildcard
    let response = await router.fetch('https://remix.run/files/documents/report.pdf')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'File path: documents/report.pdf')

    // Test API wildcard
    response = await router.fetch('https://remix.run/api/v1/users/123/profile')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'API path: users/123/profile')

    // Test catch-all
    response = await router.fetch('https://remix.run/some/random/path')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Catch-all: /some/random/path')
  })

  it('handles overlapping route patterns (priority testing)', async () => {
    let routes = createRoutes({
      specific: '/users/new',
      general: '/users/:id',
      wildcard: '/users/*',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      specific() {
        return new Response('New user form')
      },
      general({ params }) {
        return new Response(`User ${params.id}`)
      },
      wildcard({ url }) {
        return new Response(`Wildcard: ${url.pathname}`)
      },
    })

    // Test specific route takes precedence
    let response = await router.fetch('https://remix.run/users/new')
    assert.equal(await response.text(), 'New user form')

    // Test parameterized route when specific doesn't match
    response = await router.fetch('https://remix.run/users/123')
    assert.equal(await response.text(), 'User 123')

    // Test wildcard fallback
    response = await router.fetch('https://remix.run/users/some/path')
    assert.equal(await response.text(), 'Wildcard: /users/some/path')
  })
})

describe('HTTP client errors', () => {
  it('returns 404 for unmatched routes', async () => {
    let routes = createRoutes({
      home: '/',
      users: '/users/:id',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      home() {
        return new Response('Home')
      },
      users() {
        return new Response('User')
      },
    })

    let response = await router.fetch('https://remix.run/nonexistent')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found')

    // Test with different paths
    response = await router.fetch('https://remix.run/users')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found')

    response = await router.fetch('https://remix.run/admin/dashboard')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found')
  })

  it('returns 405 for invalid HTTP methods', async () => {
    let routes = createRoutes({
      api: { method: 'GET', pattern: '/api' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api() {
        return new Response('API')
      },
    })

    // Test with a method that's not in the RequestMethods array
    // We need to manually create a request with an invalid method
    let request = new Request('https://remix.run/api')
    Object.defineProperty(request, 'method', { value: 'INVALID' })

    let response = await router.fetch(request)
    assert.equal(response.status, 405)
    assert.equal(await response.text(), 'Method Not Allowed')
  })

  it('returns 404 for valid HTTP methods with no matching routes', async () => {
    let routes = createRoutes({
      api: { method: 'GET', pattern: '/api' },
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api() {
        return new Response('API')
      },
    })

    // Test valid HTTP method that no routes handle - should be 404
    let response = await router.fetch('https://remix.run/api', { method: 'POST' })
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found')

    // Test another valid method with no handlers
    response = await router.fetch('https://remix.run/api', { method: 'DELETE' })
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found')

    // Test valid method on non-existent route
    response = await router.fetch('https://remix.run/nonexistent', { method: 'PUT' })
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found')
  })

  it('preserves custom error responses from handlers', async () => {
    let routes = createRoutes({
      api: '/api',
      auth: '/auth',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api() {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer' },
        })
      },
      auth() {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    // Test custom 401 response
    let response = await router.fetch('https://remix.run/api')
    assert.equal(response.status, 401)
    assert.equal(await response.text(), 'Unauthorized')
    assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer')

    // Test custom 403 JSON response
    response = await router.fetch('https://remix.run/auth')
    assert.equal(response.status, 403)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    let body = await response.json()
    assert.deepEqual(body, { error: 'Invalid credentials' })
  })
})

describe('middleware', () => {
  it('runs middleware in order from left to right', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let middlewareInvocations: string[] = []

    function one(_: any, next: NextFunction) {
      middlewareInvocations.push('one')
      return next()
    }

    function two(_: any, next: NextFunction) {
      middlewareInvocations.push('two')
      return next()
    }

    function three(_: any, next: NextFunction) {
      middlewareInvocations.push('three')
      return next()
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [one, two, three],
        handler() {
          return new Response('Home')
        },
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(middlewareInvocations, ['one', 'two', 'three'])
  })

  it('short-circuits the chain when a middleware returns a response', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let middlewareInvocations: string[] = []

    function one() {
      middlewareInvocations.push('one')
      return new Response('One')
    }

    function two() {
      middlewareInvocations.push('two')
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [one, two],
        handler() {
          return new Response('Home')
        },
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'One')
    assert.deepEqual(middlewareInvocations, ['one'])
  })

  it('automatically calls the next middleware in the chain', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let middlewareInvocations: string[] = []

    function one() {
      middlewareInvocations.push('one')
      // no next()
    }

    function two() {
      middlewareInvocations.push('two')
      // no next()
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [one, two],
        handler() {
          return new Response('Home')
        },
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(middlewareInvocations, ['one', 'two'])
  })

  it('throws error when middleware calls next() multiple times', async () => {
    let routes = createRoutes({
      home: '/',
    })

    async function badMiddleware(_context: any, next: any) {
      await next()
      await next() // This second call should throw
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [badMiddleware],
        handler() {
          return new Response('Home')
        },
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('next() called multiple times'))
  })

  it('handles middleware that modifies response headers', async () => {
    let routes = createRoutes({
      api: '/api',
    })

    function addCorsHeaders(_context: any, next: any) {
      return next().then((response: Response) => {
        let newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            'X-Middleware': 'processed',
          },
        })
        return newResponse
      })
    }

    function addCacheHeaders(_context: any, next: any) {
      return next().then((response: Response) => {
        let newResponse = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'Cache-Control': 'max-age=3600',
            'X-Cache-Middleware': 'active',
          },
        })
        return newResponse
      })
    }

    let router = createRouter()

    router.addRoutes(routes, {
      api: {
        use: [addCorsHeaders, addCacheHeaders],
        handler() {
          return new Response('API response', {
            headers: { 'Content-Type': 'application/json' },
          })
        },
      },
    })

    let response = await router.fetch('https://remix.run/api')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'API response')
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*')
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT, DELETE')
    assert.equal(response.headers.get('Cache-Control'), 'max-age=3600')
    assert.equal(response.headers.get('X-Middleware'), 'processed')
    assert.equal(response.headers.get('X-Cache-Middleware'), 'active')
  })

  it('handles empty middleware arrays', async () => {
    let routes = createRoutes({
      home: '/',
      api: '/api',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [], // Empty middleware array
        handler() {
          return new Response('Home')
        },
      },
      api() {
        return new Response('API')
      }, // No middleware at all
    })

    // Test route with empty middleware array
    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    // Test route with no middleware
    response = await router.fetch('https://remix.run/api')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'API')
  })

  it('handles global middleware with empty route middleware', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let requestLog: string[] = []

    function globalMiddleware() {
      requestLog.push('global')
    }

    let router = createRouter([globalMiddleware])

    router.addRoutes(routes, {
      home: {
        use: [], // Empty middleware array
        handler() {
          requestLog.push('handler')
          return new Response('Home')
        },
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(requestLog, ['global', 'handler'])
  })
})

describe('request context', () => {
  it('contains the parsed URL and parameters', async () => {
    let routes = createRoutes({
      api: '/api/:version/users/:userId',
      search: '/search',
    })

    let contextData: any[] = []

    let router = createRouter()

    router.addRoutes(routes, {
      api(ctx) {
        contextData.push({
          type: 'api',
          params: ctx.params,
          url: {
            href: ctx.url.href,
            origin: ctx.url.origin,
            protocol: ctx.url.protocol,
            hostname: ctx.url.hostname,
            port: ctx.url.port,
            pathname: ctx.url.pathname,
            search: ctx.url.search,
            hash: ctx.url.hash,
          },
          request: {
            method: ctx.request.method,
            url: ctx.request.url,
          },
        })
        return new Response('API')
      },
      search(ctx) {
        contextData.push({
          type: 'search',
          params: ctx.params,
          searchParams: Object.fromEntries(ctx.url.searchParams.entries()),
          pathname: ctx.url.pathname,
        })
        return new Response('Search')
      },
    })

    // Test parameter extraction and URL parsing
    let response = await router.fetch(
      'https://remix.run/api/v2/users/123?include=posts&sort=name#section',
    )
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'API')

    // Test search parameters
    response = await router.fetch('https://remix.run/search?q=test&filter=active')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Search')

    // Verify context data
    assert.equal(contextData.length, 2)

    // Check API context
    let apiContext = contextData[0]
    assert.equal(apiContext.type, 'api')
    assert.deepEqual(apiContext.params, { version: 'v2', userId: '123' })
    assert.equal(
      apiContext.url.href,
      'https://remix.run/api/v2/users/123?include=posts&sort=name#section',
    )
    assert.equal(apiContext.url.origin, 'https://remix.run')
    assert.equal(apiContext.url.protocol, 'https:')
    assert.equal(apiContext.url.hostname, 'remix.run')
    assert.equal(apiContext.url.pathname, '/api/v2/users/123')
    assert.equal(apiContext.url.search, '?include=posts&sort=name')
    assert.equal(apiContext.url.hash, '#section')
    assert.equal(apiContext.request.method, 'GET')

    // Check search context
    let searchContext = contextData[1]
    assert.equal(searchContext.type, 'search')
    assert.deepEqual(searchContext.params, {})
    assert.deepEqual(searchContext.searchParams, { q: 'test', filter: 'active' })
    assert.equal(searchContext.pathname, '/search')
  })
})

describe('error handling', () => {
  it('rejects when handlers throw errors', async () => {
    let routes = createRoutes({
      error: '/error',
      async: '/async',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      error() {
        throw new Error('Handler error!')
      },
      async async() {
        await new Promise((resolve) => setTimeout(resolve, 1))
        throw new Error('Async handler error!')
      },
    })

    // Test synchronous handler error
    await assert.rejects(async () => {
      await router.fetch('https://remix.run/error')
    }, new Error('Handler error!'))

    // Test asynchronous handler error
    await assert.rejects(async () => {
      await router.fetch('https://remix.run/async')
    }, new Error('Async handler error!'))
  })

  it('rejects when synchronous middleware throws errors', async () => {
    let routes = createRoutes({
      home: '/',
    })

    function errorMiddleware() {
      throw new Error('Sync middleware error!')
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [errorMiddleware],
        handler() {
          return new Response('Home')
        },
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Sync middleware error!'))
  })

  it('rejects when asynchronous middleware throws errors', async () => {
    let routes = createRoutes({
      home: '/',
    })

    async function errorMiddleware() {
      await new Promise((resolve) => setTimeout(resolve, 1))
      throw new Error('Async middleware error!')
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [errorMiddleware],
        handler() {
          return new Response('Home')
        },
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Async middleware error!'))
  })

  it('handles malformed URLs gracefully', async () => {
    let routes = createRoutes({
      api: '/api',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api() {
        return new Response('API')
      },
    })

    // Test with invalid URL that can't be parsed
    await assert.rejects(async () => {
      await router.fetch('not-a-valid-url')
    }, TypeError)

    // Test with malformed protocol
    await assert.rejects(async () => {
      await router.fetch('ht!tp://example.com/api')
    }, TypeError)
  })

  it('handles extremely long URLs', async () => {
    let routes = createRoutes({
      api: '/api/:data',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api({ params }) {
        return new Response(`Data length: ${params.data.length}`)
      },
    })

    // Test with very long parameter
    let longData = 'x'.repeat(10000)
    let response = await router.fetch(`https://remix.run/api/${longData}`)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Data length: 10000')

    // Test with extremely long query string
    let longQuery = 'param=' + 'y'.repeat(5000)
    response = await router.fetch(`https://remix.run/api/test?${longQuery}`)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Data length: 4')
  })

  it('handles URLs with invalid characters', async () => {
    let routes = createRoutes({
      api: '/api/:data',
    })

    let router = createRouter()

    router.addRoutes(routes, {
      api({ params }) {
        return new Response(`Data: ${params.data}`)
      },
    })

    // Test with characters that need encoding (spaces get encoded)
    let response = await router.fetch('https://remix.run/api/data with spaces')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Data: data%20with%20spaces')

    // Test with special characters (these get encoded too)
    response = await router.fetch('https://remix.run/api/data<>{}[]')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Data: data%3C%3E%7B%7D[]')
  })
})

describe('app storage', () => {
  it('can be accessed from middleware and route handlers', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let userKey = createStorageKey('')

    function auth({ storage }: RequestContext) {
      storage.set(userKey, 'mj')
    }

    let router = createRouter()

    router.addRoutes(routes, {
      home: {
        use: [auth],
        handler({ storage }) {
          let currentUser = storage.get(userKey)
          return new Response(`Hello, ${currentUser}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, mj')
  })
})
