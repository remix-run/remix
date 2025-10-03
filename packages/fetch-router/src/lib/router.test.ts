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
  it('applies middleware to single route', async () => {
    let routes = createRoutes({ home: '/' })
    let router = createRouter()
    let requestLog: string[] = []

    router.map(
      routes.home,
      [
        () => {
          requestLog.push('middleware')
        },
      ],
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    assert.deepEqual(requestLog, ['middleware', 'handler'])
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
    let requestLog: string[] = []

    router.map(
      routes,
      [
        () => {
          requestLog.push('shared')
        },
      ],
      {
        home() {
          requestLog.push('home')
          return new Response('Home')
        },
        blog: {
          index() {
            requestLog.push('blog-index')
            return new Response('Blog')
          },
          show() {
            requestLog.push('blog-show')
            return new Response('Post')
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.deepEqual(requestLog, ['shared', 'home'])

    requestLog = []
    response = await router.fetch('https://remix.run/blog')
    assert.deepEqual(requestLog, ['shared', 'blog-index'])

    requestLog = []
    response = await router.fetch('https://remix.run/blog/1')
    assert.deepEqual(requestLog, ['shared', 'blog-show'])
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
    let requestLog: string[] = []

    router.map(
      routes,
      [
        () => {
          requestLog.push('api-middleware')
        },
      ],
      {
        api: {
          v1: {
            users: {
              index() {
                requestLog.push('users-index')
                return new Response('Users')
              },
              show() {
                requestLog.push('user-show')
                return new Response('User')
              },
            },
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/api/v1/users')
    assert.deepEqual(requestLog, ['api-middleware', 'users-index'])

    requestLog = []
    response = await router.fetch('https://remix.run/api/v1/users/1')
    assert.deepEqual(requestLog, ['api-middleware', 'user-show'])
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
    let requestLog: string[] = []

    // Public route - no middleware
    router.map(routes.public, () => {
      requestLog.push('public')
      return new Response('Public')
    })

    // Admin routes - with auth middleware
    router.map(
      routes.admin,
      [
        () => {
          requestLog.push('auth')
        },
      ],
      {
        dashboard() {
          requestLog.push('dashboard')
          return new Response('Dashboard')
        },
        users() {
          requestLog.push('users')
          return new Response('Users')
        },
      },
    )

    let response = await router.fetch('https://remix.run/public')
    assert.deepEqual(requestLog, ['public'])

    requestLog = []
    response = await router.fetch('https://remix.run/admin/dashboard')
    assert.deepEqual(requestLog, ['auth', 'dashboard'])

    requestLog = []
    response = await router.fetch('https://remix.run/admin/users')
    assert.deepEqual(requestLog, ['auth', 'users'])
  })

  it('merges map middleware with global middleware', async () => {
    let routes = createRoutes({ home: '/' })
    let router = createRouter()
    let requestLog: string[] = []

    router.use(() => {
      requestLog.push('global')
    })

    router.map(
      routes.home,
      [
        () => {
          requestLog.push('map')
        },
      ],
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.deepEqual(requestLog, ['global', 'map', 'handler'])
  })

  it('works with empty middleware array', async () => {
    let routes = createRoutes({ home: '/' })
    let router = createRouter()
    let requestLog: string[] = []

    router.map(routes.home, [], () => {
      requestLog.push('handler')
      return new Response('OK')
    })

    await router.fetch('https://remix.run/')

    assert.deepEqual(requestLog, ['handler'])
  })

  it('combines map middleware with nested route maps', async () => {
    let routes = createRoutes({
      blog: {
        index: '/blog',
        show: '/blog/:id',
      },
    })
    let router = createRouter()
    let requestLog: string[] = []

    router.map(
      routes,
      [
        () => {
          requestLog.push('outer')
        },
      ],
      {
        blog: {
          index() {
            requestLog.push('blog-index')
            return new Response('Blog')
          },
          show() {
            requestLog.push('blog-show')
            return new Response('Post')
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/blog')
    assert.deepEqual(requestLog, ['outer', 'blog-index'])

    requestLog = []
    response = await router.fetch('https://remix.run/blog/1')
    assert.deepEqual(requestLog, ['outer', 'blog-show'])
  })

  it('works with routes that have specific methods', async () => {
    let routes = createRoutes({
      blog: {
        index: { method: 'GET', pattern: '/blog' },
        create: { method: 'POST', pattern: '/blog' },
      },
    })
    let router = createRouter()
    let requestLog: string[] = []

    router.map(
      routes.blog,
      [
        () => {
          requestLog.push('blog-middleware')
        },
      ],
      {
        index() {
          requestLog.push('index')
          return new Response('Blog')
        },
        create() {
          requestLog.push('create')
          return new Response('Created')
        },
      },
    )

    let response = await router.fetch('https://remix.run/blog')
    assert.deepEqual(requestLog, ['blog-middleware', 'index'])

    requestLog = []
    response = await router.fetch('https://remix.run/blog', { method: 'POST' })
    assert.deepEqual(requestLog, ['blog-middleware', 'create'])
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
    let requestLog: string[] = []

    router.map(
      routes,
      [
        () => {
          requestLog.push('m1')
        },
        () => {
          requestLog.push('m2')
        },
      ],
      {
        level1: {
          level2: {
            level3: {
              index() {
                requestLog.push('handler')
                return new Response('OK')
              },
            },
          },
        },
      },
    )

    let response = await router.fetch('https://remix.run/l1/l2/l3')
    assert.deepEqual(requestLog, ['m1', 'm2', 'handler'])
  })
})

describe('per-route middleware', () => {
  it('registers a route with single middleware in array', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get(
      '/',
      [
        () => {
          requestLog.push('middleware')
        },
      ],
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    assert.deepEqual(requestLog, ['middleware', 'handler'])
  })

  it('registers a route with multiple middleware', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get(
      '/',
      [
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
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

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

    router.get(
      '/',
      [
        () => {
          requestLog.push('route-1')
        },
        () => {
          requestLog.push('route-2')
        },
      ],
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['global', 'route-1', 'route-2', 'handler'])
  })

  it('applies middleware only to specific route', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get(
      '/a',
      [
        () => {
          requestLog.push('middleware-a')
        },
      ],
      () => {
        requestLog.push('handler-a')
        return new Response('A')
      },
    )

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

    router.get('/', [], () => {
      requestLog.push('handler')
      return new Response('OK')
    })

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['handler'])
  })

  it('allows different routes to have different middleware', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get(
      '/a',
      [
        () => {
          requestLog.push('auth')
        },
      ],
      () => {
        requestLog.push('handler-a')
        return new Response('A')
      },
    )

    router.post(
      '/b',
      [
        () => {
          requestLog.push('validate')
        },
        () => {
          requestLog.push('sanitize')
        },
      ],
      () => {
        requestLog.push('handler-b')
        return new Response('B')
      },
    )

    let response = await router.fetch('https://remix.run/a')
    assert.deepEqual(requestLog, ['auth', 'handler-a'])

    requestLog = []
    response = await router.fetch('https://remix.run/b', { method: 'POST' })
    assert.deepEqual(requestLog, ['validate', 'sanitize', 'handler-b'])
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

    for (let method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
      methods = []
      await router.fetch('https://remix.run/', { method })
      assert.deepEqual(methods, ['middleware'], `Failed for ${method}`)
    }
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

    router.get(
      '/',
      [
        () => {
          requestLog.push('route-1')
        },
        () => {
          requestLog.push('route-2')
        },
      ],
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['global-1', 'global-2', 'route-1', 'route-2', 'handler'])
  })

  it('handles middleware that returns a response (short-circuits)', async () => {
    let router = createRouter()
    let requestLog: string[] = []

    router.get(
      '/',
      [
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
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'Blocked')
    assert.deepEqual(requestLog, ['m1', 'm2-short-circuit'])
  })

  it('works with Route objects from createRoutes()', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter()
    let requestLog: string[] = []

    router.map(
      routes.home,
      [
        () => {
          requestLog.push('middleware')
        },
      ],
      () => {
        requestLog.push('handler')
        return new Response('OK')
      },
    )

    let response = await router.fetch('https://remix.run/')
    assert.equal(response.status, 200)
    assert.deepEqual(requestLog, ['middleware', 'handler'])
  })
})
