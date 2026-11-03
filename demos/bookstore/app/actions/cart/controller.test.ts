import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  getSessionCookie,
  requestWithSession,
} from '../../../test/helpers.ts'

const router = await createTestRouter()

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

  it('PUT /cart/api/update saves the quantity and redirects to the cart', async () => {
    let sessionId = await addToCart('1', 'bbq')

    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '3' }),
      }),
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/cart')
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Total: $50.97')
  })

  it('DELETE /cart/api/remove removes the book and redirects to the cart', async () => {
    let sessionId = await addToCart('1', 'bbq')

    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/remove', sessionId, {
        method: 'DELETE',
        body: new URLSearchParams({ bookId: '1' }),
      }),
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/cart')
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Your cart is empty.')
  })

  it('PUT /cart/api/update accepts exponent notation from number inputs', async () => {
    let sessionId = await addToCart('1', 'bbq')
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '1e2' }),
      }),
    )

    assert.equal(response.status, 302)
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Total: $1699.00')
  })

  it('PUT /cart/api/update rejects a fractional quantity without changing the cart', async () => {
    let sessionId = await addToCart('1', 'bbq')
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '1.5' }),
      }),
    )

    assert.equal(response.status, 400)
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Total: $16.99')
  })

  it('PUT /cart/api/update rejects an empty quantity without removing the book', async () => {
    let sessionId = await addToCart('1', 'bbq')
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '' }),
      }),
    )

    assert.equal(response.status, 400)
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Total: $16.99')
  })

  it('PUT /cart/api/update rejects zero without removing the book', async () => {
    let sessionId = await addToCart('1', 'bbq')
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '0' }),
      }),
    )

    assert.equal(response.status, 400)
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Total: $16.99')
  })

  it('PUT /cart/api/update rejects quantities outside the safe integer range', async () => {
    let sessionId = await addToCart('1', 'bbq')
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '9007199254740992' }),
      }),
    )

    assert.equal(response.status, 400)
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )
    assertContains(await cart.text(), 'Total: $16.99')
  })

  it('PUT /cart/api/update preserves other items when the submitted book is no longer in the cart', async () => {
    let sessionId = await addToCart('1', 'bbq')
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '3', quantity: '2' }),
      }),
    )
    let cart = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-items', sessionId),
    )

    assertContains(await cart.text(), 'Total: $16.99')
    assert.equal(response.status, 404)
  })

  it('PUT /cart/api/update redirects the cart frame to its items', async () => {
    let sessionId = await addToCart('1', 'bbq')

    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/update', sessionId, {
        method: 'PUT',
        headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'cart' },
        body: new URLSearchParams({ bookId: '1', quantity: '2' }),
      }),
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/fragments/cart-items')
  })

  it('DELETE /cart/api/remove redirects the cart frame to its items', async () => {
    let sessionId = await addToCart('1', 'bbq')

    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/api/remove', sessionId, {
        method: 'DELETE',
        headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'cart' },
        body: new URLSearchParams({ bookId: '1' }),
      }),
    )

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/fragments/cart-items')
  })

  it('GET /cart redirects the cart frame to its items', async () => {
    let response = await router.fetch('https://remix.run/cart', {
      headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'cart' },
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/fragments/cart-items')
  })

  it('GET /cart renders the page for another frame', async () => {
    let response = await router.fetch('https://remix.run/cart', {
      headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'cart-button-1' },
      redirect: 'manual',
    })

    assert.equal(response.status, 200)
    assertContains(await response.text(), 'Shopping Cart')
  })
})

async function addToCart(bookId: string, slug: string): Promise<string> {
  let response = await router.fetch('https://remix.run/cart/api/add', {
    method: 'POST',
    body: new URLSearchParams({ bookId, slug }),
    redirect: 'manual',
  })
  let sessionId = getSessionCookie(response)
  assert.ok(sessionId)
  return sessionId
}
