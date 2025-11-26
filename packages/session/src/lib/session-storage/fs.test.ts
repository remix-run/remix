import * as assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

import { createFsSessionStorage } from './fs.ts'

describe('fs session storage', () => {
  let tmpDir: string
  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'file-session-storage-test-'))
  })

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true })
  })

  it('does not use unknown session IDs by default', async () => {
    let storage = createFsSessionStorage(tmpDir)
    let session = await storage.read('unknown')
    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown session IDs if enabled', async () => {
    let storage = createFsSessionStorage(tmpDir, { useUnknownIds: true })
    let session = await storage.read('unknown')
    assert.equal(session.id, 'unknown')
  })

  it('persists session data across requests', async () => {
    let storage = createFsSessionStorage(tmpDir)

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
    let storage = createFsSessionStorage(tmpDir)

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
  })

  it('does not set a cookie when session data is not changed', async () => {
    let storage = createFsSessionStorage(tmpDir)

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
    let storage = createFsSessionStorage(tmpDir)

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
    let storage = createFsSessionStorage(tmpDir)

    async function requestIndex(cookie: string | null = null) {
      let session = await storage.read(cookie)
      session.set('count', ((session.get('count') as number | undefined) ?? 0) + 1)
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
    assert.equal(response4.session.get('count'), 2, 'old session should still be in storage')
  })

  it('deletes old session data when the id is regenerated and the deleteOldSession option is true', async () => {
    let storage = createFsSessionStorage(tmpDir)

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
    assert.equal(response4.session.get('count'), 1, 'old session should be deleted')
  })

  it('throws error if session directory is a file', async () => {
    let filePath = path.join(tmpDir, 'not-a-directory')
    await fsp.writeFile(filePath, 'I am a file, not a directory.')

    assert.throws(
      () => createFsSessionStorage(filePath),
      new Error(`Path "${filePath}" is not a directory`),
    )
  })
})
