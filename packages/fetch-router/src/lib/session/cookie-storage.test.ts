import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Session } from '../session.ts'
import { CookieSessionStorage } from './cookie-storage.ts'

describe('CookieSessionStorage', () => {
  it('reads, updates, and deletes sessions', async () => {
    let storage = new CookieSessionStorage()
    let session = new Session()

    session.set('hello', 'world')
    let cookieValue = await storage.update(session.id, session.data)
    assert.deepEqual(await storage.read(cookieValue), new Session(session.id, session.data))

    cookieValue = await storage.delete(session.id)
    assert.deepEqual(await storage.read(cookieValue), new Session())
  })
})
