import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createCookie } from '@remix-run/cookie'
import { createRouter } from '@remix-run/fetch-router'
import { formData } from '@remix-run/form-data-middleware'
import { createCookieSessionStorage } from '@remix-run/session/cookie-storage'
import { session } from '@remix-run/session-middleware'

import { csrf, getCsrfToken } from './csrf.ts'

function createRequest(fromResponse?: Response, init?: RequestInit): Request {
  let headers = new Headers(init?.headers)

  if (fromResponse) {
    let cookies = fromResponse.headers
      .getSetCookie()
      .map((setCookieValue) => setCookieValue.split(';', 1)[0])
      .join('; ')

    if (cookies !== '') {
      headers.set('Cookie', cookies)
    }
  }

  return new Request('https://remix.run/', {
    ...init,
    headers,
  })
}

describe('csrf middleware', () => {
  it('creates and stores a token on safe requests', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), csrf()],
    })

    router.get('/', (context) => {
      let token = getCsrfToken(context)
      return new Response(token)
    })

    let response = await router.fetch('https://remix.run/')
    let token = await response.text()

    assert.equal(response.status, 200)
    assert.equal(token.length, 64)
  })

  it('accepts a valid token from request headers', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), csrf()],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')
    let token = await tokenResponse.text()

    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': token,
      },
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
  })

  it('rejects unsafe requests with a missing token', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), csrf()],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')
    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'Forbidden: missing CSRF token')
  })

  it('rejects unsafe requests with an invalid token', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), csrf()],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')

    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
      headers: {
        'X-Csrf-Token': 'invalid-token',
      },
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'Forbidden: invalid CSRF token')
  })

  it('validates form field tokens when formData middleware is enabled', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), formData(), csrf()],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')
    let token = await tokenResponse.text()

    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `_csrf=${encodeURIComponent(token)}`,
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
  })

  it('rejects unsafe requests with invalid origin by default', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), csrf()],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')
    let token = await tokenResponse.text()

    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
      headers: {
        Origin: 'https://evil.example',
        'X-Csrf-Token': token,
      },
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 403)
    assert.equal(await response.text(), 'Forbidden: invalid CSRF origin')
  })

  it('supports custom origin matching', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [session(cookie, storage), csrf({ origin: ['https://admin.example.com'] })],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')
    let token = await tokenResponse.text()

    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
      headers: {
        Origin: 'https://admin.example.com',
        'X-Csrf-Token': token,
      },
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
  })

  it('supports custom token value extractors', async () => {
    let cookie = createCookie('__session', { secrets: ['secret1'] })
    let storage = createCookieSessionStorage()

    let router = createRouter({
      middleware: [
        session(cookie, storage),
        csrf({
          value(context) {
            return context.headers.get('X-Custom-Csrf')
          },
        }),
      ],
    })

    router.get('/', (context) => new Response(getCsrfToken(context)))
    router.post('/', () => new Response('ok'))

    let tokenResponse = await router.fetch('https://remix.run/')
    let token = await tokenResponse.text()

    let postRequest = createRequest(tokenResponse, {
      method: 'POST',
      headers: {
        'X-Custom-Csrf': token,
      },
    })

    let response = await router.fetch(postRequest)

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
  })

  it('throws when session middleware is not registered', async () => {
    let router = createRouter({
      middleware: [csrf()],
    })

    router.post('/', () => new Response('ok'))

    await assert.rejects(async () => {
      await router.fetch('https://remix.run/', {
        method: 'POST',
      })
    }, new Error('csrf middleware requires session() middleware to run before it'))
  })
})
