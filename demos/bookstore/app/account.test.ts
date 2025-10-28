import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { loginAsCustomer, requestWithSession, assertContains } from '../test/helpers.ts'

describe('account handlers', () => {
  it('GET /account redirects to login when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/account')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('GET /account returns account page when authenticated', async () => {
    let sessionCookie = await loginAsCustomer(router)

    // Now access account page with session
    let request = requestWithSession('http://localhost:3000/account', sessionCookie)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'My Account')
    assertContains(html, 'Account Information')
    assertContains(html, 'John Doe')
  })

  it('GET /account/orders/:orderId shows order for authenticated user', async () => {
    let sessionCookie = await loginAsCustomer(router)

    // Access existing order
    let request = requestWithSession('http://localhost:3000/account/orders/1001', sessionCookie)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Order #1001')
    assertContains(html, 'The Midnight Library')
  })
})
