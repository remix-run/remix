import * as assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { FileSessionStorage } from './file-storage.ts'
import { Session } from './session.ts'

const __dirname = new URL('.', import.meta.url).pathname
const packageRoot = path.resolve(__dirname, '..', '..')
const tmpRoot = path.join(packageRoot, '.tmp')

describe('FileSessionStorage', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = path.join(tmpRoot, `test-sessions-${Date.now()}-${Math.random()}`)
    await fsp.mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true })
  })

  it('reads, updates, and deletes sessions', async () => {
    let storage = new FileSessionStorage(tmpDir)
    let session = new Session()

    session.set('hello', 'world')
    let cookieValue = await storage.update(session.id, session.data)
    assert.equal(cookieValue, session.id)

    let readSession = await storage.read(cookieValue)
    assert.equal(readSession.id, session.id)
    assert.equal(readSession.get('hello'), 'world')

    cookieValue = await storage.delete(session.id)
    assert.equal(cookieValue, '')

    // After deletion, reading the session should create a new one
    let newSession = await storage.read(session.id)
    assert.notEqual(newSession.id, session.id)
    assert.equal(newSession.get('hello'), undefined)
  })

  it('does not use unknown IDs by default', async () => {
    let storage = new FileSessionStorage(tmpDir)
    let session = await storage.read('unknown')
    assert.ok(session)
    assert.notEqual(session.id, 'unknown')
  })

  it('uses unknown IDs if enabled', async () => {
    let storage = new FileSessionStorage(tmpDir, { useUnknownIds: true })
    let session = await storage.read('unknown')
    assert.ok(session)
    assert.equal(session.id, 'unknown')
  })

  it('stores files in subdirectories based on hash', async () => {
    let storage = new FileSessionStorage(tmpDir)
    let session = new Session()

    session.set('foo', 'bar')
    await storage.update(session.id, session.data)

    // Check that the file was created in a subdirectory
    let entries = await fsp.readdir(tmpDir)
    assert.equal(entries.length, 1)
    assert.match(entries[0], /^[0-9a-f]{2}$/)

    let subdir = path.join(tmpDir, entries[0])
    let files = await fsp.readdir(subdir)
    assert.equal(files.length, 1)
    assert.match(files[0], /^[0-9a-f]+$/)
  })

  it('persists sessions across storage instances', async () => {
    let storage1 = new FileSessionStorage(tmpDir)
    let session = new Session()

    session.set('persistent', 'data')
    await storage1.update(session.id, session.data)

    // Create a new storage instance with the same directory
    let storage2 = new FileSessionStorage(tmpDir)
    let readSession = await storage2.read(session.id)

    assert.equal(readSession.id, session.id)
    assert.equal(readSession.get('persistent'), 'data')
  })

  it('handles flash values correctly', async () => {
    let storage = new FileSessionStorage(tmpDir)
    let session = new Session()

    session.set('regular', 'value')
    session.flash('message', 'Hello!')
    await storage.update(session.id, session.data)

    let readSession = await storage.read(session.id)
    assert.equal(readSession.get('regular'), 'value')
    assert.equal(readSession.get('message'), 'Hello!')

    // Flash values should only be available once
    await storage.update(readSession.id, readSession.data)
    let readSession2 = await storage.read(readSession.id)
    assert.equal(readSession2.get('regular'), 'value')
    assert.equal(readSession2.get('message'), undefined)
  })

  it('creates directory if it does not exist', async () => {
    let nonExistentDir = path.join(tmpDir, 'nested', 'path', 'sessions')
    let storage = new FileSessionStorage(nonExistentDir)

    let session = new Session()
    session.set('test', 'value')
    await storage.update(session.id, session.data)

    let readSession = await storage.read(session.id)
    assert.equal(readSession.get('test'), 'value')

    await fsp.rm(nonExistentDir, { recursive: true, force: true })
  })

  it('handles delete of non-existent session gracefully', async () => {
    let storage = new FileSessionStorage(tmpDir)
    let cookieValue = await storage.delete('non-existent-session-id')
    assert.equal(cookieValue, '')
  })
})
