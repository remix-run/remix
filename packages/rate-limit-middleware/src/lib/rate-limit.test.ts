import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createRouter } from '@remix-run/fetch-router'

import { rateLimit } from './rate-limit.ts'
import { memoryStore, type RateLimitStore } from './store.ts'

describe('rateLimit', () => {
  it('passes requests through up to the limit and adds named policy fields', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 2,
          name: 'api',
          store: memoryStore(),
          window: 60_000,
        }),
      ],
    })
    router.get('/', () => new Response('ok', { headers: { 'X-Test': 'preserved' } }))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    assert.equal(response.headers.get('X-Test'), 'preserved')
    assert.equal(response.headers.get('Ratelimit'), '"api";r=1;t=60')
    assert.equal(response.headers.get('Ratelimit-Policy'), '"api";q=2;w=60')
    assert.equal(response.headers.get('Retry-After'), null)
  })

  it('short-circuits request limit plus one with status 429', async () => {
    let handled = 0
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 2,
          name: 'api',
          store: memoryStore(),
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
    assert.equal(third.headers.get('Ratelimit'), '"api";r=0;t=60')
    assert.equal(third.headers.get('Retry-After'), '60')
    assert.equal(handled, 2)
  })

  it('keeps client buckets independent', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: (context) => context.headers.get('X-Client-Id') ?? 'anonymous',
          limit: 1,
          name: 'api',
          store: memoryStore(),
          window: 60_000,
        }),
      ],
    })
    router.get('/', () => new Response('ok'))

    let first = await router.fetch('https://remix.run/', {
      headers: { 'X-Client-Id': 'one' },
    })
    let second = await router.fetch('https://remix.run/', {
      headers: { 'X-Client-Id': 'two' },
    })
    let third = await router.fetch('https://remix.run/', {
      headers: { 'X-Client-Id': 'one' },
    })

    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(third.status, 429)
  })

  it('composes named policies through one shared store', async () => {
    let store = memoryStore()
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 10,
          name: 'global',
          store,
          window: 60_000,
        }),
        rateLimit({
          key: () => 'client',
          limit: 2,
          name: 'route',
          store,
          window: 10_000,
        }),
      ],
    })
    router.get('/', () => new Response('ok'))

    let response = await router.fetch('https://remix.run/')

    assert.equal(response.headers.get('Ratelimit'), '"route";r=1;t=10, "global";r=9;t=60')
    assert.equal(response.headers.get('Ratelimit-Policy'), '"route";q=2;w=10, "global";q=10;w=60')
  })

  it('normalizes custom rejection responses while preserving their body and headers', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          name: 'api',
          onLimitExceeded(_context, state) {
            return Response.json(
              { error: 'slow_down', policy: state.name },
              { headers: { 'X-Custom': 'yes' } },
            )
          },
          store: memoryStore(),
          window: 60_000,
        }),
      ],
    })
    router.get('/', () => new Response('ok'))

    await router.fetch('https://remix.run/')
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 429)
    assert.equal(response.headers.get('Content-Type'), 'application/json')
    assert.equal(response.headers.get('X-Custom'), 'yes')
    assert.deepEqual(await response.json(), { error: 'slow_down', policy: 'api' })
  })

  it('starts a new request window after the previous window expires', async () => {
    let router = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          name: 'api',
          store: memoryStore(),
          window: 1_000,
        }),
      ],
    })
    router.get('/', () => new Response('ok'))

    await withNow(1_000, async () => {
      assert.equal((await router.fetch('https://remix.run/')).status, 200)
      assert.equal((await router.fetch('https://remix.run/')).status, 429)
    })
    await withNow(2_000, async () => {
      assert.equal((await router.fetch('https://remix.run/')).status, 200)
    })
  })

  it('rejects invalid configuration at startup', () => {
    let store = memoryStore()

    assert.throws(
      () => rateLimit({ key: () => 'client', limit: 1, name: 'not valid', store, window: 1_000 }),
      /name/,
    )
    assert.throws(
      () => rateLimit({ key: () => 'client', limit: 0, name: 'api', store, window: 1_000 }),
      /limit/,
    )
    assert.throws(
      () => rateLimit({ key: () => 'client', limit: 1, name: 'api', store, window: 0 }),
      /window/,
    )
  })

  it('rejects empty or excessively long client keys', async () => {
    let emptyKeyRouter = createRouter({
      middleware: [
        rateLimit({
          key: () => '',
          limit: 1,
          name: 'api',
          store: memoryStore(),
          window: 1_000,
        }),
      ],
    })
    let longKeyRouter = createRouter({
      middleware: [
        rateLimit({
          key: () => 'x'.repeat(1_025),
          limit: 1,
          name: 'api',
          store: memoryStore(),
          window: 1_000,
        }),
      ],
    })

    await assert.rejects(emptyKeyRouter.fetch('https://remix.run/'), /key/)
    await assert.rejects(longKeyRouter.fetch('https://remix.run/'), /key/)
  })

  it('validates store output and propagates store failures', async () => {
    let invalidStore: RateLimitStore = {
      async increment() {
        return { count: 0, resetAt: 1_000 }
      },
    }
    let failedStore: RateLimitStore = {
      async increment() {
        throw new Error('Store unavailable')
      },
    }
    let invalidStoreRouter = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          name: 'api',
          store: invalidStore,
          window: 1_000,
        }),
      ],
    })
    let failedStoreRouter = createRouter({
      middleware: [
        rateLimit({
          key: () => 'client',
          limit: 1,
          name: 'api',
          store: failedStore,
          window: 1_000,
        }),
      ],
    })

    await assert.rejects(invalidStoreRouter.fetch('https://remix.run/'), /count/)
    await assert.rejects(failedStoreRouter.fetch('https://remix.run/'), /Store unavailable/)
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
