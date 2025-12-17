import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession, assertContains } from '../test/helpers.ts'

describe('cart handlers', () => {
  it('POST /cart/api/add adds book to cart', async () => {
    let response = await router.fetch('https://remix.run/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001',
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
        bookId: '002',
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
        bookId: '001',
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
        bookId: '003',
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
})
