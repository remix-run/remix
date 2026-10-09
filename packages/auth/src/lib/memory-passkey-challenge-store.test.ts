import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { RequestContext } from '@remix-run/fetch-router'

import { createMemoryPasskeyChallengeStore } from './memory-passkey-challenge-store.ts'

const context = {} as RequestContext

describe('createMemoryPasskeyChallengeStore()', () => {
  it('consumes a saved challenge exactly once', async () => {
    let store = createMemoryPasskeyChallengeStore()
    await store.save('challenge-1', new Date(Date.now() + 60_000), context)

    assert.equal(await store.consume('challenge-1', context), true)
    assert.equal(await store.consume('challenge-1', context), false)
  })

  it('does not consume unknown challenges', async () => {
    let store = createMemoryPasskeyChallengeStore()

    assert.equal(await store.consume('missing', context), false)
  })

  it('does not consume expired challenges', async (t) => {
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    let store = createMemoryPasskeyChallengeStore()
    await store.save('challenge-1', new Date(now + 1_000), context)

    now += 1_000

    assert.equal(await store.consume('challenge-1', context), false)
  })

  it('prunes expired challenges when saving new ones', async (t) => {
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    let store = createMemoryPasskeyChallengeStore()
    await store.save('challenge-1', new Date(now + 1_000), context)

    now += 1_000
    await store.save('challenge-2', new Date(now + 1_000), context)
    now -= 1_000

    assert.equal(await store.consume('challenge-1', context), false)
    assert.equal(await store.consume('challenge-2', context), true)
  })

  it('drops the oldest challenges when it is full', async () => {
    let store = createMemoryPasskeyChallengeStore()
    let expiresAt = new Date(Date.now() + 60_000)
    for (let index = 0; index <= 10_000; index++) {
      await store.save(`challenge-${index}`, expiresAt, context)
    }

    assert.equal(await store.consume('challenge-0', context), false)
    assert.equal(await store.consume('challenge-1', context), true)
    assert.equal(await store.consume('challenge-10000', context), true)
  })
})
