import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createCookie } from '@remix-run/cookie'
import { Cookie as CookieHeader, SetCookie as SetCookieHeader } from '@remix-run/headers'

import { redirect } from '../response-helpers/redirect.ts'
import { createRouter } from '../router.ts'
import { createRoutes as route } from '../route-map.ts'
import { session } from './session.ts'

describe('session middleware', () => {
  it('reads and writes the session using cookies', async () => {
    let sessionCookie = createCookie('__sess', {
      secrets: ['secret1'],
    })

    let routes = route({
      home: '/',
      login: '/login/:userId',
    })

    let router = createRouter({
      middleware: [session(sessionCookie)],
    })

    router.get(routes.home, ({ session }) => {
      let userId = session.get('userId') ?? 'guest'
      return new Response(`Hello ${userId}`)
    })

    router.post(routes.login, ({ session, params }) => {
      session.set('userId', params.userId)
      return redirect(routes.home.href())
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello guest')

    response = await router.fetch('https://remix.run/login/mj', {
      method: 'POST',
    })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')

    // TODO: Could be useful to have a "cookie jar" helper to manage cookies across requests
    let setCookie = new SetCookieHeader(response.headers.get('Set-Cookie') ?? '')
    let cookie = new CookieHeader([[setCookie.name!, setCookie.value!]])

    response = await router.fetch('https://remix.run', {
      headers: {
        Cookie: cookie.toString(),
      },
    })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello mj')
  })

  it('uses custom cookie properties', async () => {
    let sessionCookie = createCookie('__sess', {
      secrets: ['secret1'],
    })

    let routes = route({
      home: '/',
      login: '/login/:userId',
    })

    let router = createRouter({
      middleware: [
        session(sessionCookie, {
          cookie: {
            domain: 'remix.run',
            path: '/admin',
            secure: true,
            httpOnly: true,
          },
        }),
      ],
    })

    router.get(routes.home, ({ session }) => {
      let userId = session.get('userId') ?? 'guest'
      return new Response(`Hello ${userId}`)
    })

    router.post(routes.login, ({ session, params }) => {
      session.set('userId', params.userId)
      return redirect(routes.home.href())
    })

    let response = await router.fetch('https://remix.run')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Hello guest')

    response = await router.fetch('https://remix.run/login/mj', {
      method: 'POST',
    })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/')

    let setCookie = new SetCookieHeader(response.headers.get('Set-Cookie') ?? '')
    assert.equal(setCookie.domain, 'remix.run')
    assert.equal(setCookie.path, '/admin')
    assert.equal(setCookie.secure, true)
    assert.equal(setCookie.httpOnly, true)
  })
})
