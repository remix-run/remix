import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createRedisSessionStorage, type RedisSessionStorageClient } from './redis-storage.ts'

function createMapRedisClient() {
  let values = new Map<string, string>()

  let client: RedisSessionStorageClient = {
    async get(key) {
      return values.get(key) ?? null
    },
    async set(key, value) {
      values.set(key, value)
    },
    async del(key) {
      values.delete(key)
    },
  }

  return { client, values }
}

describe('redis session storage', () => {
  it('does not use unknown session IDs by default', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)
    let session = await storage.read('unknown')

    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown session IDs if enabled', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client, { useUnknownIds: true })
    let session = await storage.read('unknown')

    assert.equal(session.id, 'unknown')
  })

  it('persists session data across requests', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', Number(session.get('count') ?? 0) + 1)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    let response1 = await requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requestIndex(response1.cookie)
    assert.equal(response2.session.get('count'), 2)

    let response3 = await requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 3)
  })

  it('clears session data when the session is destroyed', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', Number(session.get('count') ?? 0) + 1)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    async function requestDestroy(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.destroy()

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    let response1 = await requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requestIndex(response1.cookie)
    assert.equal(response2.session.get('count'), 2)

    let response3 = await requestDestroy(response2.cookie)
    assert.ok(response3.session.destroyed)

    let response4 = await requestIndex(response3.cookie)
    assert.equal(response4.session.get('count'), 1)
    assert.notEqual(response4.session.id, response3.session.id)
  })

  it('does not set a cookie when session data is not changed', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    let response = await requestIndex()
    assert.equal(response.session.dirty, false)
    assert.equal(response.cookie, null)
  })

  it('makes flash data available only on the next request', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    async function requestFlash(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.flash('message', 'success!')

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    let response1 = await requestIndex()
    assert.equal(response1.session.get('message'), undefined)

    let response2 = await requestFlash(response1.cookie)
    assert.equal(response2.session.get('message'), undefined)

    let response3 = await requestIndex(response2.cookie)
    assert.equal(response3.session.get('message'), 'success!')

    let response4 = await requestIndex(response3.cookie)
    assert.equal(response4.session.get('message'), undefined)
  })

  it('leaves old session data in storage by default when the id is regenerated', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', Number(session.get('count') ?? 0) + 1)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    async function requestLogin(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.regenerateId()

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    let response1 = await requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requestLogin(response1.cookie)
    assert.notEqual(response2.session.id, response1.session.id)

    let response3 = await requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 2)

    let response4 = await requestIndex(response1.cookie)
    assert.equal(response4.session.get('count'), 2, 'old session data should still be in storage')
  })

  it('deletes old session data when the id is regenerated and the deleteOldSession option is true', async () => {
    let { client } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', Number(session.get('count') ?? 0) + 1)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    async function requestLoginAndDeleteOldSession(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.regenerateId(true)

      return {
        cookie: await storage.save(session),
        session,
      }
    }

    let response1 = await requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requestLoginAndDeleteOldSession(response1.cookie)
    assert.notEqual(response2.session.id, response1.session.id)

    let response3 = await requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 2)

    let response4 = await requestIndex(response1.cookie)
    assert.equal(response4.session.get('count'), 1, 'old session data should be deleted')
  })

  it('uses keyPrefix for redis keys', async () => {
    let { client, values } = createMapRedisClient()
    let storage = createRedisSessionStorage(client, { keyPrefix: 'my-app:' })

    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)

    assert.equal(cookie, session.id)
    assert.ok(values.has('my-app:' + session.id))
  })

  it('uses setEx when ttl is configured and the client supports setEx', async () => {
    let setCallCount = 0
    let setExArgs: [string, number, string] | undefined

    let client: RedisSessionStorageClient = {
      async get() {
        return null
      },
      async set() {
        setCallCount += 1
      },
      async del() {},
      async setEx(key, ttlSeconds, value) {
        setExArgs = [key, ttlSeconds, value]
      },
    }

    let storage = createRedisSessionStorage(client, { ttl: 60.9, keyPrefix: 'session:' })
    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)

    assert.equal(cookie, session.id)
    assert.equal(setCallCount, 0)
    assert.deepEqual(setExArgs, ['session:' + session.id, 60, JSON.stringify(session.data)])
  })

  it('uses expire when ttl is configured and setEx is unavailable', async () => {
    let setCalls: Array<[string, string]> = []
    let expireCalls: Array<[string, number]> = []

    let client: RedisSessionStorageClient = {
      async get() {
        return null
      },
      async set(key, value) {
        setCalls.push([key, value])
      },
      async del() {},
      async expire(key, ttlSeconds) {
        expireCalls.push([key, ttlSeconds])
      },
    }

    let storage = createRedisSessionStorage(client, { ttl: 180 })
    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)

    assert.equal(cookie, session.id)
    assert.deepEqual(setCalls, [['session:' + session.id, JSON.stringify(session.data)]])
    assert.deepEqual(expireCalls, [['session:' + session.id, 180]])
  })

  it('throws when ttl is configured and the client does not support expiration', () => {
    let client: RedisSessionStorageClient = {
      async get() {
        return null
      },
      async set() {},
      async del() {},
    }

    assert.throws(
      () => createRedisSessionStorage(client, { ttl: 60 }),
      new Error('Redis client must implement setEx() or expire() when ttl is configured'),
    )
  })

  it('throws if session data in redis is invalid JSON', async () => {
    let { client, values } = createMapRedisClient()
    let storage = createRedisSessionStorage(client)

    values.set('session:bad', '{invalid-json')

    await assert.rejects(
      async () => {
        await storage.read('bad')
      },
      {
        name: 'SyntaxError',
      },
    )
  })
})
