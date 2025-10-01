import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { RequestContext, runMiddleware } from './request-handler.ts'
import type { NextFunction } from './request-handler.ts'

function mockContext(
  input: string | URL | Request,
  params: Record<string, any> = {},
): RequestContext {
  if (input instanceof Request) {
    return new RequestContext(input, new URL(input.url), params)
  }

  let url = typeof input === 'string' ? new URL(input) : input
  return new RequestContext(new Request(url), url, params)
}

describe('runMiddleware', () => {
  it('runs middleware and returns a response', async () => {
    let middleware = [() => new Response('Hello, world!')]
    let ctx = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, ctx, handler)

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
    let ctx = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, ctx, handler)

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
    let ctx = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, ctx, handler)

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
    let ctx = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, ctx, handler)

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
    let ctx = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    await assert.rejects(async () => {
      await runMiddleware(middleware, ctx, handler)
    }, new Error('next() called multiple times'))
  })

  it('rejects when a handler throws an error', async () => {
    let middleware = [() => {}]
    let ctx = mockContext('https://remix.run')
    let handler = () => {
      throw new Error('Handler error!')
    }

    await assert.rejects(async () => {
      await runMiddleware(middleware, ctx, handler)
    }, new Error('Handler error!'))
  })

  it('rejects when a middleware throws an error', async () => {
    let middleware = [
      () => {
        throw new Error('Middleware error!')
      },
    ]
    let ctx = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    await assert.rejects(async () => {
      await runMiddleware(middleware, ctx, handler)
    }, new Error('Middleware error!'))
  })
})
