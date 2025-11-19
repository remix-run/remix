import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { loginAsCustomer, requestWithSession, assertContains } from '../test/helpers.ts'

describe('account handlers', () => {
  it('GET /account redirects to login when not authenticated', async () => {
    let response = await router.fetch('https://remix.run/account')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login?returnTo=%2Faccount')
  })

  it('GET /account returns account page when authenticated', async () => {
    let sessionId = await loginAsCustomer(router)

    // Now access account page with session
    let request = requestWithSession('https://remix.run/account', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'My Account')
    assertContains(html, 'Account Information')
    assertContains(html, 'John Doe')
  })

  it('GET /account/orders/:orderId shows order for authenticated user', async () => {
    let sessionId = await loginAsCustomer(router)

    // Access existing order
    let request = requestWithSession('https://remix.run/account/orders/1001', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Order #1001')
    assertContains(html, 'The Midnight Library')
  })
})
