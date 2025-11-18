import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, loginAsCustomer, requestWithSession } from '../test/helpers.ts'

describe('checkout handlers', () => {
  it('GET /checkout redirects when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/checkout')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('POST /checkout creates order when authenticated with items in cart', async () => {
    let sessionCookie = await loginAsCustomer(router)

    // Add item to cart
    let addRequest = requestWithSession('http://localhost:3000/cart/api/add', sessionCookie, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001',
        slug: 'bbq',
      }),
    })
    let addResponse = await router.fetch(addRequest)

    // Get updated session cookie after cart modification
    sessionCookie = getSessionCookie(addResponse) ?? sessionCookie

    // Submit checkout
    let checkoutRequest = requestWithSession('http://localhost:3000/checkout', sessionCookie, {
      method: 'POST',
      body: new URLSearchParams({
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
      }),
    })
    let checkoutResponse = await router.fetch(checkoutRequest)

    assert.equal(checkoutResponse.status, 302)
    assert.ok(checkoutResponse.headers.get('Location')?.includes('/checkout/'))
    assert.ok(checkoutResponse.headers.get('Location')?.includes('/confirmation'))
  })
})
