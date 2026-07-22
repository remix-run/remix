import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { memoryStore } from './store.ts'

describe('memoryStore', () => {
  it('increments a fixed-window bucket atomically', async () => {
    await withNow(1_000, async () => {
      let store = memoryStore()
      let increments = await Promise.all(
        Array.from({ length: 10 }, () =>
          store.increment({ key: 'client', name: 'api', window: 60_000 }),
        ),
      )

      assert.deepEqual(
        increments.map((entry) => entry.count),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      )
      assert.equal(increments.at(-1)?.resetAt, 61_000)
    })
  })

  it('isolates client keys, policy names, and window sizes', async () => {
    await withNow(1_000, async () => {
      let store = memoryStore()

      await store.increment({ key: 'one', name: 'api', window: 60_000 })
      let otherClient = await store.increment({ key: 'two', name: 'api', window: 60_000 })
      let otherPolicy = await store.increment({ key: 'one', name: 'login', window: 60_000 })
      let otherWindow = await store.increment({ key: 'one', name: 'api', window: 1_000 })

      assert.equal(otherClient.count, 1)
      assert.equal(otherPolicy.count, 1)
      assert.equal(otherWindow.count, 1)
      assert.equal(otherWindow.resetAt, 2_000)
    })
  })

  it('starts a new bucket after its window expires', async () => {
    let store = memoryStore()

    await withNow(1_000, async () => {
      await store.increment({ key: 'client', name: 'api', window: 1_000 })
      let second = await store.increment({ key: 'client', name: 'api', window: 1_000 })
      assert.equal(second.count, 2)
    })

    await withNow(2_000, async () => {
      let entry = await store.increment({ key: 'client', name: 'api', window: 1_000 })
      assert.deepEqual(entry, { count: 1, resetAt: 3_000 })
    })
  })

  it('retains active buckets while rotating inactive generations', async () => {
    let store = memoryStore()

    await withNow(1_000, () => store.increment({ key: 'client', name: 'api', window: 1_000 }))
    await withNow(1_500, () => store.increment({ key: 'client', name: 'api', window: 1_000 }))
    await withNow(2_100, async () => {
      let entry = await store.increment({ key: 'client', name: 'api', window: 1_000 })
      assert.deepEqual(entry, { count: 1, resetAt: 3_100 })
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
