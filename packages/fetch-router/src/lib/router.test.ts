import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRoutes } from '@remix-run/route-pattern'

import { createStorageKey } from './app-storage.ts'
import { createHandlers, createRouter } from './router.ts'
import type { RequestContext, NextFunction, RouteHandlers } from './router.ts'

describe('router.fetch()', () => {
  it('handles a simple route', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter(routes, {
      home() {
        return new Response('Home')
      },
    })

    let response = await router.fetch(new URL('https://remix.run'))

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('handles a route with a method', async () => {
    let routes = createRoutes({
      comments: {
        create: '/post/:id/comments',
      },
    })

    let commentsHandlers: RouteHandlers<typeof routes.comments> = {
      create: {
        method: 'POST',
        handler({ params }) {
          return new Response(`Created comment ${params.id}`)
        },
      },
    }

    let router = createRouter(routes, {
      comments: commentsHandlers,
    })

    let response = await router.fetch('https://remix.run/post/1/comments', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Created comment 1')
  })

  it('supports uppercase shorthand method-specific handlers', async () => {
    let routes = createRoutes({
      post: '/posts/:id',
      posts: {
        comments: '/posts/:id/comments',
      },
    })

    // Create a sub-router just for the posts routes
    let router = createRouter(routes.posts, {
      comments: {
        GET({ params }) {
          return new Response(`GET ${params.id}`)
        },
        HEAD({ params }) {
          return new Response(`HEAD ${params.id}`)
        },
        POST({ params }) {
          return new Response(`POST ${params.id}`)
        },
        PUT({ params }) {
          return new Response(`PUT ${params.id}`)
        },
        PATCH({ params }) {
          return new Response(`PATCH ${params.id}`)
        },
        DELETE({ params }) {
          return new Response(`DELETE ${params.id}`)
        },
        OPTIONS({ params }) {
          return new Response(`OPTIONS ${params.id}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run/posts/1/comments')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'GET 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'HEAD' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'HEAD 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'POST 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'PUT' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'PUT 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'PATCH' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'PATCH 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'DELETE 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'OPTIONS' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OPTIONS 1')
  })

  it('supports lowercase shorthand method-specific handlers', async () => {
    let routes = createRoutes({
      post: '/posts/:id',
      posts: {
        comments: '/posts/:id/comments',
      },
    })

    // Create a sub-router just for the posts routes
    let router = createRouter(routes.posts, {
      comments: {
        get({ params }) {
          return new Response(`get ${params.id}`)
        },
        head({ params }) {
          return new Response(`head ${params.id}`)
        },
        post({ params }) {
          return new Response(`post ${params.id}`)
        },
        put({ params }) {
          return new Response(`put ${params.id}`)
        },
        patch({ params }) {
          return new Response(`patch ${params.id}`)
        },
        delete({ params }) {
          return new Response(`delete ${params.id}`)
        },
        options({ params }) {
          return new Response(`options ${params.id}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run/posts/1/comments')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'get 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'HEAD' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'head 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'post 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'PUT' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'put 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'PATCH' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'patch 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'DELETE' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'delete 1')

    response = await router.fetch('https://remix.run/posts/1/comments', { method: 'OPTIONS' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'options 1')
  })

  it('prefers generic handlers over method-specific handlers', async () => {
    let routes = createRoutes({
      comments: '/post/:id/comments',
    })

    let router = createRouter(routes, {
      comments: {
        method: 'POST',
        handler({ params }) {
          return new Response(`Generic comment ${params.id}`)
        },
        // @ts-expect-error Invalid to combine with generic handler
        post({ params }) {
          return new Response(`Method-specific comment ${params.id}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run/post/1/comments', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Generic comment 1')
  })

  it('throws errors up to the top level', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter(routes, {
      home: {
        handler() {
          throw new Error('Boom!')
        },
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Boom!'))
  })
})

describe('middleware', () => {
  it('runs middleware in order from left to right', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let middlewareInvocations: string[] = []

    function one(_context: RequestContext, next: NextFunction) {
      middlewareInvocations.push('one')
      return next()
    }

    function two(_context: RequestContext, next: NextFunction) {
      middlewareInvocations.push('two')
      return next()
    }

    function three(_context: RequestContext, next: NextFunction) {
      middlewareInvocations.push('three')
      return next()
    }

    let router = createRouter(routes, {
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

    let router = createRouter(routes, {
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

    let router = createRouter(routes, {
      home: {
        use: [one, two],
        get() {
          return new Response('Home')
        },
      },
    })

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

    let router = createRouter(routes, {
      home: {
        use: [one],
        handler() {
          return new Response('Home')
        },
      },
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Middleware Boom!'))
  })

  it('throws error when middleware calls next() multiple times', async () => {
    let routes = createRoutes({
      home: '/',
    })

    async function badMiddleware(_context: RequestContext, next: NextFunction) {
      await next()
      await next() // This second call should throw
    }

    let router = createRouter(routes, {
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
})

describe('createHandlers()', () => {
  it('applies middleware to all route handlers', async () => {
    let routes = createRoutes({
      home: '/',
      post: '/posts/:id',
      posts: {
        comments: '/posts/:id/comments',
      },
    })

    let calledUrls: string[] = []

    function pushUrl({ url }: RequestContext) {
      calledUrls.push(url.toString())
    }

    let handlers = createHandlers(routes, [pushUrl], {
      home() {
        return new Response('Home')
      },
      post({ params }) {
        return new Response(`Post ${params.id}`)
      },
      posts: {
        comments({ params }) {
          return new Response(`Comments on post ${params.id}`)
        },
      },
    })

    let router = createRouter(routes, handlers)

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
      home: '/',
    })

    let currentUserKey = createStorageKey('')

    function auth({ storage }: RequestContext) {
      storage.set(currentUserKey, 'mj')
    }

    let router = createRouter(routes, {
      home: {
        use: [auth],
        get({ storage }) {
          let currentUser = storage.get(currentUserKey)
          return new Response(`Hello, ${currentUser}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, mj')
  })
})
