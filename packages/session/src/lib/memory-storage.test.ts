import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { MemorySessionStorage } from './memory-storage.ts'
import { Session } from './session.ts'

describe('MemorySessionStorage', () => {
  it('reads, updates, and deletes sessions', async () => {
    let storage = new MemorySessionStorage()
    let session = new Session()

    session.set('hello', 'world')
    let cookieValue = await storage.update(session.id, session.data)
    assert.deepEqual(await storage.read(cookieValue), new Session(session.id, session.data))

    cookieValue = await storage.delete(session.id)
    assert.deepEqual(await storage.read(cookieValue), new Session())
  })

  it('does not use unknown IDs by default', async () => {
    let storage = new MemorySessionStorage()
    let session = await storage.read('unknown')
    assert.ok(session)
    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown IDs if enabled', async () => {
    let storage = new MemorySessionStorage({ useUnknownIds: true })
    let session = await storage.read('unknown')
    assert.ok(session)
    assert.equal(session.id, 'unknown')
  })
})
