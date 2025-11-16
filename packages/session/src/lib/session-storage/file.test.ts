import * as assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { createCookie, type Cookie } from '@remix-run/cookie'

import { createRequest } from '../../../test/helpers.ts'

import { createFileStorage } from './file.ts'

describe('file session storage', () => {
  let cookie: Cookie
  let rootDir: string
  beforeEach(async () => {
    rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'file-session-storage-test-'))
    cookie = createCookie('session', { secrets: ['s3cr3t'] })
  })

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true })
  })

  it('throws an error if the session cookie is not signed', () => {
    assert.throws(
      () => createFileStorage(createCookie('session'), rootDir),
      new Error('Session cookie must be signed'),
    )
  })

  it('does not use unknown session IDs by default', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleRequest(request: Request) {
      let session = await storage.read(request)
      let response = new Response(`Session ID: ${session.id}`)
      await storage.save(session, response)
      return response
    }

    let response = await handleRequest(
      createRequest(
        new Response('', {
          headers: { 'Set-Cookie': await cookie.serialize('unknown') },
        }),
      ),
    )
    assert.doesNotMatch(await response.text(), /Session ID: unknown/)
  })

  it('uses unknown session IDs if enabled', async () => {
    let storage = createFileStorage(cookie, rootDir, { useUnknownIds: true })

    async function handleRequest(request: Request) {
      let session = await storage.read(request)
      let response = new Response(`Session ID: ${session.id}`)
      await storage.save(session, response)
      return response
    }

    let response = await handleRequest(
      createRequest(
        new Response('', {
          headers: { 'Set-Cookie': await cookie.serialize('unknown') },
        }),
      ),
    )
    assert.match(await response.text(), /Session ID: unknown/)
  })

  it('persists session data across requests', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleRequest(request: Request) {
      let session = await storage.read(request)
      session.set('count', ((session.get('count') as number | undefined) ?? 0) + 1)
      let response = new Response(`Count: ${session.get('count')}`)
      await storage.save(session, response)
      return response
    }

    let response1 = await handleRequest(createRequest())
    assert.match(await response1.text(), /Count: 1/)

    let response2 = await handleRequest(createRequest(response1))
    assert.match(await response2.text(), /Count: 2/)

    let response3 = await handleRequest(createRequest(response2))
    assert.match(await response3.text(), /Count: 3/)
  })

  it('clears session data when the session is destroyed', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleIndex(request: Request) {
      let session = await storage.read(request)
      session.set('count', ((session.get('count') as number | undefined) ?? 0) + 1)
      let response = new Response(`Count: ${session.get('count')}`)
      await storage.save(session, response)
      return response
    }

    async function handleDestroy(request: Request) {
      let session = await storage.read(request)
      session.destroy()
      let response = new Response(`Session ID: ${session.id}`)
      await storage.save(session, response)
      return response
    }

    let response1 = await handleIndex(createRequest())
    assert.match(await response1.text(), /Count: 1/)

    let response2 = await handleIndex(createRequest(response1))
    assert.match(await response2.text(), /Count: 2/)

    let response3 = await handleDestroy(createRequest(response2))
    assert.match(await response3.text(), /Session ID: \w+/)

    assert.notEqual(
      await storage.read(createRequest(response2)).then((session) => session.id),
      await storage.read(createRequest(response3)).then((session) => session.id),
      'session id should have changed',
    )

    let response4 = await handleIndex(createRequest(response3))
    assert.match(await response4.text(), /Count: 1/)
  })

  it('does not set a cookie when session data is not changed', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleIndex(request: Request) {
      let session = await storage.read(request)
      let response = new Response(`Session ID: ${session.id}`)
      await storage.save(session, response)
      return response
    }

    let response = await handleIndex(createRequest())
    assert.match(await response.text(), /Session ID: \w+/)

    assert.deepEqual(response.headers.getSetCookie(), [])
  })

  it('makes flash data available only on the next request', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleIndex(request: Request) {
      let session = await storage.read(request)
      let response = new Response(`Message: ${session.get('message')}`)
      await storage.save(session, response)
      return response
    }

    async function handleFlash(request: Request) {
      let session = await storage.read(request)
      session.flash('message', 'success!')
      let response = new Response(`Message: ${session.get('message')}`)
      await storage.save(session, response)
      return response
    }

    let response1 = await handleIndex(createRequest())
    assert.match(await response1.text(), /Message: undefined/)

    let response2 = await handleFlash(createRequest(response1))
    assert.match(
      await response2.text(),
      /Message: undefined/,
      'flash data should not be available immediately',
    )

    let response3 = await handleIndex(createRequest(response2))
    assert.match(
      await response3.text(),
      /Message: success!/,
      'flash data should be available on the next request',
    )

    let response4 = await handleIndex(createRequest(response3))
    assert.match(
      await response4.text(),
      /Message: undefined/,
      'flash data should be cleared after the next request',
    )
  })

  it('leaves old session data in storage by default when the id is regenerated', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleIndex(request: Request) {
      let session = await storage.read(request)
      session.set('count', ((session.get('count') as number | undefined) ?? 0) + 1)
      let response = new Response(`Count: ${session.get('count')}`)
      await storage.save(session, response)
      return response
    }

    async function handleLogin(request: Request) {
      let session = await storage.read(request)
      session.regenerateId()
      let response = new Response(`Session ID: ${session.id}`)
      await storage.save(session, response)
      return response
    }

    let response1 = await handleIndex(createRequest())
    assert.match(await response1.text(), /Count: 1/)

    let response2 = await handleLogin(createRequest(response1))
    assert.match(await response2.text(), /Session ID: \w+/)

    assert.notEqual(
      await storage.read(createRequest(response1)).then((session) => session.id),
      await storage.read(createRequest(response2)).then((session) => session.id),
      'session id should have changed',
    )

    let response3 = await handleIndex(createRequest(response2))
    assert.match(
      await response3.text(),
      /Count: 2/,
      'new session should continue where old one left off',
    )

    let response4 = await handleIndex(createRequest(response1))
    assert.match(await response4.text(), /Count: 2/, 'old session should still be in storage')
  })

  it('deletes old session data when the id is regenerated and the deleteOldSession option is true', async () => {
    let storage = createFileStorage(cookie, rootDir)

    async function handleIndex(request: Request) {
      let session = await storage.read(request)
      session.set('count', ((session.get('count') as number | undefined) ?? 0) + 1)
      let response = new Response(`Count: ${session.get('count')}`)
      await storage.save(session, response)
      return response
    }

    async function handleLogin(request: Request) {
      let session = await storage.read(request)
      session.regenerateId(true) // deleteOldSession is true
      let response = new Response(`Session ID: ${session.id}`)
      await storage.save(session, response)
      return response
    }

    let response1 = await handleIndex(createRequest())
    assert.match(await response1.text(), /Count: 1/)

    let response2 = await handleLogin(createRequest(response1))
    assert.match(await response2.text(), /Session ID: \w+/)

    assert.notEqual(
      await storage.read(createRequest(response1)).then((session) => session.id),
      await storage.read(createRequest(response2)).then((session) => session.id),
      'session id should have changed',
    )

    let response3 = await handleIndex(createRequest(response2))
    assert.match(
      await response3.text(),
      /Count: 2/,
      'new session should continue where old one left off',
    )

    let response4 = await handleIndex(createRequest(response1))
    assert.match(await response4.text(), /Count: 1/, 'old session should be deleted')
  })
})
