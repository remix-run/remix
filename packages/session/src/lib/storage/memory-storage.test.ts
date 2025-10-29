import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createMemorySessionStorage } from './memory-storage.ts'

function getCookieFromSetCookie(setCookie: string): string {
  return setCookie.split(/;\s*/)[0]
}

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
