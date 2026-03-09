import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { SessionStorage } from '@remix-run/session'
import {
  createMemcacheSessionStorage,
  type MemcacheSessionStorageOptions,
} from './memcache-storage.ts'

let integrationEnabled =
  process.env.SESSION_MEMCACHE_INTEGRATION === '1' &&
  typeof process.env.SESSION_MEMCACHE_SERVER === 'string'

describe('memcache session storage integration', () => {
  it('does not use unknown session IDs by default', { skip: !integrationEnabled }, async () => {
    let storage = createIntegrationStorage()
    let session = await storage.read('unknown')
    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown session IDs if enabled', { skip: !integrationEnabled }, async () => {
    let storage = createIntegrationStorage({ useUnknownIds: true })
    let session = await storage.read('unknown')
    assert.equal(session.id, 'unknown')
  })

  it('persists session data across requests', { skip: !integrationEnabled }, async () => {
    let storage = createIntegrationStorage()
    let requests = createRequestHelpers(storage)

    let response1 = await requests.requestIndex()
    assert.equal(response1.session.get('count'), 1)

    let response2 = await requests.requestIndex(response1.cookie)
    assert.equal(response2.session.get('count'), 2)

    let response3 = await requests.requestIndex(response2.cookie)
    assert.equal(response3.session.get('count'), 3)
  })

  it(
    'clears session data when the session is destroyed',
    { skip: !integrationEnabled },
    async () => {
      let storage = createIntegrationStorage()
      let requests = createRequestHelpers(storage)

      let response1 = await requests.requestIndex()
      assert.equal(response1.session.get('count'), 1)

      let response2 = await requests.requestIndex(response1.cookie)
      assert.equal(response2.session.get('count'), 2)

      let response3 = await requests.requestDestroy(response2.cookie)
      assert.ok(response3.session.destroyed)

      let response4 = await requests.requestIndex(response3.cookie)
      assert.equal(response4.session.get('count'), 1)
      assert.notEqual(response4.session.id, response3.session.id)
    },
  )

  it(
    'does not set a cookie when session data is not changed',
    { skip: !integrationEnabled },
    async () => {
      let storage = createIntegrationStorage()
      let requests = createRequestHelpers(storage)

      let response = await requests.requestSession()
      assert.equal(response.session.dirty, false)
      assert.equal(response.cookie, null)
    },
  )

  it(
    'makes flash data available only on the next request',
    { skip: !integrationEnabled },
    async () => {
      let storage = createIntegrationStorage()
      let requests = createRequestHelpers(storage)

      let response1 = await requests.requestSession()
      assert.equal(response1.session.get('message'), undefined)

      let response2 = await requests.requestFlash(response1.cookie)
      assert.equal(response2.session.get('message'), undefined)

      let response3 = await requests.requestSession(response2.cookie)
      assert.equal(response3.session.get('message'), 'success!')

      let response4 = await requests.requestSession(response3.cookie)
      assert.equal(response4.session.get('message'), undefined)
    },
  )

  it(
    'leaves old session data in storage by default when the id is regenerated',
    { skip: !integrationEnabled },
    async () => {
      let storage = createIntegrationStorage()
      let requests = createRequestHelpers(storage)

      let response1 = await requests.requestIndex()
      assert.equal(response1.session.get('count'), 1)

      let response2 = await requests.requestLogin(response1.cookie)
      assert.notEqual(response2.session.id, response1.session.id)

      let response3 = await requests.requestIndex(response2.cookie)
      assert.equal(response3.session.get('count'), 2)

      let response4 = await requests.requestIndex(response1.cookie)
      assert.equal(response4.session.get('count'), 2, 'old session data should still be in storage')
    },
  )

  it(
    'deletes old session data when the id is regenerated and the deleteOldSession option is true',
    { skip: !integrationEnabled },
    async () => {
      let storage = createIntegrationStorage()
      let requests = createRequestHelpers(storage)

      let response1 = await requests.requestIndex()
      assert.equal(response1.session.get('count'), 1)

      let response2 = await requests.requestLoginAndDeleteOldSession(response1.cookie)
      assert.notEqual(response2.session.id, response1.session.id)

      let response3 = await requests.requestIndex(response2.cookie)
      assert.equal(response3.session.get('count'), 2)

      let response4 = await requests.requestIndex(response1.cookie)
      assert.equal(response4.session.get('count'), 1, 'old session data should be deleted')
    },
  )
})

function createIntegrationStorage(options?: MemcacheSessionStorageOptions): SessionStorage {
  return createMemcacheSessionStorage(process.env.SESSION_MEMCACHE_SERVER as string, {
    ...options,
    keyPrefix: `remix:session:integration:${crypto.randomUUID()}:`,
  })
}

function createRequestHelpers(storage: SessionStorage) {
  return {
    async requestSession(cookie: string | null = null) {
      let session = await storage.read(cookie)
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', Number(session.get('count') ?? 0) + 1)
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestFlash(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.flash('message', 'success!')
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestDestroy(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.destroy()
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestLogin(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.regenerateId()
      return {
        cookie: await storage.save(session),
        session,
      }
    },
    async requestLoginAndDeleteOldSession(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.regenerateId(true)
      return {
        cookie: await storage.save(session),
        session,
      }
    },
  }
}
