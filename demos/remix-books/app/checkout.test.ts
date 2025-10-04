import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession } from '../test/helpers.ts'

describe('checkout handlers', () => {
  it('GET /checkout redirects when not authenticated', async () => {
    let response = await router.fetch('http://localhost:3000/checkout')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/login')
  })

  it('POST /checkout creates order when authenticated with items in cart', async () => {
    // Log in first
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

    // Add item to cart
    let addRequest = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '5',
        slug: 'dune',
      }),
    })
    await router.fetch(addRequest)

    // Submit checkout
    let checkoutRequest = requestWithSession('http://localhost:3000/checkout', sessionId, {
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
