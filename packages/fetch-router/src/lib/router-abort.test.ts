import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from './router.ts'

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

  it('rejects as soon as downstream work observes the signal', async () => {
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
    let router = createRouter({
      middleware: [async (_, next) => next(), async (_, next) => next()],
    })
    router.get('/sync', () => new Response('sync'))
    router.get('/async', {
      middleware: [async (_, next) => next()],
      handler: async () => new Response('async'),
    })

    for (let path of ['/sync', '/async']) {
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
