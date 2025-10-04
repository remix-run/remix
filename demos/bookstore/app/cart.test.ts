import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import { getSessionCookie, requestWithSession, assertContains } from '../test/helpers.ts'

describe('cart handlers', () => {
  it('POST /cart/api/add adds book to cart', async () => {
    let response = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'the-midnight-library',
      }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.ok(response.headers.get('Location')?.includes('/cart'))
  })

  it('GET /cart shows cart items', async () => {
    // First, add item to cart to get a session
    let addResponse = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '2',
        slug: 'atomic-habits',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse)
    assert.ok(sessionId)

    // Now view cart with session
    let request = requestWithSession('http://localhost:3000/cart', sessionId)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Shopping Cart')
    assertContains(html, 'Atomic Habits')
  })

  it('cart persists state across requests with same session', async () => {
    // Add first item
    let addResponse1 = await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '1',
        slug: 'the-midnight-library',
      }),
      redirect: 'manual',
    })

    let sessionId = getSessionCookie(addResponse1)
    assert.ok(sessionId)

    // Add second item with same session
    let addRequest2 = requestWithSession('http://localhost:3000/cart/api/add', sessionId, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '3',
        slug: 'project-hail-mary',
      }),
    })
    await router.fetch(addRequest2)

    // View cart - should have both items
    let cartRequest = requestWithSession('http://localhost:3000/cart', sessionId)
    let cartResponse = await router.fetch(cartRequest)

    let html = await cartResponse.text()
    assertContains(html, 'The Midnight Library')
    assertContains(html, 'Project Hail Mary')
  })
})
