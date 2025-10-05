import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import type { RequestContext } from './request-context.ts'
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

    function middleware(context: RequestContext<{ id: string }>) {
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
})
