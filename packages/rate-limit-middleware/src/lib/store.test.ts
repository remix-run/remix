import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { memoryStore } from './store.ts'

describe('memoryStore()', () => {
  it('increments counts in the current window', async () => {
    await withNow(1_000, async () => {
      let store = memoryStore()

      let first = await store.increment('client', 60_000)
      let second = await store.increment('client', 60_000)

      assert.deepEqual(first, {
        count: 1,
        resetAt: 61_000,
      })
      assert.deepEqual(second, {
        count: 2,
        resetAt: 61_000,
      })
    })
  })

  it('resets expired buckets', async () => {
    let store = memoryStore()

    await withNow(1_000, async () => {
      await store.increment('client', 1_000)
    })

    await withNow(2_000, async () => {
      let entry = await store.increment('client', 1_000)

      assert.deepEqual(entry, {
        count: 1,
        resetAt: 3_000,
      })
    })
  })

  it('deletes buckets with reset()', async () => {
    await withNow(1_000, async () => {
      let store = memoryStore()

      await store.increment('client', 60_000)
      await store.reset('client')

      let entry = await store.increment('client', 60_000)

      assert.deepEqual(entry, {
        count: 1,
        resetAt: 61_000,
      })
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
