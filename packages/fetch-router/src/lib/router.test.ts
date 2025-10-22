import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { RegExpMatcher, RoutePattern } from '@remix-run/route-pattern'

import { createStorageKey } from './app-storage.ts'
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

    let router = createRouter()

    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('middleware')
    })

    router.get(routes.home, () => new Response('Home'))

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    assert.equal(requestLog.length, 1)
    assert.deepEqual(requestLog, ['middleware'])
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

  it('delegates to another router and runs all middleware from both', async () => {
    let requestLog: string[] = []

    let adminRouter = createRouter()
    adminRouter.use(({ url }) => {
      requestLog.push(url.href)
    })
    adminRouter.get('/', () => new Response('Admin'))
    adminRouter.get('/users', () => new Response('Admin Users'))

    let router = createRouter()
    router.use(({ url }) => {
      requestLog.push(url.href)
    })
    router.get('/', () => new Response('Home'))

    router.mount('/admin', adminRouter)

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(requestLog, ['https://remix.run/'])

    requestLog = []

    response = await router.fetch('https://remix.run/admin')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Admin')
    assert.deepEqual(requestLog, ['https://remix.run/', 'https://remix.run/'])

    requestLog = []

    response = await router.fetch('https://remix.run/admin/users')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Admin Users')
    assert.deepEqual(requestLog, ['https://remix.run/users', 'https://remix.run/users'])
  })

  it('continues matching routes registered after a mount', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let adminRouter = createRouter()
    adminRouter.get('/profile', () => new Response('Admin Profile'))

    let dispatchSpy = mock.method(adminRouter, 'dispatch')

    // This is a miss
    router.mount('/admin', adminRouter)

    router.get('/admin', () => new Response('Admin'))

    let response = await router.fetch('https://remix.run/admin')

    // The dispatch method should have been called
    assert.equal(dispatchSpy.mock.calls.length, 1)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Admin')
  })

  it('replaces any corresponding options set in the original `Request` when options are provided', async () => {
    let requestLog: Array<string | null> = []
    let router = createRouter()
    router.use(({ request }) => {
      requestLog.push(request.headers.get('From'))
    })
    router.get('/', () => new Response('Home'))

    await router.fetch('https://remix.run')
    assert.deepEqual(requestLog, [null])

    requestLog = []

    await router.fetch('https://remix.run', { headers: { From: 'admin@remix.run' } })
    assert.deepEqual(requestLog, ['admin@remix.run'])
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
      use: [middleware],
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
      use: [middleware],
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
      use: [middleware], // outer middleware
      handlers: {
        blog: {
          use: [middleware], // inner middleware
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
      use: [
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
      use: [
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

  it('merges inline middleware with global middleware', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()
    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('global')
    })

    router.map(routes, {
      use: [
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

    assert.deepEqual(requestLog, ['global', 'inline', 'handler'])
  })

  it('does not run middleware defined after a route', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('a')
    })

    router.get('/', () => {
      requestLog.push('handler')
      return new Response('OK')
    })

    router.use(() => {
      requestLog.push('b')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    assert.deepEqual(requestLog, ['a', 'handler']) // no 'b'
  })
})

describe('per-route middleware', () => {
  it('registers a route with single middleware in array', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/', {
      use: [
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
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/', {
      use: [
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

  it('registers a route without middleware', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/', () => {
      requestLog.push('handler')
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['handler'])
  })

  it('executes per-route middleware after global middleware', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('global')
    })

    router.get('/', {
      use: [
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
    assert.deepEqual(requestLog, ['global', 'route-1', 'route-2', 'handler'])
  })

  it('applies middleware only to specific route', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/a', {
      use: [
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
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/', {
      use: [],
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
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/a', {
      use: [
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
      use: [
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

  it('merges with multiple global middleware', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('global-1')
    })

    router.use(() => {
      requestLog.push('global-2')
    })

    router.get('/', {
      use: [
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
    assert.deepEqual(requestLog, ['global-1', 'global-2', 'route-1', 'route-2', 'handler'])
  })

  it('handles middleware that returns a response (short-circuits)', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get('/', {
      use: [
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

  it('merges per-route middleware with parent route map middleware', async () => {
    let routes = createRoutes({
      admin: {
        dashboard: '/admin/dashboard',
        users: '/admin/users',
      },
    })

    let router = createRouter()
    let requestLog: string[] = []

    // Map routes with parent middleware and a child route with its own per-route middleware
    router.map(routes.admin, {
      use: [
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
          use: [
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

    // Dashboard should only have parent middleware
    let response1 = await router.fetch('https://remix.run/admin/dashboard')
    assert.equal(response1.status, 200)
    assert.equal(await response1.text(), 'Dashboard')
    assert.deepEqual(requestLog, ['auth', 'admin', 'dashboard-handler'])

    requestLog = []

    // Users should have both parent and per-route middleware
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
      defaultHandler: ({ url }) => {
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
      defaultHandler: () => {
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

  it('propagates errors thrown in global middleware', async () => {
    let router = createRouter()

    router.use(() => {
      throw new Error('Global middleware error')
    })

    router.get('/', () => new Response('OK'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Global middleware error'))
  })

  it('propagates errors thrown in per-route middleware', async () => {
    let router = createRouter()

    router.get('/', {
      use: [
        () => {
          throw new Error('Per-route middleware error')
        },
      ],
      handler() {
        return new Response('OK')
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/')
    }, new Error('Per-route middleware error'))
  })

  it('propagates errors thrown in defaultHandler', async () => {
    let router = createRouter({
      defaultHandler: () => {
        throw new Error('Default handler error')
      },
    })

    router.get('/home', () => new Response('Home'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/missing')
    }, new Error('Default handler error'))
  })

  it('allows middleware to catch and handle errors from downstream', async () => {
    let router = createRouter()

    router.use(async (_, next) => {
      try {
        return await next()
      } catch (error) {
        return new Response(`Caught: ${(error as Error).message}`, { status: 500 })
      }
    })

    router.get('/', () => {
      throw new Error('Handler error')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 500)
    assert.equal(await response.text(), 'Caught: Handler error')
  })
})

describe('router.dispatch()', () => {
  it('returns null when no route matches', async () => {
    let router = createRouter()
    router.get('/home', () => new Response('Home'))

    let response = await router.dispatch(new Request('https://remix.run/missing'))

    assert.equal(response, null)
  })

  it('returns a response when a route matches', async () => {
    let router = createRouter()
    router.get('/home', () => new Response('Home'))

    let response = await router.dispatch(new Request('https://remix.run/home'))

    assert.ok(response)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('does not call the defaultHandler', async () => {
    let defaultHandlerCalled = false
    let router = createRouter({
      defaultHandler: () => {
        defaultHandlerCalled = true
        return new Response('Default', { status: 404 })
      },
    })

    router.get('/home', () => new Response('Home'))

    let response = await router.dispatch(new Request('https://remix.run/missing'))

    assert.equal(response, null)
    assert.equal(defaultHandlerCalled, false)
  })

  it('accepts a RequestContext instead of a Request', async () => {
    let storageKey = createStorageKey<string>()
    let router = createRouter()
    router.get('/:id', ({ params, storage }) => {
      return new Response(`ID: ${params.id}, Storage: ${storage.get(storageKey)}`)
    })

    let request = new Request('https://remix.run/123')
    let context = new RequestContext(request)
    context.storage.set(storageKey, 'value')

    let response = await router.dispatch(context)

    assert.ok(response)
    assert.equal(await response.text(), 'ID: 123, Storage: value')
  })

  it('passes upstream middleware to nested routes', async () => {
    let requestLog: string[] = []

    let router = createRouter()
    router.get('/', () => {
      requestLog.push('handler')
      return new Response('OK')
    })

    let request = new Request('https://remix.run/')
    let upstreamMiddleware = [
      () => {
        requestLog.push('upstream')
      },
    ]

    let response = await router.dispatch(request, upstreamMiddleware)

    assert.ok(response)
    assert.deepEqual(requestLog, ['upstream', 'handler'])
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

describe('form data parsing', () => {
  it('does not provide context.formData on a GET request', async () => {
    let router = createRouter({ parseFormData: false })
    let formData: FormData | undefined

    router.get('/', (context) => {
      formData = context.formData
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(formData, undefined)
  })

  it('provides context.formData on a POST', async () => {
    let router = createRouter({ parseFormData: true })
    let formData: FormData | undefined

    router.post('/', (context) => {
      formData = context.formData
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'name=test',
    })

    assert.equal(response.status, 200)
    assert.ok(formData)
    assert.ok(formData instanceof FormData)
    assert.equal(formData.get('name'), 'test')
  })

  it('provides an empty context.formData on a POST when form data parsing is disabled', async () => {
    let router = createRouter({ parseFormData: false })
    let formData: FormData | undefined

    router.post('/submit', (context) => {
      formData = context.formData
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'name=test',
    })

    assert.equal(response.status, 200)
    assert.ok(formData)
    assert.ok(formData instanceof FormData)
    assert.equal(formData.get('name'), null)
  })
})

describe('method override', () => {
  it('allows POST with _method=DELETE to match a DELETE route', async () => {
    let router = createRouter({ parseFormData: true })

    router.delete('/posts/:id', ({ params }) => {
      return new Response(`Deleted post ${params.id}`)
    })

    let response = await router.fetch('https://remix.run/posts/123', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=DELETE',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Deleted post 123')
  })

  it('allows POST with _method=PUT to match a PUT route', async () => {
    let router = createRouter({ parseFormData: true })

    router.put('/posts/:id', ({ params }) => {
      return new Response(`Updated post ${params.id}`)
    })

    let response = await router.fetch('https://remix.run/posts/456', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=PUT&title=New+Title',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Updated post 456')
  })

  it('allows POST with _method=PATCH to match a PATCH route', async () => {
    let router = createRouter({ parseFormData: true })

    router.patch('/posts/:id', ({ params }) => {
      return new Response(`Patched post ${params.id}`)
    })

    let response = await router.fetch('https://remix.run/posts/789', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=PATCH',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Patched post 789')
  })

  it('supports custom method override field name', async () => {
    let router = createRouter({ parseFormData: true, methodOverride: '__method' })

    router.delete('/posts/:id', ({ params }) => {
      return new Response(`Deleted post ${params.id}`)
    })

    let response = await router.fetch('https://remix.run/posts/123', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '__method=DELETE',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Deleted post 123')
  })

  it('disables method override when set to false', async () => {
    let router = createRouter({ parseFormData: true, methodOverride: false })

    router.delete('/posts/:id', () => {
      return new Response('Deleted')
    })

    // POST with _method=DELETE should not match DELETE route
    let response = await router.fetch('https://remix.run/posts/123', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=DELETE',
    })

    assert.equal(response.status, 404)
  })

  it('ignores empty method override values', async () => {
    let router = createRouter({ parseFormData: true })

    router.post('/posts', () => {
      return new Response('Created')
    })

    router.delete('/posts/:id', () => {
      return new Response('Deleted')
    })

    // POST with empty _method should match POST route
    let response = await router.fetch('https://remix.run/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=',
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Created')
  })

  it('uppercases method override values', async () => {
    let router = createRouter({ parseFormData: true })

    router.delete('/posts/:id', ({ params }) => {
      return new Response(`Deleted post ${params.id}`)
    })

    let response = await router.fetch('https://remix.run/posts/123', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '_method=delete', // lowercase
    })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Deleted post 123')
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
        assert.ok(error instanceof DOMException)
        assert.equal(error.message, 'The request was aborted')
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
    let router = createRouter()
    let controller = new AbortController()
    let errorCaught = false

    router.use(async (context, next) => {
      try {
        await next(context)
      } catch (error: any) {
        if (error.name === 'AbortError') {
          errorCaught = true
        }
        throw error
      }
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
    let router = createRouter()
    let controller = new AbortController()

    router.get('/', () => new Response('Home'))

    let response = await router.fetch('https://remix.run', { signal: controller.signal })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('throws AbortError when aborted before middleware completes', async () => {
    let router = createRouter()
    let controller = new AbortController()

    router.use(async () => {
      controller.abort()
      await new Promise((resolve) => setTimeout(resolve, 10))
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

  it('throws AbortError when aborted during sub-router dispatch', async () => {
    let adminRouter = createRouter()
    let controller = new AbortController()

    adminRouter.get('/', async () => {
      controller.abort()
      await new Promise((resolve) => setTimeout(resolve, 10))
      return new Response('Admin')
    })

    let router = createRouter()
    router.mount('/admin', adminRouter)

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run/admin', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )
  })

  it('allows handlers to access signal via context.request.signal', async () => {
    let router = createRouter()
    let controller = new AbortController()
    let signalAccessible = false

    router.get('/', (context) => {
      // Handler can access the signal
      signalAccessible = context.request.signal != null
      assert.equal(context.request.signal.aborted, false)
      return new Response('Home')
    })

    let response = await router.fetch('https://remix.run', { signal: controller.signal })

    assert.equal(response.status, 200)
    assert.equal(signalAccessible, true)
  })

  it('does not call downstream middleware or handler when aborted in upstream middleware', async () => {
    let router = createRouter()
    let controller = new AbortController()
    let downstreamMiddlewareCalled = false
    let handlerCalled = false

    // Upstream middleware that aborts
    router.use(async () => {
      controller.abort()
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    // Downstream middleware that should NOT be called
    router.use(() => {
      downstreamMiddlewareCalled = true
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
