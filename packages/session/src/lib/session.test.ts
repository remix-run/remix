import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createSession } from './session.ts'

describe('Session', () => {
  it('creates a new session', () => {
    let session = createSession()
    assert.ok(session)
    assert.ok(session.id)
    assert.equal(session.destroyed, false)
    assert.equal(session.dirty, false)
    assert.equal(session.size, 0)
  })

  it('creates a new session with a custom ID', () => {
    let session = createSession('custom-id')
    assert.equal(session.id, 'custom-id')
  })

  it('creates a new session with initial data', () => {
    let session = createSession(undefined, [{ hello: 'world' }, {}])
    assert.equal(session.size, 1)
    assert.equal(session.get('hello'), 'world')
    assert.equal(session.dirty, false)
  })

  it('creates a new session with initial flash data', () => {
    let session = createSession(undefined, [{}, { hello: 'world' }])
    assert.equal(session.get('hello'), 'world')
    assert.equal(session.dirty, true)
  })

  it('sets and gets values', () => {
    let session = createSession()
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

  it('sets and gets values with complex types', () => {
    let session = createSession(undefined, [{ user: { id: 123, name: 'alice' } }, {}])

    assert.deepEqual(session.get('user'), { id: 123, name: 'alice' })

    session.set('user', { id: 456, name: 'bob' })
    assert.deepEqual(session.get('user'), { id: 456, name: 'bob' })

    // @ts-expect-error - should not allow different type for user
    session.set('user', { id: 456, name: 'bob', roles: ['admin'] })
  })

  it('unsets values when set to null', () => {
    let session = createSession()
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
    let session = createSession()
    session.set('hello', 'world')
    assert.equal(session.has('hello'), true)
    assert.equal(session.get('hello'), 'world')
    assert.equal(session.dirty, true)

    session.set('hello', undefined)
    assert.equal(session.has('hello'), false)
    assert.equal(session.get('hello'), undefined)
    assert.equal(session.dirty, true)
  })

  it('regenerates the session ID', () => {
    let session = createSession()
    let originalId = session.id
    assert.equal(session.dirty, false)

    session.regenerateId()
    assert.notEqual(session.id, originalId)
    assert.equal(session.deleteId, undefined)
    assert.equal(session.dirty, true)
  })

  it('deletes the old session ID', () => {
    let session = createSession()
    let originalId = session.id
    assert.equal(session.dirty, false)

    session.regenerateId(true)
    assert.notEqual(session.id, originalId)
    assert.equal(session.deleteId, originalId)
    assert.equal(session.dirty, true)
  })

  it('destroys the session', () => {
    let session = createSession()
    assert.equal(session.destroyed, false)
    session.destroy()
    assert.equal(session.destroyed, true)
  })

  it('deletes the original session when the session id is regenerated more than once', () => {
    let session = createSession()
    let originalId = session.id

    session.regenerateId(true)
    assert.notEqual(session.id, originalId)
    assert.equal(session.deleteId, originalId)

    session.regenerateId(true)
    assert.notEqual(session.id, originalId)
    assert.equal(session.deleteId, originalId)
  })

  describe('a destroyed session', () => {
    it('flash() throws an error', () => {
      let session = createSession()
      session.destroy()
      assert.throws(() => session.flash('hello', 'world'), new Error('Session has been destroyed'))
    })

    it('regenerateId() throws an error', () => {
      let session = createSession()
      session.destroy()
      assert.throws(() => session.regenerateId(), new Error('Session has been destroyed'))
    })

    it('set() throws an error', () => {
      let session = createSession()
      session.destroy()
      assert.throws(() => session.set('hello', 'world'), new Error('Session has been destroyed'))
    })

    it('unset() throws an error', () => {
      let session = createSession()
      session.destroy()
      assert.throws(() => session.unset('hello'), new Error('Session has been destroyed'))
    })

    it('get() returns undefined', () => {
      let session = createSession()
      session.set('hello', 'world')
      assert.equal(session.get('hello'), 'world')
      session.destroy()
      assert.equal(session.get('hello'), undefined)
    })

    it('has() returns false', () => {
      let session = createSession()
      session.set('hello', 'world')
      assert.equal(session.has('hello'), true)
      session.destroy()
      assert.equal(session.has('hello'), false)
    })
  })
})
