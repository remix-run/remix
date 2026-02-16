import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession, assertContains } from '../test/helpers.ts'

describe('cart handlers', () => {
  it('POST /cart/api/add adds book to cart', async () => {
    let response = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/cart'))
  })

  it('GET /cart shows cart items', async () => {
    // First, add item to cart to get a session
    let addResponse = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '2',
        slug: 'heavy-metal',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    // Now view cart with session
    let request = requestWithSession('https://remix.run/cart', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Shopping Cart')
    assertContains(html, 'Heavy Metal Guitar Riffs')
  })

  it('cart persists state across requests with same session', async () => {
    // Add first item
    let addResponse1 = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse1)
    assert.ok(sessionId)

    // Add second item with same session
    let addRequest2 = requestWithSession('https://remix.run/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '3',
        slug: 'three-ways',
      }),
    })
    await router.fetch(addRequest2)

    // View cart - should have both items
    let cartRequest = requestWithSession('https://remix.run/cart', sessionId)
    let cartResponse = await router.fetch(cartRequest)

    let html = await cartResponse.text()
    assertContains(html, 'Ash & Smoke')
    assertContains(html, 'Three Ways to Change Your Life')
  })

  it('GET /fragments/cart-items renders table fragment for cart items', async () => {
    let addResponse = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '2',
        slug: 'heavy-metal',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    let request = requestWithSession('https://remix.run/fragments/cart-items', sessionId)
    let response = await router.fetch(request)
    let html = await response.text()

    assert.equal(response.status, 200)
    assertContains(html, '<table>')
    assertContains(html, '<th>Book</th>')
    assertContains(html, 'Heavy Metal Guitar Riffs')
    assertContains(html, 'Update')
    assertContains(html, 'Remove')
    assertContains(html, 'Total:')
  })

  it('GET /fragments/cart-items renders totals and actions', async () => {
    let addResponse = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    let request = requestWithSession('https://remix.run/fragments/cart-items', sessionId)
    let response = await router.fetch(request)
    let html = await response.text()

    assert.equal(response.status, 200)
    assertContains(html, 'Total:')
    assertContains(html, '$16.99')
    assertContains(html, 'Continue Shopping')
    assertContains(html, 'Login to Checkout')
  })

  it('GET /fragments/cart-items renders empty state when cart is empty', async () => {
    let response = await router.fetch('https://remix.run/fragments/cart-items')
    let html = await response.text()

    assert.equal(response.status, 200)
    assertContains(html, 'Your cart is empty.')
    assertContains(html, 'Browse Books')
  })

  it('PUT /cart/api/update returns 204 when redirect is none', async () => {
    let addResponse = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    let request = requestWithSession('https://remix.run/cart/api/update', sessionId, {
      method: 'PUT',
      body: new URLSearchParams({
        bookId: '1',
        quantity: '2',
        redirect: 'none',
      }),
    })
    let response = await router.fetch(request)

    assert.equal(response.status, 204)
  })

  it('DELETE /cart/api/remove returns 204 when redirect is none', async () => {
    let addResponse = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'bbq',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    let request = requestWithSession('https://remix.run/cart/api/remove', sessionId, {
      method: 'DELETE',
      body: new URLSearchParams({
        bookId: '1',
        redirect: 'none',
      }),
    })
    let response = await router.fetch(request)

    assert.equal(response.status, 204)
  })
})
