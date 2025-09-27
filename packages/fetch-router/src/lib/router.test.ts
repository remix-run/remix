import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from '@remix-run/route-pattern'

import type { Assert, IsEqual } from './type-utils.ts'
import { RequestMethods, Route, createRoutes, createHandlers, createRouter } from './router.ts'
import type { NextFunction, RequestMethod } from './router.ts'

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
          methods: ['GET', 'POST'],
          pattern: '/users/:id/edit',
        },
      },
    })

    assert.deepEqual(routes.home.methods, RequestMethods)
    assert.deepEqual(routes.home.pattern, new RoutePattern('/'))

    assert.deepEqual(routes.users.index.methods, RequestMethods)
    assert.deepEqual(routes.users.index.pattern, new RoutePattern('/users'))

    assert.deepEqual(routes.users.show.methods, RequestMethods)
    assert.deepEqual(routes.users.show.pattern, new RoutePattern('/users/:id'))

    assert.deepEqual(routes.users.edit.methods, ['GET', 'POST'])
    assert.deepEqual(routes.users.edit.pattern, new RoutePattern('/users/:id/edit'))
  })

  it('creates a route map with a base pattern', () => {
    let categoriesRoutes = createRoutes('categories', {
      index: '/',
      edit: {
        methods: ['GET', 'POST'],
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
      Assert<IsEqual<typeof routes.home, Route<RequestMethod, 'https://remix.run'>>>,
      Assert<
        IsEqual<
          typeof routes.users,
          {
            readonly index: Route<RequestMethod, 'https://remix.run/users'>
            readonly show: Route<RequestMethod, 'https://remix.run/users/:id'>
          }
        >
      >,
      Assert<
        IsEqual<
          typeof routes.categories,
          {
            readonly index: Route<RequestMethod, 'https://remix.run/categories'>
            readonly edit: Route<'GET' | 'POST', 'https://remix.run/categories/:slug/edit'>
          }
        >
      >,
    ]

    assert.deepEqual(routes.home.methods, RequestMethods)
    assert.deepEqual(routes.home.pattern, new RoutePattern('https://remix.run/'))

    assert.deepEqual(routes.users.index.methods, RequestMethods)
    assert.deepEqual(routes.users.index.pattern, new RoutePattern('https://remix.run/users'))

    assert.deepEqual(routes.users.show.methods, RequestMethods)
    assert.deepEqual(routes.users.show.pattern, new RoutePattern('https://remix.run/users/:id'))

    assert.deepEqual(routes.categories.index.methods, RequestMethods)
    assert.deepEqual(
      routes.categories.index.pattern,
      new RoutePattern('https://remix.run/categories'),
    )

    assert.deepEqual(routes.categories.edit.methods, ['GET', 'POST'])
    assert.deepEqual(
      routes.categories.edit.pattern,
      new RoutePattern('https://remix.run/categories/:slug/edit'),
    )
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

    assert.deepEqual(handlers.home.route.methods, RequestMethods)
    assert.deepEqual(handlers.home.route.pattern, new RoutePattern('/'))
    assert.deepEqual(handlers.home.middleware, null)
    assert.deepEqual(typeof handlers.home.handlers, 'object')

    assert.deepEqual(handlers.users.index.route.methods, RequestMethods)
    assert.deepEqual(handlers.users.index.route.pattern, new RoutePattern('/users'))
    assert.deepEqual(handlers.users.index.middleware, null)
    assert.deepEqual(typeof handlers.users.index.handlers, 'object')

    assert.deepEqual(handlers.users.show.route.methods, RequestMethods)
    assert.deepEqual(handlers.users.show.route.pattern, new RoutePattern('/users/:id'))
    assert.deepEqual(handlers.users.show.middleware, null)
    assert.deepEqual(typeof handlers.users.show.handlers, 'object')
  })

  it('creates a route handler map from shorthand handler definitions', () => {
    let routes = createRoutes({
      home: '/',
      users: {
        index: { method: 'GET', pattern: '/users' },
        create: {
          methods: ['POST'],
          pattern: '/users',
        },
        show: '/users/:id',
      },
    })

    let usersHandlers = createHandlers(routes.users, {
      index: {
        get() {
          return new Response('Users')
        },
      },
      create() {
        return new Response('Created')
      },
      show({ params }) {
        return new Response(`User ${params.id}`)
      },
    })

    let handlers = createHandlers(routes, {
      home() {
        return new Response('Home')
      },
      // nested route handler map
      users: usersHandlers,
    })

    assert.deepEqual(handlers.home.route.methods, RequestMethods)
    assert.deepEqual(handlers.home.route.pattern, new RoutePattern('/'))
    assert.deepEqual(handlers.home.middleware, null)
    assert.deepEqual(typeof handlers.home.handlers, 'object')

    assert.deepEqual(handlers.users.index.route.methods, ['GET'])
    assert.deepEqual(handlers.users.index.route.pattern, new RoutePattern('/users'))
    assert.deepEqual(handlers.users.index.middleware, null)
    assert.deepEqual(typeof handlers.users.index.handlers, 'object')

    assert.deepEqual(handlers.users.create.route.methods, ['POST'])
    assert.deepEqual(handlers.users.create.route.pattern, new RoutePattern('/users'))
    assert.deepEqual(handlers.users.create.middleware, null)
    assert.deepEqual(typeof handlers.users.create.handlers, 'object')

    assert.deepEqual(handlers.users.show.route.methods, RequestMethods)
    assert.deepEqual(handlers.users.show.route.pattern, new RoutePattern('/users/:id'))
    assert.deepEqual(handlers.users.show.middleware, null)
    assert.deepEqual(typeof handlers.users.show.handlers, 'object')
  })
})

describe('router.fetch()', () => {
  it('handles a simple route', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let handlers = createHandlers(routes, {
      home() {
        return new Response('Home')
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('handles a route with a method', async () => {
    let routes = createRoutes({
      home: {
        methods: ['GET', 'POST'],
        pattern: '/',
      },
    })

    let handlers = createHandlers(routes, {
      home: {
        get() {
          return new Response('GET home')
        },
        post() {
          return new Response('POST home')
        },
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run', { method: 'GET' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'GET home')

    response = await router.fetch('https://remix.run', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'POST home')
  })

  it('calls a GET handler for a HEAD request', async () => {
    let routes = createRoutes({
      home: { methods: ['GET', 'HEAD'], pattern: '/' },
    })

    let handlers = createHandlers(routes, {
      home: {
        get() {
          return new Response('GET home', { headers: { 'X-Test': 'test' } })
        },
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run', { method: 'HEAD' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), '')
    assert.equal(response.headers.get('X-Test'), 'test')
  })

  it('supports mixed case method names in handler definitions', async () => {
    let routes = createRoutes({
      api: { methods: ['GET', 'POST'], pattern: '/api' },
    })

    let handlers = createHandlers(routes, {
      api: {
        GET: () => new Response('get'),
        post: () => new Response('post'), // lowercase
      },
    })

    let router = createRouter(handlers)

    let getResponse = await router.fetch('https://remix.run/api', { method: 'GET' })
    assert.equal(await getResponse.text(), 'get')

    let postResponse = await router.fetch('https://remix.run/api', { method: 'POST' })
    assert.equal(await postResponse.text(), 'post')
  })
})

describe('middleware', () => {
  it('runs middleware in order from left to right', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let middlewareInvocations: string[] = []

    function one(_context: any, next: NextFunction) {
      middlewareInvocations.push('one')
      return next()
    }

    function two(_context: any, next: NextFunction) {
      middlewareInvocations.push('two')
      return next()
    }

    function three(_context: any, next: NextFunction) {
      middlewareInvocations.push('three')
      return next()
    }

    let handlers = createHandlers(routes, {
      home: {
        use: [one, two, three],
        handler() {
          return new Response('Home')
        },
      },
    })

    let router = createRouter(handlers)

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

    let handlers = createHandlers(routes, {
      home: {
        use: [one, two],
        handler() {
          return new Response('Home')
        },
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'One')
    assert.deepEqual(middlewareInvocations, ['one'])
  })

  it('automatically calls the next middleware in the chain', async () => {
    let routes = createRoutes({
      home: { methods: ['GET'], pattern: '/' },
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

    let handlers = createHandlers(routes, {
      home: {
        use: [one, two],
        get() {
          return new Response('Home')
        },
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
    assert.deepEqual(middlewareInvocations, ['one', 'two'])
  })

  it('throws errors up to the top level', async () => {
    let routes = createRoutes({
      home: '/',
    })

    function one() {
      throw new Error('Middleware Boom!')
    }

    let handlers = createHandlers(routes, {
      home: {
        use: [one],
        handler() {
          return new Response('Home')
        },
      },
    })

    let router = createRouter(handlers)

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Middleware Boom!'))
  })

  it('throws error when middleware calls next() multiple times', async () => {
    let routes = createRoutes({
      home: '/',
    })

    async function badMiddleware(_context: any, next: any) {
      await next()
      await next() // This second call should throw
    }

    let handlers = createHandlers(routes, {
      home: {
        use: [badMiddleware],
        handler() {
          return new Response('Home')
        },
      },
    })

    let router = createRouter(handlers)

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('next() called multiple times'))
  })
})

describe('createHandlers() with middleware', () => {
  it('applies middleware to all route handlers', async () => {
    let routes = createRoutes({
      home: '/',
      post: '/posts/:id',
      posts: {
        comments: '/posts/:id/comments',
      },
    })

    let calledUrls: string[] = []

    function pushUrl({ url }: any) {
      calledUrls.push(url.toString())
    }

    let handlers = createHandlers(routes, [pushUrl], {
      home() {
        return new Response('Home')
      },
      post({ params }: any) {
        return new Response(`Post ${params.id}`)
      },
      posts: {
        comments({ params }: any) {
          return new Response(`Comments on post ${params.id}`)
        },
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')

    response = await router.fetch('https://remix.run/posts/1')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Post 1')

    response = await router.fetch('https://remix.run/posts/1/comments')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Comments on post 1')

    assert.deepEqual(calledUrls, [
      'https://remix.run/',
      'https://remix.run/posts/1',
      'https://remix.run/posts/1/comments',
    ])
  })
})

describe('app storage', () => {
  it('can be accessed from middleware and route handlers', async () => {
    let routes = createRoutes({
      home: { methods: ['GET'], pattern: '/' },
    })

    function auth({ storage }: any) {
      storage.set('currentUser', 'mj')
    }

    let handlers = createHandlers(routes, {
      home: {
        use: [auth],
        get({ storage }: any) {
          let currentUser = storage.get('currentUser')
          return new Response(`Hello, ${currentUser}`)
        },
      },
    })

    let router = createRouter(handlers)

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, mj')
  })
})
