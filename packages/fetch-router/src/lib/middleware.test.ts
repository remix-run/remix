import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

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

  it('uses the downstream response when middleware calls next()', async () => {
    let requestLog: string[] = []

    let middleware = [
      async (_: any, next: NextFunction) => {
        requestLog.push('one')
        await next()
      },
      async (_: any, next: NextFunction) => {
        requestLog.push('two')
        await next()
      },
    ] as any
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    let response = await runMiddleware(middleware, context, handler)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello, world!')
    assert.deepEqual(requestLog, ['one', 'two'])
  })

  it('rejects when a middleware neither returns a response nor calls next()', async () => {
    let middleware = [
      () => {
        // no response, no next()
      },
    ] as any
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    await assert.rejects(async () => {
      await runMiddleware(middleware, context, handler)
    }, new Error('Middleware must return a Response or call next()'))
  })

  it('rejects when a middleware calls next() multiple times', async () => {
    let middleware = [
      async (_: any, next: NextFunction) => {
        await next()
        await next() // error
      },
    ] as any
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Hello, world!')

    await assert.rejects(async () => {
      await runMiddleware(middleware, context, handler)
    }, new Error('next() called multiple times'))
  })

  it('rejects when a handler throws an error', async () => {
    let middleware = [(_: any, next: NextFunction) => next()]
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

  it('does not leak an unhandled rejection when middleware calls next() and short-circuits', async () => {
    let middleware = [
      (_: any, next: NextFunction) => {
        void next()
        return new Response('Short-circuit')
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = () => {
      throw new Error('Downstream boom')
    }

    let response = await runMiddleware(middleware, context, handler)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Short-circuit')
  })

  it('does not leak an unhandled rejection when async middleware calls next() and returns another response after awaiting', async () => {
    let middleware = [
      async (_: any, next: NextFunction) => {
        void next()
        await Promise.resolve()
        return new Response('Async short-circuit')
      },
    ]
    let context = mockContext('https://remix.run')
    let handler = async () => {
      throw new Error('Async downstream boom')
    }

    let response = await runMiddleware(middleware, context, handler)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Async short-circuit')
  })

  it('does not overwrite the first next() promise when a second next() call is caught', async () => {
    let middleware = [
      async (_: any, next: NextFunction) => {
        await next()
        try {
          await next()
        } catch {
          // ignore duplicate next() error
        }
      },
    ] as any
    let context = mockContext('https://remix.run')
    let handler = () => new Response('Downstream OK')

    let response = await runMiddleware(middleware, context, handler)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Downstream OK')
  })
})
