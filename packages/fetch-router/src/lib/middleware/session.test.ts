import * as assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { createCookie } from '@remix-run/cookie'
import { Cookie as CookieHeader, SetCookie as SetCookieHeader } from '@remix-run/headers'
import { Session } from '@remix-run/session'

import { redirect } from '../response-helpers/redirect.ts'
import { createRouter } from '../router.ts'
import { createRoutes as route } from '../route-map.ts'
import { session } from './session.ts'

describe('session middleware', () => {
  it('"just works" without any configuration (with a warning about the unsigned session cookie)', async () => {
    let consoleWarn = mock.method(console, 'warn', () => {})

    let routes = route({
      home: '/',
      login: '/login/:userId',
    })

    let router = createRouter({
      middleware: [session()],
    })

    router.get(routes.home, ({ session }) => {
      return new Response(`Hello ${session.get('userId') ?? 'guest'}`)
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

    assert.equal(consoleWarn.mock.calls.length, 1)
    assert.match(
      consoleWarn.mock.calls[0].arguments[0] as string,
      /Session cookie "remix_session" should be signed to prevent tampering/,
    )

    consoleWarn.mock.restore()
  })

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

  it('warns if the session cookie is not signed', () => {
    let consoleWarn = mock.method(console, 'warn', () => {})

    let unsignedCookie = createCookie('__sess')
    session(unsignedCookie)

    assert.equal(consoleWarn.mock.calls.length, 1)
    assert.match(
      consoleWarn.mock.calls[0].arguments[0] as string,
      /Session cookie "__sess" should be signed to prevent tampering/,
    )

    consoleWarn.mock.restore()
  })

  it('refuses to overwrite an existing session', async () => {
    let cookie = createCookie('__sess', {
      secrets: ['secret1'],
    })

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(cookie), session(cookie)],
    })

    router.get(routes.home, () => {
      return new Response('Home')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Existing session found, refusing to overwrite'))
  })

  it('refuses to save a session modified by another middleware/handler', async () => {
    let cookie = createCookie('__sess', {
      secrets: ['secret1'],
    })

    let routes = route({
      home: '/',
    })

    let router = createRouter({
      middleware: [session(cookie)],
    })

    router.get(routes.home, (context) => {
      context.session.set('userId', 'mj')
      // Overwrite the session with a new one
      context.session = new Session()
      return new Response('Home')
    })

    await assert.rejects(async () => {
      await router.fetch('https://remix.run')
    }, new Error('Cannot save session that was initialized by another middleware/handler'))
  })
})
