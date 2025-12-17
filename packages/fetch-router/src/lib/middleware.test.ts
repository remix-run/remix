import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runMiddleware } from './middleware.ts'
import type { NextFunction } from './middleware.ts'
import { RequestContext } from './request-context.ts'

function mockContext(input: string | Request, params: Record<string, any> = {}): RequestContext {
  let context =
    input instanceof Request ? new RequestContext(input) : new RequestContext(new Request(input))
  context.params = params
  return context
}

describe('runMiddleware', () => {
  it('runs middleware and returns a response', async () => {
    let middleware = [() => new Response('Hello, world!')]
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, context, handler)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, world!')
  })

  it('runs middleware in order from left to right', async () => {
    let requestLog: string[] = []

    let middleware = [
      (_: any, next: NextFunction) => {
        requestLog.push('one')
        return next()
      },
      (_: any, next: NextFunction) => {
        requestLog.push('two')
        return next()
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, context, handler)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, world!')
    assert.deepEqual(requestLog, ['one', 'two'])
  })

  it('short-circuits the chain when a middleware returns a response', async () => {
    let requestLog: string[] = []

    let middleware = [
      () => {
        requestLog.push('one')
        return new Response('Hello, middleware!')
      },
      (_: any, next: NextFunction) => {
        requestLog.push('two') // we never get here
        return next()
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, context, handler)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, middleware!')

    assert.deepEqual(requestLog, ['one'])
  })

  it('invokes downstream automatically when a middleware does not call next()', async () => {
    let requestLog: string[] = []

    let middleware = [
      () => {
        requestLog.push('one')
        // no next()
      },
      () => {
        requestLog.push('two')
        // no next()
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, context, handler)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, world!')
    assert.deepEqual(requestLog, ['one', 'two'])
  })

  it('rejects when a middleware calls next() multiple times', async () => {
    let middleware = [
      async (_: any, next: NextFunction) => {
        await next()
        await next() // error
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    await assert.rejects(async () => {
      await runMiddleware(middleware, context, handler)
    }, new Error('next() called multiple times'))
  })

  it('rejects when a handler throws an error', async () => {
    let middleware = [() => {}]
    let context = mockContext('https://remix.run')
    let handler = () => {
      throw new Error('Handler error!')
    }

    await assert.rejects(async () => {
      await runMiddleware(middleware, context, handler)
    }, new Error('Handler error!'))
  })

  it('rejects when a middleware throws an error', async () => {
    let middleware = [
      () => {
        throw new Error('Middleware error!')
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    await assert.rejects(async () => {
      await runMiddleware(middleware, context, handler)
    }, new Error('Middleware error!'))
  })
})
