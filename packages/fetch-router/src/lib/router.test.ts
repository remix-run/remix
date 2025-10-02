import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

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
  it('applies middleware to single route', async () => {
    let routes = createRoutes({ home: '/' })
    let router = createRouter()
    let log: string[] = []

    router.map(
      routes.home,
      [
        () => {
          log.push('middleware')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    assert.deepEqual(log, ['middleware', 'handler'])
  })

  it('applies middleware to all routes including nested', async () => {
    let routes = createRoutes({
      home: '/',
      blog: {
        index: '/blog',
        show: '/blog/:id',
      },
    })
    let router = createRouter()
    let log: string[] = []

    router.map(
      routes,
      [
        () => {
          log.push('shared')
        },
      ],
      {
        home() {
          log.push('home')
          return new Response('Home')
        },
        blog: {
          index() {
            log.push('blog-index')
            return new Response('Blog')
          },
          show() {
            log.push('blog-show')
            return new Response('Post')
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.deepEqual(log, ['shared', 'home'])

    log = []
    response = await router.fetch('https://remix.run/blog')
    assert.deepEqual(log, ['shared', 'blog-index'])

    log = []
    response = await router.fetch('https://remix.run/blog/1')
    assert.deepEqual(log, ['shared', 'blog-show'])
  })

  it('applies middleware to deeply nested routes', async () => {
    let routes = createRoutes({
      api: {
        v1: {
          users: {
            index: '/api/v1/users',
            show: '/api/v1/users/:id',
          },
        },
      },
    })
    let router = createRouter()
    let log: string[] = []

    router.map(
      routes,
      [
        () => {
          log.push('api-middleware')
        },
      ],
      {
        api: {
          v1: {
            users: {
              index() {
                log.push('users-index')
                return new Response('Users')
              },
              show() {
                log.push('user-show')
                return new Response('User')
              },
            },
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/api/v1/users')
    assert.deepEqual(log, ['api-middleware', 'users-index'])

    log = []
    response = await router.fetch('https://remix.run/api/v1/users/1')
    assert.deepEqual(log, ['api-middleware', 'user-show'])
  })

  it('allows selective middleware by mapping specific nested paths', async () => {
    let routes = createRoutes({
      public: '/public',
      admin: {
        dashboard: '/admin/dashboard',
        users: '/admin/users',
      },
    })
    let router = createRouter()
    let log: string[] = []

    // Public route - no middleware
    router.map(routes.public, () => {
      log.push('public')
      return new Response('Public')
    })

    // Admin routes - with auth middleware
    router.map(
      routes.admin,
      [
        () => {
          log.push('auth')
        },
      ],
      {
        dashboard() {
          log.push('dashboard')
          return new Response('Dashboard')
        },
        users() {
          log.push('users')
          return new Response('Users')
        },
      },
    )

    let response = await router.fetch('https://remix.run/public')
    assert.deepEqual(log, ['public'])

    log = []
    response = await router.fetch('https://remix.run/admin/dashboard')
    assert.deepEqual(log, ['auth', 'dashboard'])

    log = []
    response = await router.fetch('https://remix.run/admin/users')
    assert.deepEqual(log, ['auth', 'users'])
  })

  it('merges map middleware with global middleware', async () => {
    let routes = createRoutes({ home: '/' })
    let router = createRouter()
    let log: string[] = []

    router.use(() => {
      log.push('global')
    })

    router.map(
      routes.home,
      [
        () => {
          log.push('map')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.deepEqual(log, ['global', 'map', 'handler'])
  })

  it('works with empty middleware array', async () => {
    let routes = createRoutes({ home: '/' })
    let router = createRouter()
    let log: string[] = []

    router.map(routes.home, [], () => {
      log.push('handler')
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/')
    assert.deepEqual(log, ['handler'])
  })

  it('combines map middleware with nested route maps', async () => {
    let routes = createRoutes({
      blog: {
        index: '/blog',
        show: '/blog/:id',
      },
    })
    let router = createRouter()
    let log: string[] = []

    router.map(
      routes,
      [
        () => {
          log.push('outer')
        },
      ],
      {
        blog: {
          index() {
            log.push('blog-index')
            return new Response('Blog')
          },
          show() {
            log.push('blog-show')
            return new Response('Post')
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/blog')
    assert.deepEqual(log, ['outer', 'blog-index'])

    log = []
    response = await router.fetch('https://remix.run/blog/1')
    assert.deepEqual(log, ['outer', 'blog-show'])
  })

  it('works with routes that have specific methods', async () => {
    let routes = createRoutes({
      blog: {
        index: { method: 'GET', pattern: '/blog' },
        create: { method: 'POST', pattern: '/blog' },
      },
    })
    let router = createRouter()
    let log: string[] = []

    router.map(
      routes.blog,
      [
        () => {
          log.push('blog-middleware')
        },
      ],
      {
        index() {
          log.push('index')
          return new Response('Blog')
        },
        create() {
          log.push('create')
          return new Response('Created')
        },
      },
    )

    let response = await router.fetch('https://remix.run/blog')
    assert.deepEqual(log, ['blog-middleware', 'index'])

    log = []
    response = await router.fetch('https://remix.run/blog', { method: 'POST' })
    assert.deepEqual(log, ['blog-middleware', 'create'])
  })

  it('middleware cascades through multiple levels of nesting', async () => {
    let routes = createRoutes({
      level1: {
        level2: {
          level3: {
            index: '/l1/l2/l3',
          },
        },
      },
    })
    let router = createRouter()
    let log: string[] = []

    router.map(
      routes,
      [
        () => {
          log.push('m1')
        },
        () => {
          log.push('m2')
        },
      ],
      {
        level1: {
          level2: {
            level3: {
              index() {
                log.push('handler')
                return new Response('OK')
              },
            },
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/l1/l2/l3')
    assert.deepEqual(log, ['m1', 'm2', 'handler'])
  })
})

describe('per-route middleware', () => {
  it('registers a route with single middleware in array', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get(
      '/',
      [
        () => {
          log.push('middleware')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    assert.deepEqual(log, ['middleware', 'handler'])
  })

  it('registers a route with multiple middleware', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get(
      '/',
      [
        () => {
          log.push('m1')
        },
        () => {
          log.push('m2')
        },
        () => {
          log.push('m3')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(log, ['m1', 'm2', 'm3', 'handler'])
  })

  it('registers a route without middleware', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get('/', () => {
      log.push('handler')
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(log, ['handler'])
  })

  it('executes per-route middleware after global middleware', async () => {
    let router = createRouter()
    let log: string[] = []

    router.use(() => {
      log.push('global')
    })

    router.get(
      '/',
      [
        () => {
          log.push('route-1')
        },
        () => {
          log.push('route-2')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(log, ['global', 'route-1', 'route-2', 'handler'])
  })

  it('applies middleware only to specific route', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get(
      '/a',
      [
        () => {
          log.push('middleware-a')
        },
      ],
      () => {
        log.push('handler-a')
        return new Response('A')
      },
    )

    router.get('/b', () => {
      log.push('handler-b')
      return new Response('B')
    })

    let response = await router.fetch('https://remix.run/a')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'A')
    assert.deepEqual(log, ['middleware-a', 'handler-a'])

    log = []
    response = await router.fetch('https://remix.run/b')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'B')
    assert.deepEqual(log, ['handler-b'])
  })

  it('works with empty middleware array', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get('/', [], () => {
      log.push('handler')
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(log, ['handler'])
  })

  it('allows different routes to have different middleware', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get(
      '/a',
      [
        () => {
          log.push('auth')
        },
      ],
      () => {
        log.push('handler-a')
        return new Response('A')
      },
    )

    router.post(
      '/b',
      [
        () => {
          log.push('validate')
        },
        () => {
          log.push('sanitize')
        },
      ],
      () => {
        log.push('handler-b')
        return new Response('B')
      },
    )

    let response = await router.fetch('https://remix.run/a')
    assert.deepEqual(log, ['auth', 'handler-a'])

    log = []
    response = await router.fetch('https://remix.run/b', { method: 'POST' })
    assert.deepEqual(log, ['validate', 'sanitize', 'handler-b'])
  })

  it('works with all HTTP methods', async () => {
    let router = createRouter()
    let methods: string[] = []

    let middleware = [
      () => {
        methods.push('middleware')
      },
    ]

    router.get('/', middleware, () => new Response('GET'))
    router.post('/', middleware, () => new Response('POST'))
    router.put('/', middleware, () => new Response('PUT'))
    router.patch('/', middleware, () => new Response('PATCH'))
    router.delete('/', middleware, () => new Response('DELETE'))
    router.options('/', middleware, () => new Response('OPTIONS'))
    router.head('/', middleware, () => new Response('HEAD'))
    router.any('/any', middleware, () => new Response('ANY'))

    for (let method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
      methods = []
      await router.fetch('https://remix.run/', { method })
      assert.deepEqual(methods, ['middleware'], `Failed for ${method}`)
    }

    methods = []
    await router.fetch('https://remix.run/any', { method: 'GET' })
    assert.deepEqual(methods, ['middleware'])
  })

  it('merges with multiple global middleware', async () => {
    let router = createRouter()
    let log: string[] = []

    router.use(() => {
      log.push('global-1')
    })

    router.use(() => {
      log.push('global-2')
    })

    router.get(
      '/',
      [
        () => {
          log.push('route-1')
        },
        () => {
          log.push('route-2')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(log, ['global-1', 'global-2', 'route-1', 'route-2', 'handler'])
  })

  it('handles middleware that returns a response (short-circuits)', async () => {
    let router = createRouter()
    let log: string[] = []

    router.get(
      '/',
      [
        () => {
          log.push('m1')
        },
        () => {
          log.push('m2-short-circuit')
          return new Response('Blocked', { status: 403 })
        },
        () => {
          log.push('m3')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'Blocked')
    assert.deepEqual(log, ['m1', 'm2-short-circuit'])
  })

  it('works with Route objects from createRoutes()', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()
    let log: string[] = []

    router.get(
      routes.home,
      [
        () => {
          log.push('middleware')
        },
      ],
      () => {
        log.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(log, ['middleware', 'handler'])
  })
})
