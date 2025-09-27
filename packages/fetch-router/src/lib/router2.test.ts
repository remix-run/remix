import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RoutePattern } from '@remix-run/route-pattern'

import type { Assert, IsEqual } from './type-utils.ts'
import { RequestMethods, Route, createRoutes, createHandlers, createRouter } from './router2.ts'
import type { RequestMethod } from './router2.ts'

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
    assert.deepEqual(typeof handlers.home.requestHandler, 'function')

    assert.deepEqual(handlers.users.index.route.methods, RequestMethods)
    assert.deepEqual(handlers.users.index.route.pattern, new RoutePattern('/users'))
    assert.deepEqual(handlers.users.index.middleware, null)
    assert.deepEqual(typeof handlers.users.index.requestHandler, 'function')

    assert.deepEqual(handlers.users.show.route.methods, RequestMethods)
    assert.deepEqual(handlers.users.show.route.pattern, new RoutePattern('/users/:id'))
    assert.deepEqual(handlers.users.show.middleware, null)
    assert.deepEqual(typeof handlers.users.show.requestHandler, 'function')
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
    assert.deepEqual(typeof handlers.home.requestHandler, 'function')

    assert.deepEqual(handlers.users.index.route.methods, ['GET'])
    assert.deepEqual(handlers.users.index.route.pattern, new RoutePattern('/users'))
    assert.deepEqual(handlers.users.index.middleware, null)
    assert.deepEqual(typeof handlers.users.index.requestHandler, 'function')

    assert.deepEqual(handlers.users.create.route.methods, ['POST'])
    assert.deepEqual(handlers.users.create.route.pattern, new RoutePattern('/users'))
    assert.deepEqual(handlers.users.create.middleware, null)
    assert.deepEqual(typeof handlers.users.create.requestHandler, 'function')

    assert.deepEqual(handlers.users.show.route.methods, RequestMethods)
    assert.deepEqual(handlers.users.show.route.pattern, new RoutePattern('/users/:id'))
    assert.deepEqual(handlers.users.show.middleware, null)
    assert.deepEqual(typeof handlers.users.show.requestHandler, 'function')
  })
})

describe('createRouter()', () => {
  it('creates a router', async () => {
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
})
