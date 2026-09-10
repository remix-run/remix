import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createCookie, type CookieOptions } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { SetCookie } from '@remix-run/headers/set-cookie'
import type { SessionStorage } from '@remix-run/session'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { createFsSessionStorage } from '@remix-run/session/fs-storage'
import { createMemorySessionStorage } from '@remix-run/session/memory-storage'

import { session } from './session.ts'

describe('session expiration', () => {
  it('enforces Max-Age with cookie storage at the expiration boundary', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let request = createRequests({ maxAge: 60 })
    let response = await request('/start')

    now += 59_999
    let beforeExpiry = await request('/', response)
    assert.equal(await beforeExpiry.text(), '123')
    assert.equal(beforeExpiry.headers.getSetCookie().length, 0)
    now += 1
    assert.equal(await (await request('/', response)).text(), 'none')
  })

  it('enforces Max-Age with memory storage', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let request = createRequests({ maxAge: 60 }, createMemorySessionStorage())
    let response = await request('/start')
    assert.equal(await (await request('/', response)).text(), '123')
    now += 60_000
    assert.equal(await (await request('/', response)).text(), 'none')
  })

  it('enforces Max-Age with filesystem storage', async (t) => {
    let directory = await mkdtemp(join(tmpdir(), 'session-expiration-'))
    try {
      let now = 1_000_000
      t.mock.method(Date, 'now', () => now)
      let request = createRequests({ maxAge: 60 }, createFsSessionStorage(directory))
      let response = await request('/start')
      assert.equal(await (await request('/', response)).text(), '123')
      now += 60_000
      assert.equal(await (await request('/', response)).text(), 'none')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('enforces an absolute Expires date without renewing it on writes', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let request = createRequests({ expires: new Date(now + 60_000) })
    let response = await request('/start')
    now += 30_000
    let updated = await request('/update', response)
    assert.equal(await (await request('/', updated)).text(), '123')
    now += 30_000
    assert.equal(await (await request('/', updated)).text(), 'none')
  })

  it('gives Max-Age precedence over Expires and renews it only on writes', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let request = createRequests({ maxAge: 60, expires: new Date(now - 1_000) })
    let response = await request('/start')
    now += 30_000
    let updated = await request('/update', response)
    now += 30_000
    assert.equal(await (await request('/', response)).text(), 'none')
    assert.equal(await (await request('/', updated)).text(), '123')
    now += 30_000
    assert.equal(await (await request('/', updated)).text(), 'none')
  })

  it('matches the whole-second precision of the Expires header', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let request = createRequests({ expires: new Date(now + 60_500) })
    let response = await request('/start')
    now += 60_000
    assert.equal(await (await request('/', response)).text(), 'none')
  })

  it('starts a new session for malformed or incomplete expiration metadata', async () => {
    let request = createRequests({ maxAge: 60 })
    let cookie = createCookie('__session', { secrets: ['test-secret'] })
    for (let value of ['{', 'null', '{"value":"id"}', '{"value":"id","expires":1e400}']) {
      let response = new Response(null, {
        headers: { 'Set-Cookie': await cookie.serialize(value) },
      })
      assert.equal(await (await request('/', response)).text(), 'none')
    }
  })

  it('expires immediately for zero and negative Max-Age', async () => {
    let zero = createRequests({ maxAge: 0 })
    assert.equal(await (await zero('/', await zero('/start'))).text(), 'none')
    let negative = createRequests({ maxAge: -1 })
    assert.equal(await (await negative('/', await negative('/start'))).text(), 'none')
  })

  it('preserves sessions without a configured lifetime', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let request = createRequests({})
    let response = await request('/start')
    now += 365 * 24 * 60 * 60 * 1000
    assert.equal(await (await request('/', response)).text(), '123')
  })

  it('requires timestamped cookies when a lifetime is configured', async () => {
    let storage = createMemorySessionStorage()
    let previous = createRequests({}, storage)
    let response = await previous('/start')
    let current = createRequests({ maxAge: 60 }, storage)
    assert.equal(await (await current('/', response)).text(), 'none')
  })

  it('preserves the empty cookie value when a session is destroyed', async () => {
    let request = createRequests({ maxAge: 60 })
    let response = await request('/destroy', await request('/start'))
    let cookie = new SetCookie(response.headers.getSetCookie()[0])
    assert.equal(cookie.value, '')
    assert.equal(await (await request('/', response)).text(), 'none')
  })

  it('passes only unexpired storage values to a custom backend', async (t) => {
    let now = 1_000_000
    t.mock.method(Date, 'now', () => now)
    let storage = createMemorySessionStorage()
    let read = t.mock.method(storage, 'read')
    let save = t.mock.method(storage, 'save')
    let request = createRequests({ maxAge: 60 }, storage)
    let response = await request('/start')
    let storedValue = await save.mock.calls[0].result
    await request('/', response)
    assert.deepEqual(read.mock.calls[1].arguments, [storedValue])
    now += 60_000
    await request('/', response)
    assert.deepEqual(read.mock.calls[2].arguments, [null])
  })
})

function createRequests(
  options: CookieOptions,
  storage: SessionStorage = createCookieSessionStorage(),
) {
  let cookie = createCookie('__session', { secrets: ['test-secret'], ...options })
  let router = createRouter({ middleware: [session(cookie, storage)] })
  router.get('/start', ({ session }) => {
    session.set('userId', '123')
    return new Response('ok')
  })
  router.get('/update', ({ session }) => {
    session.set('updated', true)
    return new Response('ok')
  })
  router.get('/destroy', ({ session }) => {
    session.destroy()
    return new Response('ok')
  })
  router.get('/', ({ session }) => new Response(String(session.get('userId') ?? 'none')))

  return async (path: string, fromResponse?: Response) => {
    let headers = new Headers()
    if (fromResponse) {
      let cookie = new SetCookie(fromResponse.headers.getSetCookie()[0])
      headers.set('Cookie', `${cookie.name}=${cookie.value}`)
    }
    return router.fetch(`https://app.example${path}`, { headers })
  }
}
