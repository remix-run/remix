import * as assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import { createFileSessionStorage, getFile } from './file-storage.ts'

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0]
}

describe('File session storage', async () => {
  let dir = path.join(os.tmpdir(), 'file-storage')

  // Setup test directory
  await fsp.mkdir(dir, { recursive: true })

  // Cleanup after all tests
  process.on('exit', () => {
    try {
      require('node:fs').rmSync(dir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('persists session data across requests', async () => {
    let { getSession, commitSession } = createFileSessionStorage({
      dir,
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))

    assert.equal(session.get('user'), 'mjackson')
  })

  it('returns an empty session for cookies that are not signed properly', async () => {
    let { getSession, commitSession } = createFileSessionStorage({
      dir,
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')

    assert.equal(session.get('user'), 'mjackson')

    let setCookie = await commitSession(session)
    session = await getSession(
      // Tamper with the cookie...
      getCookieFromSetCookie(setCookie).slice(0, -1),
    )

    assert.equal(session.get('user'), undefined)
  })

  it('returns an empty session for invalid session ids', async () => {
    let originalWarn = console.warn
    console.warn = () => {}
    let { getSession, commitSession } = createFileSessionStorage({
      dir,
    })

    let cookie = `__session=${btoa('0123456789abcdef')}`
    let session = await getSession(cookie)
    session.set('user', 'mjackson')
    assert.equal(session.get('user'), 'mjackson')
    let setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))
    assert.equal(session.get('user'), 'mjackson')

    cookie = `__session=${btoa('0123456789abcdeg')}`
    session = await getSession(cookie)
    session.set('user', 'mjackson')
    assert.equal(session.get('user'), 'mjackson')

    setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))
    assert.equal(session.get('user'), undefined)

    console.warn = originalWarn
  })

  it("doesn't destroy the entire session directory when destroying an empty file session", async () => {
    let { getSession, destroySession } = createFileSessionStorage({
      dir,
      cookie: { secrets: ['secret1'] },
    })

    let session = await getSession()

    await assert.doesNotReject(() => destroySession(session))
  })

  it('saves expires to file if expires provided to commitSession when creating new cookie', async () => {
    let { getSession, commitSession } = createFileSessionStorage({
      dir,
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let date = new Date(Date.now() + 1000 * 60)
    let cookieHeader = await commitSession(session, { expires: date })
    let createdSession = await getSession(cookieHeader)

    let { id } = createdSession
    let file = getFile(dir, id)
    assert.notEqual(file, null)
    let fileContents = await fsp.readFile(file!, 'utf8')
    let fileData = JSON.parse(fileContents)
    assert.equal(fileData.expires, date.toISOString())
  })

  it('saves expires to file if maxAge provided to commitSession when creating new cookie', async () => {
    let { getSession, commitSession } = createFileSessionStorage({
      dir,
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let cookieHeader = await commitSession(session, { maxAge: 60 })
    let createdSession = await getSession(cookieHeader)

    let { id } = createdSession
    let file = getFile(dir, id)
    assert.notEqual(file, null)
    let fileContents = await fsp.readFile(file!, 'utf8')
    let fileData = JSON.parse(fileContents)
    assert.equal(typeof fileData.expires, 'string')
  })

  describe('when a new secret shows up in the rotation', () => {
    it('unsigns old session cookies using the old secret and encodes new cookies using the new secret', async () => {
      let { getSession, commitSession } = createFileSessionStorage({
        dir,
        cookie: { secrets: ['secret1'] },
      })
      let session = await getSession()
      session.set('user', 'mjackson')
      let setCookie = await commitSession(session)
      session = await getSession(getCookieFromSetCookie(setCookie))

      assert.equal(session.get('user'), 'mjackson')

      // A new secret enters the rotation...
      let storage = createFileSessionStorage({
        dir,
        cookie: { secrets: ['secret2', 'secret1'] },
      })
      getSession = storage.getSession
      commitSession = storage.commitSession

      // Old cookies should still work with the old secret.
      session = await getSession(getCookieFromSetCookie(setCookie))
      assert.equal(session.get('user'), 'mjackson')

      // New cookies should be signed using the new secret.
      let setCookie2 = await commitSession(session)
      assert.notEqual(setCookie2, setCookie)
    })
  })
})
