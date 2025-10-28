import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { router } from './router.ts'
import {
  requestWithSession,
  assertContains,
  loginAsCustomer,
  assertNotContains,
} from '../test/helpers.ts'

describe('cart handlers', () => {
  it('POST /cart/api/add adds book to cart', async () => {
    let response = await router.fetch('http://localhost:3000/cart/api/add', {
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
    let sessionCookie = await loginAsCustomer(router)

    let request = requestWithSession('http://localhost:3000/cart', sessionCookie)
    let response = await router.fetch(request)

    assert.equal(response.status, 200)
    let html = await response.text()
    assertContains(html, 'Shopping Cart')
    assertNotContains(html, 'Heavy Metal Guitar Riffs')

    // First, add item to cart to get a session
    await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '002',
        slug: 'heavy-metal',
      }),
      headers: {
        Cookie: sessionCookie,
      },
      redirect: 'manual',
    })

    // Now view cart with session
    request = requestWithSession('http://localhost:3000/cart', sessionCookie)
    response = await router.fetch(request)

    assert.equal(response.status, 200)
    html = await response.text()
    assertContains(html, 'Shopping Cart')
    assertContains(html, 'Heavy Metal Guitar Riffs')
  })

  it('cart persists state across requests with same session', async () => {
    let sessionCookie = await loginAsCustomer(router)

    // Add first item
    await router.fetch('http://localhost:3000/cart/api/add', {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '001',
        slug: 'bbq',
      }),
      headers: {
        Cookie: sessionCookie,
      },
      redirect: 'manual',
    })

    // Add second item with same session
    let addRequest2 = requestWithSession('http://localhost:3000/cart/api/add', sessionCookie, {
      method: 'POST',
      body: new URLSearchParams({
        bookId: '003',
        slug: 'three-ways',
      }),
      headers: {
        Cookie: sessionCookie,
      },
      redirect: 'manual',
    })
    await router.fetch(addRequest2)

    // View cart - should have both items
    let cartRequest = requestWithSession('http://localhost:3000/cart', sessionCookie)
    let cartResponse = await router.fetch(cartRequest)

    let html = await cartResponse.text()
    assertContains(html, 'Ash & Smoke')
    assertContains(html, 'Three Ways to Change Your Life')
  })
})
