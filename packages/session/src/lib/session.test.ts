import * as assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import { Session } from './session.ts'
import { createCookieSessionStorage } from './cookie-storage.ts'
import { createMemorySessionStorage } from './memory-storage.ts'
import { createFileSessionStorage, getFile } from './file-storage.ts'

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0]
}

describe('Session', () => {
  it('has an empty id by default', () => {
    assert.equal(new Session().id, '')
  })

  it('correctly stores and retrieves values', () => {
    let session = new Session()

    session.set('user', 'mjackson')
    session.flash('error', 'boom')

    assert.equal(session.has('user'), true)
    assert.equal(session.get('user'), 'mjackson')
    // Normal values should remain in the session after get()
    assert.equal(session.has('user'), true)
    assert.equal(session.get('user'), 'mjackson')

    assert.equal(session.has('error'), true)
    assert.equal(session.get('error'), 'boom')
    // Flash values disappear after the first get()
    assert.equal(session.has('error'), false)
    assert.equal(session.get('error'), undefined)

    session.unset('user')

    assert.equal(session.has('user'), false)
    assert.equal(session.get('user'), undefined)
  })

  it('correctly destroys a session', () => {
    let session = new Session()

    session.set('user', 'mjackson')
    assert.equal(session.get('user'), 'mjackson')

    session.destroy()

    assert.equal(session.has('user'), false)
    assert.equal(session.get('user'), undefined)
  })

  it('tracks session status for newly created sessions', () => {
    let session = new Session()
    assert.equal(session.status, 'new')

    session.get('user')
    assert.equal(session.status, 'new')

    session.set('user', 'mjackson')
    assert.equal(session.status, 'dirty')

    session.destroy()
    assert.equal(session.status, 'destroyed')
  })

  it('tracks session status for existing sessions', () => {
    let session = new Session({ user: 'brophdawg11' })
    assert.equal(session.status, 'clean')

    session.get('user')
    assert.equal(session.status, 'clean')

    session.set('user', 'mjackson')
    assert.equal(session.status, 'dirty')

    session.destroy()
    assert.equal(session.status, 'destroyed')
  })

  it('throws an error if you try to operate on a destroyed session', () => {
    let session = new Session({ user: 'brophdawg11' })
    assert.equal(session.status, 'clean')

    session.destroy()
    assert.equal(session.status, 'destroyed')

    assert.equal(session.get('user'), undefined)
    assert.throws(() => session.set('user', 'mjackson'), {
      message: 'Cannot operate on a destroyed session',
    })
  })
})

describe('In-memory session storage', () => {
  it('persists session data across requests', async () => {
    let { getSession, commitSession } = createMemorySessionStorage({
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))

    assert.equal(session.get('user'), 'mjackson')
  })

  it('uses random hash keys as session ids', async () => {
    let { getSession, commitSession } = createMemorySessionStorage({
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))
    assert.match(session.id, /^[a-z0-9]{8}$/)
  })
})

describe('Cookie session storage', () => {
  it('persists session data across requests', async () => {
    let { getSession, commitSession } = createCookieSessionStorage({
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))

    assert.equal(session.get('user'), 'mjackson')
  })

  it('returns an empty session for cookies that are not signed properly', async () => {
    let { getSession, commitSession } = createCookieSessionStorage({
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')

    assert.equal(session.get('user'), 'mjackson')

    let setCookie = await commitSession(session)
    session = await getSession(
      // Tamper with the session cookie...
      getCookieFromSetCookie(setCookie).slice(0, -1),
    )

    assert.equal(session.get('user'), undefined)
  })

  it('"makes the default path of cookies to be /', async () => {
    let { getSession, commitSession } = createCookieSessionStorage({
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    session.set('user', 'mjackson')
    let setCookie = await commitSession(session)
    assert.ok(setCookie.includes('Path=/'))
  })

  it('throws an error when the cookie size exceeds 4096 bytes', async () => {
    let { getSession, commitSession } = createCookieSessionStorage({
      cookie: { secrets: ['secret1'] },
    })
    let session = await getSession()
    let longString = Array.from({ length: 4097 }).fill('a').join('')
    session.set('over4096bytes', longString)
    await assert.rejects(() => commitSession(session))
  })

  it('destroys sessions using a past date', async () => {
    let originalWarn = console.warn
    console.warn = () => {}
    let { getSession, destroySession } = createCookieSessionStorage({
      cookie: {
        secrets: ['secret1'],
      },
    })
    let session = await getSession()
    let setCookie = await destroySession(session)
    assert.equal(
      setCookie,
      '__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax',
    )
    console.warn = originalWarn
  })

  it('destroys sessions that leverage maxAge', async () => {
    let originalWarn = console.warn
    console.warn = () => {}
    let { getSession, destroySession } = createCookieSessionStorage({
      cookie: {
        maxAge: 60 * 60, // 1 hour
        secrets: ['secret1'],
      },
    })
    let session = await getSession()
    let setCookie = await destroySession(session)
    assert.equal(
      setCookie,
      '__session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax',
    )
    console.warn = originalWarn
  })

  describe('warnings when providing options you may not want to', () => {
    it('warns against using `expires` when creating the session', async () => {
      let warnings: string[] = []
      let originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      createCookieSessionStorage({
        cookie: {
          secrets: ['secret1'],
          expires: new Date(Date.now() + 60_000),
        },
      })

      assert.equal(warnings.length, 1)
      assert.equal(
        warnings[0],
        'The "__session" cookie has an "expires" property set. This will cause the expires value to not be updated when the session is committed. Instead, you should set the expires value when serializing the cookie. You can use `commitSession(session, { expires })` if using a session storage object, or `cookie.serialize("value", { expires })` if you\'re using the cookie directly.',
      )
      console.warn = originalWarn
    })

    it('warns when not passing secrets when creating the session', async () => {
      let warnings: string[] = []
      let originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      createCookieSessionStorage({ cookie: {} })

      assert.equal(warnings.length, 1)
      assert.equal(
        warnings[0],
        'The "__session" cookie is not signed, but session cookies should be signed to prevent tampering on the client before they are sent back to the server.',
      )
      console.warn = originalWarn
    })
  })

  describe('when a new secret shows up in the rotation', () => {
    it('unsigns old session cookies using the old secret and encodes new cookies using the new secret', async () => {
      let { getSession, commitSession } = createCookieSessionStorage({
        cookie: { secrets: ['secret1'] },
      })
      let session = await getSession()
      session.set('user', 'mjackson')
      let setCookie = await commitSession(session)
      session = await getSession(getCookieFromSetCookie(setCookie))

      assert.equal(session.get('user'), 'mjackson')

      // A new secret enters the rotation...
      let storage = createCookieSessionStorage({
        cookie: { secrets: ['secret2', 'secret1'] },
      })
      getSession = storage.getSession
      commitSession = storage.commitSession

      // Old cookies should still work with the old secret.
      session = await storage.getSession(getCookieFromSetCookie(setCookie))
      assert.equal(session.get('user'), 'mjackson')

      // New cookies should be signed using the new secret.
      let setCookie2 = await storage.commitSession(session)
      assert.notEqual(setCookie2, setCookie)
    })
  })
})

describe('File session storage', async () => {
  let dir = path.join(os.tmpdir(), 'file-session-storage')

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

    let cookie = `__session=${btoa(JSON.stringify('0123456789abcdef'))}`
    let session = await getSession(cookie)
    session.set('user', 'mjackson')
    assert.equal(session.get('user'), 'mjackson')
    let setCookie = await commitSession(session)
    session = await getSession(getCookieFromSetCookie(setCookie))
    assert.equal(session.get('user'), 'mjackson')

    cookie = `__session=${btoa(JSON.stringify('0123456789abcdeg'))}`
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
