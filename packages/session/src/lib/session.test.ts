import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Session } from './session.ts'

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
    assert.equal(session.status, 'clean')

    session.get('user')
    assert.equal(session.status, 'clean')

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
