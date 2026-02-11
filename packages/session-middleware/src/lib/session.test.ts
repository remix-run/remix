import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createCookie } from '@remix-run/cookie'
import { SetCookie } from '@remix-run/headers'
import { createSession } from '@remix-run/session'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { createRouter } from '@remix-run/fetch-router'

import { session as sessionMiddleware } from './session.ts'

// Create a new request using the cookie in the given response
function createRequest(fromResponse?: Response): Request {
  let headers = new Headers()
  if (fromResponse) {
    let setCookie = fromResponse.headers.getSetCookie()
    if (setCookie.length > 0) {
      let cookie = new SetCookie(setCookie[0])
      headers.append('Cookie', `${cookie.name}=${cookie.value}`)
    }
  }
  return new Request('https://remix.run', { headers })
}

describe('session middleware', () => {
  it('persists session data across requests', async () => {
    let cookie = createCookie('__sess', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.map('/', ({ session }) => {
      session.set('count', Number(session.get('count') ?? 0) + 1)
      return new Response(`Count: ${session.get('count')}`)
    })

    let response1 = await router.fetch('https://remix.run')
    assert.equal(await response1.text(), 'Count: 1')

    let response2 = await router.fetch(createRequest(response1))
    assert.equal(await response2.text(), 'Count: 2')

    let response3 = await router.fetch(createRequest(response2))
    assert.equal(await response3.text(), 'Count: 3')
  })

  it('throws if the session cookie is not signed', async () => {
    let cookie = createCookie('__sess', { secrets: [] })
    let storage = createCookieSessionStorage()

    assert.throws(() => {
      sessionMiddleware(cookie, storage)
    }, new Error('Session cookie must be signed'))
  })

  it('throws at request time if the session is already started', async () => {
    let cookie = createCookie('__sess', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [
        sessionMiddleware(cookie, storage),
        // The second session middleware should throw an error
        sessionMiddleware(cookie, storage),
      ],
    })

    router.map('/', () => new Response('Home'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Existing session found, refusing to overwrite'))
  })

  it('throws at request time if the session is modified by another middleware/handler', async () => {
    let cookie = createCookie('__sess', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.map('/', (context) => {
      context.session = createSession()
      return new Response('Home')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Cannot save session that was initialized by another middleware/handler'))
  })

  it('does not overwrite cookies set by other middleware/handlers', async () => {
    let cookie = createCookie('__sess', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [sessionMiddleware(cookie, storage)],
    })

    router.map('/', ({ session }) => {
      session.set('count', Number(session.get('count') ?? 0) + 1)
      return new Response(`Count: ${session.get('count')}`, {
        headers: {
          'Set-Cookie': `count=${session.get('count')}`,
        },
      })
    })

    let response = await router.fetch('https://remix.run')

    let setCookie = response.headers.getSetCookie()
    assert.equal(setCookie.length, 2)
  })
})
