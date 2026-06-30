import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from '@remix-run/fetch-router'

import { RateLimit, rateLimit } from './rate-limit.ts'
import { memoryStore } from './store.ts'

describe('rateLimit()', () => {
  it('passes through under-limit requests and adds standard headers', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 2,
          window: 60_000,
        }),
      ],
    })

    router.get('/', (context) => {
      let state = context.get(RateLimit)

      assert.equal(context.rateLimit, state)
      assert.equal(state?.remaining, 1)

      return new Response('ok')
    })

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    assert.equal(response.headers.get('RateLimit'), 'limit=2, remaining=1, reset=60')
    assert.equal(response.headers.get('RateLimit-Policy'), '2;w=60')
    assert.equal(response.headers.get('Retry-After'), null)
  })

  it('returns 429 with Retry-After when the limit is exceeded', async () => {
    let handled = 0
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 2,
          window: 60_000,
        }),
      ],
    })

    router.get('/', () => {
      handled += 1
      return new Response('ok')
    })

    let first = await router.fetch('https://remix.run/')
    let second = await router.fetch('https://remix.run/')
    let third = await router.fetch('https://remix.run/')

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(third.status, 429)
    assert.equal(await third.text(), 'Too Many Requests')
    assert.equal(third.headers.get('RateLimit'), 'limit=2, remaining=0, reset=60')
    assert.equal(third.headers.get('RateLimit-Policy'), '2;w=60')
    assert.equal(third.headers.get('Retry-After'), '60')
    assert.equal(handled, 2)
  })

  it('uses custom keys independently', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: (context) => context.headers.get('Authorization') ?? 'anonymous',
          limit: 1,
          window: 60_000,
        }),
      ],
    })

    router.get('/', () => new Response('ok'))

    let first = await router.fetch('https://remix.run/', {
      headers: { Authorization: 'Bearer one' },
    })
    let second = await router.fetch('https://remix.run/', {
      headers: { Authorization: 'Bearer two' },
    })
    let third = await router.fetch('https://remix.run/', {
      headers: { Authorization: 'Bearer one' },
    })

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(third.status, 429)
  })

  it('uses custom stores', async () => {
    let counts = new Map<string, number>()
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          store: {
            async increment(key, window) {
              let count = (counts.get(key) ?? 0) + 1
              counts.set(key, count)

              return {
                count,
                resetAt: Date.now() + window,
              }
            },
            async reset(key) {
              counts.delete(key)
            },
          },
          window: 60_000,
        }),
      ],
    })

    router.get('/', () => new Response('ok'))

    let first = await router.fetch('https://remix.run/')
    let second = await router.fetch('https://remix.run/')

    assert.equal(first.status, 200)
    assert.equal(second.status, 429)
  })

  it('uses custom over-limit responses after setting request context', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          onLimitExceeded(context, state) {
            assert.equal(context.get(RateLimit), state)
            assert.equal(state.exceeded, true)

            return Response.json({ error: 'slow down' })
          },
          window: 60_000,
        }),
      ],
    })

    router.get('/', () => new Response('ok'))

    await router.fetch('https://remix.run/')
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    assert.equal(response.headers.get('Retry-After'), '60')
    assert.deepEqual(await response.json(), { error: 'slow down' })
  })

  it('resets counts after the window expires', async () => {
    let store = memoryStore()
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          store,
          window: 1_000,
        }),
      ],
    })

    router.get('/', () => new Response('ok'))

    await withNow(1_000, async () => {
      let first = await router.fetch('https://remix.run/')
      let second = await router.fetch('https://remix.run/')

      assert.equal(first.status, 200)
      assert.equal(second.status, 429)
    })

    await withNow(2_000, async () => {
      let response = await router.fetch('https://remix.run/')

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('RateLimit'), 'limit=1, remaining=0, reset=1')
    })
  })
})

async function withNow<result>(now: number, callback: () => Promise<result>): Promise<result> {
  let originalNow = Date.now

  Date.now = () => now

  try {
    return await callback()
  } finally {
    Date.now = originalNow
  }
}
