import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Session } from './session.ts'
import { MemorySessionStorage } from './memory-storage.ts'

describe('Session', () => {
  it('creates a new session', () => {
    let session = new Session()
    assert.ok(session)
    assert.ok(session.id)
    assert.equal(session.destroyed, false)
    assert.equal(session.dirty, false)
  })

  it('creates a new session with a custom ID', () => {
    let session = new Session('custom-id')
    assert.equal(session.id, 'custom-id')
  })

  it('creates a new session with initial data', () => {
    let session = new Session(undefined, [{ hello: 'world' }, {}])
    assert.equal(session.get('hello'), 'world')
  })

  it('creates a new session with initial flash data', () => {
    let session = new Session(undefined, [{}, { hello: 'world' }])
    assert.equal(session.get('hello'), 'world')
  })

  it('sets and gets values', () => {
    let session = new Session()
    assert.equal(session.has('hello'), false)
    assert.equal(session.get('hello'), undefined)
    assert.equal(session.dirty, false)

    session.set('hello', 'world')
    assert.equal(session.has('hello'), true)
    assert.equal(session.get('hello'), 'world')
    assert.equal(session.dirty, true)

    session.unset('hello')
    assert.equal(session.has('hello'), false)
    assert.equal(session.get('hello'), undefined)
    assert.equal(session.dirty, true)
  })

  it('unsets values when set to null', () => {
    let session = new Session()
    session.set('hello', 'world')
    assert.equal(session.has('hello'), true)
    assert.equal(session.get('hello'), 'world')
    assert.equal(session.dirty, true)

    session.set('hello', null)
    assert.equal(session.has('hello'), false)
    assert.equal(session.get('hello'), undefined)
    assert.equal(session.dirty, true)
  })

  it('unsets values when set to undefined', () => {
    let session = new Session()
    session.set('hello', 'world')
    assert.equal(session.has('hello'), true)
    assert.equal(session.get('hello'), 'world')
    assert.equal(session.dirty, true)

    session.set('hello', undefined)
    assert.equal(session.has('hello'), false)
    assert.equal(session.get('hello'), undefined)
    assert.equal(session.dirty, true)
  })

  it('sets flash data for the next request', async () => {
    let storage = new MemorySessionStorage()
    let session = new Session()

    // Flash data should not be available immediately
    session.flash('hello', 'world')
    assert.equal(session.get('hello'), undefined)

    // On the next request, the flash data should be available
    let session2 = await storage.read(await storage.update(session.id, session.data))
    assert.equal(session2.id, session.id)
    assert.equal(session2.get('hello'), 'world')

    // On the following request, the flash data should be cleared
    let session3 = await storage.read(await storage.update(session2.id, session2.data))
    assert.equal(session3.id, session.id)
    assert.equal(session3.get('hello'), undefined)
  })

  it('regenerates the session ID', () => {
    let session = new Session()
    let originalId = session.id
    assert.equal(session.dirty, false)

    session.regenerateId()
    assert.notEqual(session.id, originalId)
    assert.equal(session.dirty, true)
  })

  it('destroys the session', () => {
    let session = new Session()
    assert.equal(session.destroyed, false)
    session.destroy()
    assert.equal(session.destroyed, true)
  })

  describe('a destroyed session', () => {
    it('flash() throws an error', () => {
      let session = new Session()
      session.destroy()
      assert.throws(() => session.flash('hello', 'world'), new Error('Session has been destroyed'))
    })

    it('regenerateId() throws an error', () => {
      let session = new Session()
      session.destroy()
      assert.throws(() => session.regenerateId(), new Error('Session has been destroyed'))
    })

    it('set() throws an error', () => {
      let session = new Session()
      session.destroy()
      assert.throws(() => session.set('hello', 'world'), new Error('Session has been destroyed'))
    })

    it('unset() throws an error', () => {
      let session = new Session()
      session.destroy()
      assert.throws(() => session.unset('hello'), new Error('Session has been destroyed'))
    })

    it('get() returns undefined', () => {
      let session = new Session()
      session.set('hello', 'world')
      assert.equal(session.get('hello'), 'world')
      session.destroy()
      assert.equal(session.get('hello'), undefined)
    })

    it('has() returns false', () => {
      let session = new Session()
      session.set('hello', 'world')
      assert.equal(session.has('hello'), true)
      session.destroy()
      assert.equal(session.has('hello'), false)
    })
  })
})
