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
      // Async work that is still pending when the abort happens
      await new Promise(() => {})
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

  it('allows middleware to catch and handle abort errors', async () => {
    let controller = new AbortController()
    let errorCaught = false

    let router = createRouter({
      middleware: [
        async (_, next) => {
          try {
            return await next()
          } catch (error) {
            if ((error as Error).name === 'AbortError') {
              errorCaught = true
            }
            throw error
          }
        },
      ],
    })

    let handlerStarted = Promise.withResolvers<void>()

    router.get('/', async () => {
      handlerStarted.resolve()
      // Async work that is still pending when the abort happens
      await new Promise(() => {})
      return new Response('Home')
    })

    let responsePromise = router.fetch('https://remix.run', { signal: controller.signal })

    // Abort while handler is running
    await handlerStarted.promise
    controller.abort()

    await assert.rejects(responsePromise, (error: any) => {
      assert.equal(error.name, 'AbortError')
      return true
    })

    // Middleware should have caught the error
    assert.equal(errorCaught, true)
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
          await new Promise(() => {})
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
})
