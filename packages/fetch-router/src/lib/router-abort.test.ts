import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRouter } from './router.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
      // Simulate some async work
      await sleep(10)
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

    router.get('/', async () => {
      // Simulate some async work that gets aborted
      await sleep(50)
      return new Response('Home')
    })

    // Abort while handler is running
    setTimeout(() => controller.abort(), 10)

    await assert.rejects(
      async () => {
        await router.fetch('https://remix.run', { signal: controller.signal })
      },
      (error: any) => {
        assert.equal(error.name, 'AbortError')
        return true
      },
    )

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
          await sleep(10)
        },
      ],
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
        // Upstream middleware that aborts
        async () => {
          controller.abort()
          await sleep(10)
        },
        // Downstream middleware that should NOT be called
        async () => {
          downstreamMiddlewareCalled = true
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
