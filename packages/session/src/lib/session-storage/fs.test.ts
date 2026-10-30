import * as assert from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
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

  it('keeps session data valid when saves overlap', async () => {
    let storage = createFsSessionStorage(tmpDir)
    let session = await storage.read(null)
    session.set('value', '')
    let cookie = await storage.save(session)

    let sessions = await Promise.all(Array.from({ length: 50 }, () => storage.read(cookie)))
    // Later saves write shorter values, so writing in place would leave the tail of an earlier,
    // longer value behind.
    await Promise.all(
      sessions.map((concurrent, index) => {
        concurrent.set('value', 'x'.repeat((sessions.length - index) * 1000))
        return storage.save(concurrent)
      }),
    )

    let saved = await storage.read(cookie)
    assert.equal(saved.id, session.id)
    assert.match(String(saved.get('value')), /^x*$/)
    assert.equal((await listEntries(tmpDir)).length, 1, 'only the session file should remain')
  })

  it('never shows a partially saved session to an overlapping read', async () => {
    let storage = createFsSessionStorage(tmpDir)
    let session = await storage.read(null)
    session.set('value', '')
    let cookie = await storage.save(session)

    let sessions = await Promise.all(Array.from({ length: 50 }, () => storage.read(cookie)))
    let saving = true
    // Settled rather than all, so a failed save fails this test instead of rejecting unhandled
    // while the reads below run.
    let saves = Promise.allSettled(
      sessions.map((concurrent, index) => {
        concurrent.set('value', 'x'.repeat((sessions.length - index) * 1000))
        return storage.save(concurrent)
      }),
    ).finally(() => {
      saving = false
    })

    // Read for as long as saves are in progress, so reads land while files are being written. Several
    // readers keep the file open almost constantly, like a visitor's parallel requests.
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (saving) {
          let read = await storage.read(cookie)
          assert.equal(read.id, session.id)
          assert.match(String(read.get('value')), /^x*$/)
        }
      }),
    )
    let failures = (await saves).filter((result) => result.status === 'rejected')
    assert.deepEqual(failures, [])
  })

  it('saves while another handle has the session file open', async () => {
    let storage = createFsSessionStorage(tmpDir)
    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)
    let [file] = await listEntries(tmpDir)

    // Windows can refuse to replace a file that another handle has open; the save must still land.
    let handle = await fsp.open(file, 'r')
    let closed = new Promise((resolve) => setTimeout(resolve, 50)).then(() => handle.close())
    session.set('count', 2)
    await storage.save(session)
    await closed

    let saved = await storage.read(cookie)
    assert.equal(saved.get('count'), 2)
  })

  it('removes its temporary file when a save fails', async () => {
    let storage = createFsSessionStorage(tmpDir)
    let session = await storage.read(null)
    session.set('count', 1)
    await storage.save(session)
    let [file] = await listEntries(tmpDir)

    // A directory where the session file belongs makes replacing it fail.
    await fsp.rm(file)
    await fsp.mkdir(file)
    session.set('count', 2)
    await assert.rejects(storage.save(session))

    assert.deepEqual(await listEntries(tmpDir), [file])
  })

  it('starts a new session when the session file is not valid JSON', async () => {
    let storage = createFsSessionStorage(tmpDir)
    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)
    let [file] = await listEntries(tmpDir)

    // What overlapping saves left behind when they wrote in place.
    await fsp.writeFile(file, '{"count":1}t":2}')

    let recovered = await storage.read(cookie)
    assert.notEqual(recovered.id, session.id)
    assert.equal(recovered.get('count'), undefined)
  })

  it('replaces an invalid session file when unknown IDs are reused', async () => {
    let storage = createFsSessionStorage(tmpDir, { useUnknownIds: true })
    let session = await storage.read(null)
    session.set('count', 1)
    let cookie = await storage.save(session)
    let [file] = await listEntries(tmpDir)

    // A crash during a save can leave an empty file.
    await fsp.writeFile(file, '')

    let recovered = await storage.read(cookie)
    assert.equal(recovered.id, session.id)
    assert.equal(recovered.get('count'), undefined)

    recovered.set('count', 2)
    await storage.save(recovered)
    assert.equal((await storage.read(cookie)).get('count'), 2)
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

// Session files live one subdirectory deep, named by the hash of their ID.
async function listEntries(directory: string): Promise<string[]> {
  let entries: string[] = []
  for (let subdir of await fsp.readdir(directory)) {
    for (let name of await fsp.readdir(path.join(directory, subdir))) {
      entries.push(path.join(directory, subdir, name))
    }
  }
  return entries
}
