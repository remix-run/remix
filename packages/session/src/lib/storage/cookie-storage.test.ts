import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookieSessionStorage } from './cookie-storage.ts'

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0]
}

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
