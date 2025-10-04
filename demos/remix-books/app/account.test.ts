import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession, assertContains } from '../test/helpers.ts'

describe('account handlers', () => {
  it('GET /account redirects to login when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/account')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('GET /account returns account page when authenticated', async () => {
    // First, log in to get a session
    let loginResponse = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(loginResponse)
    assert.ok(sessionId)

    // Now access account page with session
    let request = requestWithSession('http://localhost:3000/account', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'My Account')
    assertContains(html, 'Account Information')
    assertContains(html, 'John Doe')
  })

  it('GET /account/orders/:orderId shows order for authenticated user', async () => {
    // Log in as customer who has orders
    let loginResponse = await router.fetch('http://localhost:3000/login', {
      method: 'POST',
      body: new URLSearchParams({
        email: 'customer@example.com',
        password: 'password123',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(loginResponse)
    assert.ok(sessionId)

    // Access existing order
    let request = requestWithSession('http://localhost:3000/account/orders/1001', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Order #1001')
    assertContains(html, 'The Midnight Library')
  })
})
