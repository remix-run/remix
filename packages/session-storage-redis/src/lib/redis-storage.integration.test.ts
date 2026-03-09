import * as assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'

import { createClient } from 'redis'

import { createRedisSessionStorage } from './redis-storage.ts'

let redisUrl = process.env.SESSION_REDIS_URL
let integrationEnabled = process.env.SESSION_REDIS_INTEGRATION === '1' && redisUrl != null

describe('redis session storage integration', { skip: !integrationEnabled }, () => {
  let client: ReturnType<typeof createClient>

  before(async () => {
    client = createClient({ url: redisUrl })
    await client.connect()
  })

  beforeEach(async () => {
    await client.flushDb()
  })

  after(async () => {
    await client.quit()
  })

  it('does not use unknown session IDs by default', async () => {
    let storage = createRedisSessionStorage(client)
    let session = await storage.read('unknown')

    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown session IDs if enabled', async () => {
    let storage = createRedisSessionStorage(client, { useUnknownIds: true })
    let session = await storage.read('unknown')

    assert.equal(session.id, 'unknown')
  })

  it('persists session data across requests', async () => {
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
    let storage = createRedisSessionStorage(client)

    let session = await storage.read(null)
    let cookie = await storage.save(session)

    assert.equal(session.dirty, false)
    assert.equal(cookie, null)
  })

  it('makes flash data available only on the next request', async () => {
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

  it('deletes old session data when the id is regenerated and the deleteOldSession option is true', async () => {
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

  it('sets key expiration when ttl is configured', async () => {
    let storage = createRedisSessionStorage(client, { ttl: 300, keyPrefix: 'session:' })

    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)

    assert.equal(cookie, session.id)

    let ttl = await client.ttl('session:' + session.id)
    assert.ok(ttl > 0)
  })
})
