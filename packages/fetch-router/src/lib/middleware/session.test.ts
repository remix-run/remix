import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCookie } from '@remix-run/cookie'
import { SetCookie } from '@remix-run/headers'
import { createSession } from '@remix-run/session'
import { createCookieStorage } from '@remix-run/session/cookie-storage'

import { createRouter } from '../router.ts'
import { createRoutes as route } from '../route-map.ts'
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
    let storage = createCookieStorage(createCookie('__sess', { secrets: ['secret1'] }))

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [sessionMiddleware(storage)],
    })

    router.get(routes.home, ({ session }) => {
      session.set('count', ((session.get('count') as number | undefined) ?? 0) + 1)
      return new Response(`Count: ${session.get('count')}`)
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(await response.text(), 'Count: 1')

    response = await router.fetch(createRequest(response))
    assert.equal(await response.text(), 'Count: 2')

    response = await router.fetch(createRequest(response))
    assert.equal(await response.text(), 'Count: 3')
  })

  it('throws an error if the session is already started', async () => {
    let storage = createCookieStorage(createCookie('__sess', { secrets: ['secret1'] }))

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [
        sessionMiddleware(storage),
        // The second session middleware should throw an error
        sessionMiddleware(storage),
      ],
    })

    router.get(routes.home, () => {
      return new Response('Home')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Existing session found, refusing to overwrite'))
  })

  it('refuses to save a session modified by another middleware/handler', async () => {
    let storage = createCookieStorage(createCookie('__sess', { secrets: ['secret1'] }))

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [sessionMiddleware(storage)],
    })

    router.get(routes.home, (context) => {
      context.session.set('userId', 'mj')
      // Overwrite the session with a new one
      context.session = createSession()
      return new Response('Home')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Cannot save session that was initialized by another middleware/handler'))
  })
})
