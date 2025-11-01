import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'

import { RequestContext } from './request-context.ts'
import { createRoutes } from './route-map.ts'
import { createRouter } from './router.ts'

describe('router.fetch()', () => {
  it('fetches a route', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('fetches a route with middleware', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let requestLog: string[] = []
    let router = createRouter()

    router.get(routes.home, {
      middleware: [
        () => {
          requestLog.push('middleware')
        },
      ],
      handler() {
        return new Response('Home')
      },
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(requestLog.length, 1)
    assert.deepEqual(requestLog, ['middleware'])
  })

  it('runs router middleware before fetching a route', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let requestLog: string[] = []
    let router = createRouter({
      middleware: [
        () => {
          requestLog.push('router middleware')
        },
      ],
    })

    router.get(routes.home, {
      middleware: [
        () => {
          requestLog.push('route middleware')
        },
      ],
      handler() {
        return new Response('Home')
      },
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(requestLog, ['router middleware', 'route middleware'])
  })

  it('fetches a route with specific method handlers', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.get(routes.home, () => new Response('GET'))
    router.head(routes.home, () => new Response('HEAD'))
    router.post(routes.home, () => new Response('POST'))
    router.put(routes.home, () => new Response('PUT'))
    router.patch(routes.home, () => new Response('PATCH'))
    router.delete(routes.home, () => new Response('DELETE'))
    router.options(routes.home, () => new Response('OPTIONS'))

    for (let method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      let response = await router.fetch('https://remix.run', { method })
      assert.equal(response.status, 200)
      assert.equal(await response.text(), method)
    }
  })

  it('replaces any corresponding options set in the original `Request` when options are provided', async () => {
    let requestLog: Array<string | null> = []
    let router = createRouter()

    router.get('/', {
      middleware: [
        ({ headers }) => {
          requestLog.push(headers.get('From'))
        },
      ],
      handler() {
        return new Response('Home')
      },
    })

    await router.fetch('https://remix.run')
    assert.deepEqual(requestLog, [null])

    requestLog = []

    await router.fetch('https://remix.run', { headers: { From: 'admin@remix.run' } })
    assert.deepEqual(requestLog, ['admin@remix.run'])
  })

  it('runs router middleware even when there are no routes', async () => {
    let requestLog: string[] = []
    let router = createRouter({
      middleware: [
        () => {
          requestLog.push('middleware')
        },
      ],
    })

    let response = await router.fetch('https://remix.run/nonexistent')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found: /nonexistent')
    assert.deepEqual(requestLog, ['middleware'])
  })

  it('runs router middleware even when no route matches', async () => {
    let requestLog: string[] = []
    let router = createRouter({
      middleware: [
        () => {
          requestLog.push('middleware')
        },
      ],
    })

    router.get('/', () => {
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run/nonexistent')
    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found: /nonexistent')
    assert.deepEqual(requestLog, ['middleware'])
  })
})

describe('router.map()', () => {
  it('maps a single route to a handler', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()

    router.map(routes.home, () => {
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('maps a route map to many handlers', async () => {
    let routes = createRoutes({
      home: '/',
      blog: {
        index: { method: 'GET', pattern: '/blog' },
        create: { method: 'POST', pattern: '/blog' },
        show: '/blog/:id',
      },
    })

    let router = createRouter()

    router.map(routes, {
      home() {
        return new Response('Home')
      },
      blog: {
        index() {
          return new Response('Blog')
        },
        create() {
          return new Response('Blog Post Created')
        },
        show({ params }) {
          return new Response(`Blog Post ${params.id}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    response = await router.fetch('https://remix.run/blog')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Blog')

    response = await router.fetch('https://remix.run/blog', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Blog Post Created')

    response = await router.fetch('https://remix.run/blog/1')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Blog Post 1')
  })
})

describe('router.map() with middleware', () => {
  it('supports middleware in a single route', async () => {
    let routes = createRoutes({
      home: '/',
      profile: '/profile/:id',
    })

    let router = createRouter()
    let requestLog: string[] = []

    function middleware(context: RequestContext<'ANY', { id: string }>) {
      requestLog.push(`middleware ${context.params.id}`)
    }

    router.map(routes.profile, {
      middleware: [middleware],
      handler() {
        requestLog.push('handler')
        return new Response('OK')
      },
    })

    let response = await router.fetch('https://remix.run/profile/1')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')

    assert.deepEqual(requestLog, ['middleware 1', 'handler'])
  })

  it('supports middleware in a route map', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()
    let requestLog: string[] = []

    function middleware() {
      requestLog.push('middleware')
    }

    router.map(routes, {
      middleware: [middleware],
      handlers: {
        home() {
          requestLog.push('handler')
          return new Response('OK')
        },
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')

    assert.deepEqual(requestLog, ['middleware', 'handler'])
  })

  it('supports middleware in a nested route map', async () => {
    let routes = createRoutes({
      blog: {
        index: '/blog',
        show: '/blog/:id',
      },
    })

    let router = createRouter()
    let requestLog: string[] = []

    function middleware() {
      requestLog.push('middleware')
    }

    router.map(routes, {
      middleware: [middleware], // outer middleware
      handlers: {
        blog: {
          middleware: [middleware], // inner middleware
          handlers: {
            index() {
              requestLog.push('blog-index')
              return new Response('Blog')
            },
            show() {
              requestLog.push('blog-show')
              return new Response('Blog Post')
            },
          },
        },
      },
    })

    let response = await router.fetch('https://remix.run/blog')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Blog')
    assert.deepEqual(requestLog, ['middleware', 'middleware', 'blog-index'])

    requestLog = []

    response = await router.fetch('https://remix.run/blog/1')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Blog Post')
    assert.deepEqual(requestLog, ['middleware', 'middleware', 'blog-show'])
  })

  it('supports multiple middleware in a single use array', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()
    let requestLog: string[] = []

    router.map(routes, {
      middleware: [
        () => {
          requestLog.push('m1')
        },
        () => {
          requestLog.push('m2')
        },
        () => {
          requestLog.push('m3')
        },
      ],
      handlers: {
        home() {
          requestLog.push('handler')
          return new Response('OK')
        },
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')

    assert.deepEqual(requestLog, ['m1', 'm2', 'm3', 'handler'])
  })

  it('allows selective middleware by mapping specific nested route subtrees separately', async () => {
    let routes = createRoutes({
      public: '/public',
      admin: {
        dashboard: '/admin/dashboard',
        users: '/admin/users',
      },
    })

    let router = createRouter()
    let requestLog: string[] = []

    // Public route - no middleware
    router.map(routes.public, () => {
      requestLog.push('public')
      return new Response('Public')
    })

    // Admin routes - with auth middleware
    router.map(routes.admin, {
      middleware: [
        () => {
          requestLog.push('auth')
        },
      ],
      handlers: {
        dashboard() {
          requestLog.push('dashboard')
          return new Response('Dashboard')
        },
        users() {
          requestLog.push('users')
          return new Response('Users')
        },
      },
    })

    let response = await router.fetch('https://remix.run/public')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Public')
    assert.deepEqual(requestLog, ['public'])

    requestLog = []
    response = await router.fetch('https://remix.run/admin/dashboard')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Dashboard')
    assert.deepEqual(requestLog, ['auth', 'dashboard'])

    requestLog = []
    response = await router.fetch('https://remix.run/admin/users')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Users')
    assert.deepEqual(requestLog, ['auth', 'users'])
  })

  it('runs both router and inline middleware', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let requestLog: string[] = []
    let router = createRouter({
      middleware: [
        () => {
          requestLog.push('router')
        },
      ],
    })

    router.map(routes, {
      middleware: [
        () => {
          requestLog.push('inline')
        },
      ],
      handlers: {
        home() {
          requestLog.push('handler')
          return new Response('OK')
        },
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')

    assert.deepEqual(requestLog, ['router', 'inline', 'handler'])
  })
})

describe('per-route middleware', () => {
  it('registers a route with single middleware in array', async () => {
    let requestLog: string[] = []
    let router = createRouter()

    router.get('/', {
      middleware: [
        () => {
          requestLog.push('middleware')
        },
      ],
      handler() {
        requestLog.push('handler')
        return new Response('OK')
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    assert.deepEqual(requestLog, ['middleware', 'handler'])
  })

  it('registers a route with multiple middleware', async () => {
    let requestLog: string[] = []
    let router = createRouter()

    router.get('/', {
      middleware: [
        () => {
          requestLog.push('m1')
        },
        () => {
          requestLog.push('m2')
        },
        () => {
          requestLog.push('m3')
        },
      ],
      handler() {
        requestLog.push('handler')
        return new Response('OK')
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['m1', 'm2', 'm3', 'handler'])
  })

  it('executes route middleware after router middleware', async () => {
    let requestLog: string[] = []
    let router = createRouter({
      middleware: [
        () => {
          requestLog.push('router')
        },
      ],
    })

    router.get('/', {
      middleware: [
        () => {
          requestLog.push('route-1')
        },
        () => {
          requestLog.push('route-2')
        },
      ],
      handler() {
        requestLog.push('handler')
        return new Response('OK')
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['router', 'route-1', 'route-2', 'handler'])
  })

  it('applies middleware only to specific route', async () => {
    let requestLog: string[] = []
    let router = createRouter()

    router.get('/a', {
      middleware: [
        () => {
          requestLog.push('middleware-a')
        },
      ],
      handler() {
        requestLog.push('handler-a')
        return new Response('A')
      },
    })

    router.get('/b', () => {
      requestLog.push('handler-b')
      return new Response('B')
    })

    let response = await router.fetch('https://remix.run/a')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'A')
    assert.deepEqual(requestLog, ['middleware-a', 'handler-a'])

    requestLog = []
    response = await router.fetch('https://remix.run/b')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'B')
    assert.deepEqual(requestLog, ['handler-b'])
  })

  it('works with empty middleware array', async () => {
    let requestLog: string[] = []
    let router = createRouter()

    router.get('/', {
      middleware: [],
      handler() {
        requestLog.push('handler')
        return new Response('OK')
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['handler'])
  })

  it('allows different routes to have different middleware', async () => {
    let requestLog: string[] = []
    let router = createRouter()

    router.get('/a', {
      middleware: [
        () => {
          requestLog.push('auth')
        },
      ],
      handler() {
        requestLog.push('handler-a')
        return new Response('A')
      },
    })

    router.post('/b', {
      middleware: [
        () => {
          requestLog.push('validate')
        },
        () => {
          requestLog.push('sanitize')
        },
      ],
      handler() {
        requestLog.push('handler-b')
        return new Response('B')
      },
    })

    let response = await router.fetch('https://remix.run/a')
    assert.deepEqual(requestLog, ['auth', 'handler-a'])

    requestLog = []
    response = await router.fetch('https://remix.run/b', { method: 'POST' })
    assert.deepEqual(requestLog, ['validate', 'sanitize', 'handler-b'])
  })

  it('handles middleware that returns a response (short-circuits)', async () => {
    let requestLog: string[] = []
    let router = createRouter()

    router.get('/', {
      middleware: [
        () => {
          requestLog.push('m1')
        },
        () => {
          requestLog.push('m2-short-circuit')
          return new Response('Blocked', { status: 403 })
        },
        () => {
          requestLog.push('m3')
        },
      ],
      handler() {
        requestLog.push('handler')
        return new Response('OK')
      },
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'Blocked')
    assert.deepEqual(requestLog, ['m1', 'm2-short-circuit'])
  })

  it('runs both router and route middleware', async () => {
    let routes = createRoutes({
      admin: {
        dashboard: '/admin/dashboard',
        users: '/admin/users',
      },
    })

    let requestLog: string[] = []
    let router = createRouter()

    // Map routes with parent middleware and a child route with its own per-route middleware
    router.map(routes.admin, {
      middleware: [
        () => {
          requestLog.push('auth')
        },
        () => {
          requestLog.push('admin')
        },
      ],
      handlers: {
        dashboard() {
          requestLog.push('dashboard-handler')
          return new Response('Dashboard')
        },
        users: {
          middleware: [
            () => {
              requestLog.push('users-middleware')
            },
          ],
          handler() {
            requestLog.push('users-handler')
            return new Response('Users')
          },
        },
      },
    })

    // Dashboard should only have router middleware
    let response1 = await router.fetch('https://remix.run/admin/dashboard')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'Dashboard')
    assert.deepEqual(requestLog, ['auth', 'admin', 'dashboard-handler'])

    requestLog = []

    // Users should have both router and route middleware
    let response2 = await router.fetch('https://remix.run/admin/users')
    assert.equal(response2.status, 200)
    assert.equal(await response2.text(), 'Users')
    assert.deepEqual(requestLog, ['auth', 'admin', 'users-middleware', 'users-handler'])
  })
})

describe('404 handling', () => {
  it('returns a 404 response when no route matches', async () => {
    let router = createRouter()
    router.get('/home', () => new Response('Home'))

    let response = await router.fetch('https://remix.run/nonexistent')

    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Not Found: /nonexistent')
  })

  it('supports a custom defaultHandler', async () => {
    let router = createRouter({
      defaultHandler({ url }) {
        return new Response(`Custom 404: ${url.pathname}`, {
          status: 404,
          headers: { 'X-Custom': 'true' },
        })
      },
    })

    router.get('/home', () => new Response('Home'))

    let response = await router.fetch('https://remix.run/missing')

    assert.equal(response.status, 404)
    assert.equal(await response.text(), 'Custom 404: /missing')
    assert.equal(response.headers.get('X-Custom'), 'true')
  })

  it('calls defaultHandler only when no routes match', async () => {
    let defaultCalls = 0
    let router = createRouter({
      defaultHandler() {
        defaultCalls++
        return new Response('Not Found', { status: 404 })
      },
    })

    router.get('/', () => new Response('Home'))
    router.get('/about', () => new Response('About'))

    await router.fetch('https://remix.run/')
    assert.equal(defaultCalls, 0)

    await router.fetch('https://remix.run/about')
    assert.equal(defaultCalls, 0)

    await router.fetch('https://remix.run/missing')
    assert.equal(defaultCalls, 1)
  })
})

describe('error handling', () => {
  it('propagates errors thrown in route handlers', async () => {
    let router = createRouter()
    router.get('/', () => {
      throw new Error('Handler error')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Handler error'))
  })

  it('propagates async errors thrown in route handlers', async () => {
    let router = createRouter()
    router.get('/', async () => {
      await Promise.resolve()
      throw new Error('Async handler error')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Async handler error'))
  })

  it('propagates errors thrown in router middleware', async () => {
    let router = createRouter({
      middleware: [
        () => {
          throw new Error('Router middleware error')
        },
      ],
    })

    router.get('/', () => new Response('OK'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Router middleware error'))
  })

  it('propagates errors thrown in route middleware', async () => {
    let router = createRouter()

    router.get('/', {
      middleware: [
        () => {
          throw new Error('Route middleware error')
        },
      ],
      handler() {
        return new Response('OK')
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Route middleware error'))
  })

  it('propagates errors thrown in the default handler', async () => {
    let router = createRouter({
      defaultHandler() {
        throw new Error('Default handler error')
      },
    })

    router.get('/home', () => new Response('Home'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/missing')
    }, new Error('Default handler error'))
  })

  it('allows middleware to catch and handle errors from downstream', async () => {
    let router = createRouter({
      middleware: [
        async (_, next) => {
          try {
            return await next()
          } catch (error) {
            return new Response(`Caught: ${(error as Error).message}`, { status: 500 })
          }
        },
      ],
    })

    router.get('/', () => {
      throw new Error('Handler error')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 500)
    assert.equal(await response.text(), 'Caught: Handler error')
  })
})

describe('trailing slash handling', () => {
  it('matches routes with and without trailing slashes for single-path routes', async () => {
    let router = createRouter()
    router.get('/about', () => new Response('About'))
    router.get('/contact/', () => new Response('Contact'))

    // Route defined without trailing slash
    let response1 = await router.fetch('https://remix.run/about')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'About')

    let response2 = await router.fetch('https://remix.run/about/')
    assert.equal(response2.status, 404) // Trailing slash doesn't match

    // Route defined with trailing slash
    let response3 = await router.fetch('https://remix.run/contact/')
    assert.equal(response3.status, 200)
    assert.equal(await response3.text(), 'Contact')

    let response4 = await router.fetch('https://remix.run/contact')
    assert.equal(response4.status, 404) // Without trailing slash doesn't match
  })

  it('matches routes with and without trailing slashes for createRoutes', async () => {
    let routes = createRoutes('api', {
      users: '/users',
      posts: '/posts/',
    })

    let router = createRouter()
    router.get(routes.users, () => new Response('Users'))
    router.get(routes.posts, () => new Response('Posts'))

    // Route defined without trailing slash in createRoutes
    let response1 = await router.fetch('https://remix.run/api/users')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'Users')

    let response2 = await router.fetch('https://remix.run/api/users/')
    assert.equal(response2.status, 404) // Trailing slash doesn't match

    // Route defined with trailing slash in createRoutes
    let response3 = await router.fetch('https://remix.run/api/posts/')
    assert.equal(response3.status, 200)
    assert.equal(await response3.text(), 'Posts')

    let response4 = await router.fetch('https://remix.run/api/posts')
    assert.equal(response4.status, 404) // Without trailing slash doesn't match
  })

  it('handles root path with and without trailing slash', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    // Root with trailing slash
    let response1 = await router.fetch('https://remix.run/')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'Home')

    // Root without trailing slash (edge case)
    let response2 = await router.fetch('https://remix.run')
    assert.equal(response2.status, 200)
    assert.equal(await response2.text(), 'Home')
  })

  it('handles nested routes with trailing slash combinations', async () => {
    let routes = createRoutes('admin', {
      dashboard: '/',
      users: {
        index: '/users',
        show: '/users/:id',
      },
    })

    let router = createRouter()
    router.get(routes.dashboard, () => new Response('Admin Dashboard'))
    router.get(routes.users.index, () => new Response('Users List'))
    router.get(routes.users.show, ({ params }) => new Response(`User ${params.id}`))

    // Dashboard (base path - createRoutes('admin', { dashboard: '/' }) produces '/admin')
    let response1 = await router.fetch('https://remix.run/admin')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'Admin Dashboard')

    let response2 = await router.fetch('https://remix.run/admin/')
    assert.equal(response2.status, 404) // Trailing slash doesn't match '/admin'

    // Nested users index
    let response3 = await router.fetch('https://remix.run/admin/users')
    assert.equal(response3.status, 200)
    assert.equal(await response3.text(), 'Users List')

    let response4 = await router.fetch('https://remix.run/admin/users/')
    assert.equal(response4.status, 404) // Trailing slash doesn't match

    // Nested users show
    let response5 = await router.fetch('https://remix.run/admin/users/123')
    assert.equal(response5.status, 200)
    assert.equal(await response5.text(), 'User 123')

    let response6 = await router.fetch('https://remix.run/admin/users/123/')
    assert.equal(response6.status, 404) // Trailing slash doesn't match
  })
})

describe('custom matcher', () => {
  it('uses a custom matcher when provided', async () => {
    let matchAllCalls = 0

    // Create a custom matcher that tracks calls
    class CustomMatcher extends RegExpMatcher {
      *matchAll(url: string | URL) {
        matchAllCalls++
        yield* super.matchAll(url)
      }
    }

    let customMatcher = new CustomMatcher()
    let router = createRouter({ matcher: customMatcher })
    router.get('/', () => new Response('Home'))

    await router.fetch('https://remix.run/')

    assert.ok(matchAllCalls > 0, 'Custom matcher should be called')
  })

  it('adds routes to the custom matcher', async () => {
    let addedPatterns: string[] = []

    class CustomMatcher extends RegExpMatcher {
      add<P extends string>(pattern: P | RoutePattern<P>, data: any): void {
        let routePattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern
        addedPatterns.push(routePattern.source)
        super.add(pattern, data)
      }
    }

    let customMatcher = new CustomMatcher()
    let router = createRouter({ matcher: customMatcher })
    router.get('/home', () => new Response('Home'))
    router.get('/about', () => new Response('About'))

    assert.deepEqual(addedPatterns, ['/home', '/about'])
  })
})

describe('abort signal support', () => {
  it('throws AbortError when signal is already aborted', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    controller.abort()

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('throws AbortError when signal is aborted during request processing', async () => {
    let router = createRouter()
    let controller = new AbortController()

    router.get('/', async () => {
      // Abort while handler is running
      controller.abort()
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response('Home')
    })

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )
  })

  it('handles signal from Request object passed to fetch()', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    controller.abort()

    await assert.rejects(
      async () => {
        await router.fetch(request)
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('handles signal from init object', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    controller.abort()

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('allows middleware to catch and handle abort errors', async () => {
    let controller = new AbortController()
    let errorCaught = false

    let router = createRouter({
      middleware: [
        async (_, next) => {
          try {
            return await next()
          } catch (error) {
            if ((error as Error).name === 'AbortError') {
              errorCaught = true
            }
            throw error
          }
        },
      ],
    })

    router.get('/', async () => {
      // Simulate some async work that gets aborted
      await new Promise((resolve) => setTimeout(resolve, 50))
      return new Response('Home')
    })

    // Abort while handler is running
    setTimeout(() => controller.abort(), 10)

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )

    // Middleware should have caught the error
    assert.equal(errorCaught, true)
  })

  it('completes successfully if not aborted', async () => {
    let controller = new AbortController()
    let router = createRouter()

    router.get('/', () => new Response('Home'))

    let response = await router.fetch('https://remix.run', { signal: controller.signal })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('throws AbortError when aborted before middleware completes', async () => {
    let controller = new AbortController()

    let router = createRouter({
      middleware: [
        async () => {
          controller.abort()
          await new Promise((resolve) => setTimeout(resolve, 10))
        },
      ],
    })

    router.get('/', () => new Response('Home'))

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )
  })

  it('does not call downstream middleware or handler when aborted in upstream middleware', async () => {
    let controller = new AbortController()
    let downstreamMiddlewareCalled = false
    let handlerCalled = false

    let router = createRouter({
      middleware: [
        // Upstream middleware that aborts
        async () => {
          controller.abort()
          await new Promise((resolve) => setTimeout(resolve, 10))
        },
        // Downstream middleware that should NOT be called
        async () => {
          downstreamMiddlewareCalled = true
        },
      ],
    })

    // Handler that should NOT be called
    router.get('/', () => {
      handlerCalled = true
      return new Response('Home')
    })

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )

    assert.equal(downstreamMiddlewareCalled, false)
    assert.equal(handlerCalled, false)
  })
})
