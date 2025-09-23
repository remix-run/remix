import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRoutes } from './route-schema.ts'
import { createRouter } from './router.ts'
import type { NextFunction } from './middleware.ts'
import type { RequestContext } from './request-context.ts'

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

    let router = createRouter(routes, {
      comments: {
        create: {
          method: 'POST',
          handler({ params }) {
            return new Response(`Created comment ${params.id}`)
          },
        },
      },
    })

    let response = await router.fetch('https://remix.run/post/1/comments', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Created comment 1')
  })

  it('handles a route declared with a shorthand method-specific handler', async () => {
    let routes = createRoutes({
      comments: '/post/:id/comments',
    })

    let router = createRouter(routes, {
      comments: {
        post({ params }) {
          return new Response(`Created comment ${params.id}`)
        },
      },
    })

    let response = await router.fetch('https://remix.run/post/1/comments', { method: 'POST' })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Created comment 1')
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

    function one(_context: RequestContext, next: NextFunction) {
      middlewareInvocations.push('one')
      return new Response('One')
    }

    function two(_context: RequestContext, next: NextFunction) {
      middlewareInvocations.push('two')
      return next()
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
