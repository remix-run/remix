import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from './router.ts'

function createStreamingResponse() {
  let cancelled = Promise.withResolvers<unknown>()
  let response = new Response(new ReadableStream({ cancel: cancelled.resolve }))
  return { response, cancelled: cancelled.promise }
}

describe('abort signal support', () => {
  it('throws AbortError when signal is already aborted', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    controller.abort()

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('throws AbortError when signal is aborted during request processing', async () => {
    let router = createRouter()
    let controller = new AbortController()

    router.get('/', async () => {
      // Abort while handler is running
      controller.abort()
      return new Response('Home')
    })

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('handles signal from Request object passed to fetch()', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    let request = new Request('https://remix.run', { signal: controller.signal })
    controller.abort()

    await assert.rejects(
      async () => {
        await router.fetch(request)
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('handles signal from init object', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    controller.abort()

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        assert.ok(error instanceof DOMException)
        return true
      },
    )
  })

  it('rejects next() with the abort reason once downstream work settles', async () => {
    let controller = new AbortController()
    let events: string[] = []

    let router = createRouter({
      middleware: [
        async (_, next) => {
          try {
            return await next()
          } catch (error) {
            events.push(`middleware caught ${(error as Error).name}`)
            throw error
          }
        },
      ],
    })

    let handlerStarted = Promise.withResolvers<void>()
    let finishHandler = Promise.withResolvers<void>()

    // This handler ignores the signal, so the router waits for it instead of racing it
    router.get('/', async () => {
      handlerStarted.resolve()
      await finishHandler.promise
      events.push('handler finished')
      return new Response('Home')
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })

    await handlerStarted.promise
    controller.abort()
    finishHandler.resolve()

    await assert.rejects(responsePromise, (error: any) => {
      assert.equal(error.name, 'AbortError')
      return true
    })
    assert.deepEqual(events, ['handler finished', 'middleware caught AbortError'])
  })

  it('propagates the rejection from work that observes the signal', async () => {
    let controller = new AbortController()
    let caught: unknown

    let router = createRouter({
      middleware: [
        async (_, next) => {
          try {
            return await next()
          } catch (error) {
            caught = error
            throw error
          }
        },
      ],
    })

    let handlerStarted = Promise.withResolvers<void>()

    router.get('/', async ({ request }) => {
      handlerStarted.resolve()
      // Stands in for work that accepts a signal, such as fetch() or a database query
      await new Promise((_, reject) => {
        request.signal.addEventListener('abort', () => reject(request.signal.reason))
      })
      return new Response('Home')
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })

    await handlerStarted.promise
    let reason = new Error('Client disconnected')
    controller.abort(reason)

    await assert.rejects(responsePromise, reason)
    assert.equal(caught, reason)
  })

  it('cancels the body of a response that resolves after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let cancelled = Promise.withResolvers<unknown>()
    let handlerStarted = Promise.withResolvers<void>()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter()
    router.get('/', async () => {
      handlerStarted.resolve()
      await finishHandler.promise
      return new Response(new ReadableStream({ cancel: cancelled.resolve }))
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })

    await handlerStarted.promise
    controller.abort(reason)
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
    assert.equal(await cancelled.promise, reason)
  })

  it('rejects with the abort reason when downstream work fails after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let handlerStarted = Promise.withResolvers<void>()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter()
    router.get('/', async () => {
      handlerStarted.resolve()
      await finishHandler.promise
      throw new Error('Query cancelled')
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })

    await handlerStarted.promise
    controller.abort(reason)
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
  })

  it('rejects with the abort reason when middleware fails after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')

    let router = createRouter({
      middleware: [
        async (_, next) => {
          try {
            return await next()
          } catch (error) {
            throw new Error('Wrapped', { cause: error })
          }
        },
      ],
    })
    router.get('/', async () => {
      controller.abort(reason)
      throw new Error('Query cancelled')
    })

    await assert.rejects(router.fetch('https://remix.run', { signal: controller.signal }), reason)
  })

  it('cancels a late response from a handler under router middleware', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter({ middleware: [async (_, next) => next()] })
    router.get('/', async () => {
      controller.abort(reason)
      await finishHandler.promise
      return response
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
    assert.equal(await cancelled, reason)
  })

  it('cancels a response that async middleware returns after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()

    let router = createRouter({
      middleware: [
        async () => {
          controller.abort(reason)
          return response
        },
      ],
    })
    router.get('/', () => new Response('Home'))

    await assert.rejects(router.fetch('https://remix.run', { signal: controller.signal }), reason)
    assert.equal(await cancelled, reason)
  })

  it('cancels the downstream response when middleware without its own response finishes after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()

    let router = createRouter({
      middleware: [
        // @ts-expect-error Middleware that awaits next() without returning its response
        async (_, next) => {
          await next()
          controller.abort(reason)
        },
      ],
    })
    router.get('/', () => response)

    await assert.rejects(router.fetch('https://remix.run', { signal: controller.signal }), reason)
    assert.equal(await cancelled, reason)
  })

  it('cancels the downstream response when middleware passes it through after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()

    let router = createRouter({
      middleware: [
        (_, next) => {
          let downstream = next()
          controller.abort(reason)
          return downstream
        },
      ],
    })
    router.get('/', () => response)

    await assert.rejects(router.fetch('https://remix.run', { signal: controller.signal }), reason)
    assert.equal(await cancelled, reason)
  })

  it('rejects with the abort reason when a handler under passthrough middleware fails after the request aborted', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let handlerStarted = Promise.withResolvers<void>()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter({ middleware: [(_, next) => next()] })
    router.get('/', async () => {
      handlerStarted.resolve()
      await finishHandler.promise
      throw new Error('Query cancelled')
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })

    await handlerStarted.promise
    controller.abort(reason)
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
  })

  it('rejects with the abort reason when work throws synchronously after aborting', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')

    let router = createRouter({ middleware: [(_, next) => next()] })
    router.get('/direct', () => {
      controller.abort(reason)
      throw new Error('Handler failed')
    })

    await assert.rejects(
      router.fetch('https://remix.run/direct', { signal: controller.signal }),
      reason,
    )

    let directController = new AbortController()
    let directReason = new Error('Client disconnected')
    let directRouter = createRouter()
    directRouter.get('/', () => {
      directController.abort(directReason)
      throw new Error('Handler failed')
    })

    await assert.rejects(
      directRouter.fetch('https://remix.run', { signal: directController.signal }),
      directReason,
    )
  })

  it('waits for downstream work when middleware passes it through after an abort', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()
    let finishHandler = Promise.withResolvers<void>()
    let events: string[] = []

    let router = createRouter({
      middleware: [
        (_, next) => {
          let downstream = next()
          controller.abort(reason)
          return downstream
        },
      ],
    })
    router.get('/', async () => {
      await finishHandler.promise
      events.push('handler finished')
      return response
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })
    responsePromise.catch(() => events.push('router rejected'))
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
    assert.equal(await cancelled, reason)
    assert.deepEqual(events, ['handler finished', 'router rejected'])
  })

  it('cancels the downstream response when sync middleware returns nothing after an abort', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter({
      middleware: [
        // @ts-expect-error Middleware that calls next() without returning its response
        (_, next) => {
          next()
          controller.abort(reason)
        },
      ],
    })
    router.get('/', async () => {
      await finishHandler.promise
      return response
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
    assert.equal(await cancelled, reason)
  })

  it('cancels a late response that passes through route middleware', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter()
    router.get('/', {
      middleware: [async (_, next) => next()],
      async handler() {
        controller.abort(reason)
        await finishHandler.promise
        return response
      },
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
    assert.equal(await cancelled, reason)
  })

  it('does not run route middleware or the handler after router middleware aborts', async () => {
    let controller = new AbortController()
    let routeMiddlewareCalled = false
    let handlerCalled = false

    let router = createRouter({
      middleware: [
        (_, next) => {
          controller.abort()
          return next()
        },
      ],
    })
    router.get('/', {
      middleware: [
        (_, next) => {
          routeMiddlewareCalled = true
          return next()
        },
      ],
      handler() {
        handlerCalled = true
        return new Response('Home')
      },
    })

    await assert.rejects(router.fetch('https://remix.run', { signal: controller.signal }), {
      name: 'AbortError',
    })
    assert.equal(routeMiddlewareCalled, false)
    assert.equal(handlerCalled, false)
  })

  it('cancels the GET response body when a HEAD request aborts before the handler finishes', async () => {
    let controller = new AbortController()
    let reason = new Error('Client disconnected')
    let { response, cancelled } = createStreamingResponse()
    let finishHandler = Promise.withResolvers<void>()

    let router = createRouter()
    router.get('/', async () => {
      controller.abort(reason)
      await finishHandler.promise
      return response
    })

    let responsePromise = router.fetch('https://remix.run', {
      method: 'HEAD',
      signal: controller.signal,
    })
    finishHandler.resolve()

    await assert.rejects(responsePromise, reason)
    assert.equal(await cancelled, reason)
  })

  it('completes successfully if not aborted', async () => {
    let controller = new AbortController()
    let router = createRouter()

    router.get('/', () => new Response('Home'))

    let response = await router.fetch('https://remix.run', { signal: controller.signal })

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Home')
  })

  it('throws AbortError when aborted before middleware completes', async () => {
    let controller = new AbortController()

    let router = createRouter({
      middleware: [
        async () => {
          controller.abort()
        },
      ] as any,
    })

    router.get('/', () => new Response('Home'))

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )
  })

  it('does not call downstream middleware or handler when aborted in upstream middleware', async () => {
    let controller = new AbortController()
    let downstreamMiddlewareCalled = false
    let handlerCalled = false

    let router = createRouter({
      middleware: [
        // Upstream middleware that aborts and then tries to continue the chain
        (_, next) => {
          controller.abort()
          return next()
        },
        // Downstream middleware that should NOT be called
        (_, next) => {
          downstreamMiddlewareCalled = true
          return next()
        },
      ],
    })

    // Handler that should NOT be called
    router.get('/', () => {
      handlerCalled = true
      return new Response('Home')
    })

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )

    assert.equal(downstreamMiddlewareCalled, false)
    assert.equal(handlerCalled, false)
  })

  it('rejects and cancels the response body when a sync handler aborts before returning', async () => {
    let controller = new AbortController()
    let router = createRouter()
    let reason = new Error('Sync abort')
    let cancelled = Promise.withResolvers<unknown>()

    router.get('/', () => {
      controller.abort(reason)
      return new Response(new ReadableStream({ cancel: cancelled.resolve }))
    })

    await assert.rejects(router.fetch('https://remix.run', { signal: controller.signal }), reason)
    assert.equal(await cancelled.promise, reason)
  })

  it('returns a rejected promise rather than throwing synchronously when already aborted', async () => {
    let router = createRouter()
    router.get('/', () => new Response('Home'))

    let controller = new AbortController()
    let reason = new Error('Pre-aborted')
    controller.abort(reason)

    let promise = router.fetch('https://remix.run', { signal: controller.signal })
    await assert.rejects(promise, reason)
  })

  it('strips HEAD fallback body when async router middleware sets context.method to HEAD after awaiting', async () => {
    let router = createRouter({
      middleware: [
        async (context, next) => {
          await Promise.resolve()
          context.method = 'HEAD'
          return next()
        },
      ],
    })

    router.get('/file', () => new Response('body content', { headers: { 'X-File': '1' } }))

    let response = await router.fetch('https://remix.run/file', { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('X-File'), '1')
    assert.equal(response.body, null)
  })

  it('does not add abort listeners to the request signal', async () => {
    let directRouter = createRouter()
    directRouter.get('/direct', async () => new Response('direct'))
    let middlewareRouter = createRouter({
      middleware: [async (_, next) => next(), async (_, next) => next()],
    })
    middlewareRouter.get('/sync', () => new Response('sync'))
    middlewareRouter.get('/async', {
      middleware: [async (_, next) => next()],
      handler: async () => new Response('async'),
    })

    for (let [router, path] of [
      [directRouter, '/direct'],
      [middlewareRouter, '/sync'],
      [middlewareRouter, '/async'],
    ] as const) {
      let controller = new AbortController()
      let request = new Request(`https://remix.run${path}`, { signal: controller.signal })
      let listeners = 0
      let addEventListener = request.signal.addEventListener.bind(request.signal)
      request.signal.addEventListener = (...args: Parameters<typeof addEventListener>) => {
        listeners++
        return addEventListener(...args)
      }

      let response = await router.fetch(request)
      assert.equal(response.status, 200)
      assert.equal(listeners, 0)
    }
  })
})
