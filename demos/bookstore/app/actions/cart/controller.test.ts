import * as assert from 'remix/assert'
import { afterEach, beforeEach, describe, it, mock } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  getSessionCookie,
  requestWithSession,
} from '../../../test/helpers.ts'
import { latency } from './api/controller.tsx'

const router = await createTestRouter()

describe('cart handlers', () => {
  let latencyMock: ReturnType<typeof mock.method>
  beforeEach(() => {
    latencyMock = mock.method(latency, 'wait', async () => {})
  })
  afterEach(() => latencyMock.mock.restore())

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

  it('GET /cart/items renders table fragment for cart items', async () => {
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

    let request = requestWithSession('https://remix.run/cart/items', sessionId)
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

  it('GET /cart/items renders totals and actions', async () => {
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

    let request = requestWithSession('https://remix.run/cart/items', sessionId)
    let response = await router.fetch(request)
    let html = await response.text()

    assert.equal(response.status, 200)
    assertContains(html, 'Total:')
    assertContains(html, '$16.99')
    assertContains(html, 'Continue Shopping')
    assertContains(html, 'Login to Checkout')
  })

  it('GET /cart/items renders empty state when cart is empty', async () => {
    let response = await router.fetch('https://remix.run/cart/items')
    let html = await response.text()

    assert.equal(response.status, 200)
    assertContains(html, 'Your cart is empty.')
    assertContains(html, 'Browse Books')
  })

  it('POST /cart/items saves quantity and redirects a document submission', async () => {
    let session = await cartSession()
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/items', session, {
        method: 'POST',
        body: new URLSearchParams({ bookId: '1', quantity: '3' }),
      }),
    )
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/cart')
    let cart = await router.fetch(requestWithSession('https://remix.run/cart', session))
    assertContains(await cart.text(), 'Total: $50.97')
  })

  it('POST /cart/items returns the updated HTML directly for frame submissions', async () => {
    let session = await cartSession()
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/items', session, {
        method: 'POST',
        headers: { 'X-Remix-Frame': 'true' },
        body: new URLSearchParams({ bookId: '1', quantity: '1e2' }),
      }),
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Location'), null)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    let html = await response.text()
    assertContains(html, 'Total: $1699.00')
    assertContains(html, 'action="/cart/items"')
    assert.ok(!html.includes('<html'))
  })

  it('supports HEAD and rejects unsupported item methods without changing the cart', async () => {
    let session = await cartSession()
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/items', session, {
        method: 'PUT',
        body: new URLSearchParams({ bookId: '1', quantity: '3' }),
      }),
    )
    assert.ok(response.status >= 400)
    let head = await router.fetch(
      requestWithSession('https://remix.run/cart/items', session, {
        method: 'HEAD',
      }),
    )
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
    let cart = await router.fetch(requestWithSession('https://remix.run/cart', session))
    assertContains(await cart.text(), 'Total: $16.99')
  })

  it('rejects invalid quantities and missing items without losing the cart', async () => {
    let session = await cartSession()
    for (let headers of [new Headers(), new Headers({ 'X-Remix-Frame': 'true' })]) {
      for (let quantity of ['', '0', '-1', '1.5', '2abc', '9007199254740992']) {
        let response = await router.fetch(
          requestWithSession('https://remix.run/cart/items', session, {
            method: 'POST',
            headers,
            body: new URLSearchParams({ bookId: '1', quantity }),
          }),
        )
        assert.equal(response.status, 400)
        assertContains(await response.text(), 'Invalid quantity')
      }
      let response = await router.fetch(
        requestWithSession('https://remix.run/cart/items', session, {
          method: 'POST',
          headers,
          body: new URLSearchParams({ bookId: '2', quantity: '3' }),
        }),
      )
      assert.equal(response.status, 404)
      assertContains(await response.text(), 'That book is no longer in your cart.')
    }
    let cart = await router.fetch(requestWithSession('https://remix.run/cart', session))
    assertContains(await cart.text(), 'Total: $16.99')
  })

  it('method-overridden DELETE removes the last item and redirects to the empty cart', async () => {
    let session = await cartSession()
    let response = await router.fetch(
      requestWithSession('https://remix.run/cart/items', session, {
        method: 'POST',
        body: new URLSearchParams({ _method: 'DELETE', bookId: '1' }),
      }),
    )
    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/cart')
    let cart = await router.fetch(requestWithSession('https://remix.run/cart', session))
    assertContains(await cart.text(), 'Your cart is empty.')
  })

  it('DELETE /cart/items removes only the requested item and is safe to retry', async () => {
    let session = await cartSession()
    await router.fetch(
      requestWithSession('https://remix.run/cart/api/add', session, {
        method: 'POST',
        body: new URLSearchParams({ bookId: '2' }),
      }),
    )
    for (let attempt = 0; attempt < 2; attempt++) {
      let response = await router.fetch(
        requestWithSession('https://remix.run/cart/items', session, {
          method: 'DELETE',
          headers: { 'X-Remix-Frame': 'true' },
          body: new URLSearchParams({ bookId: '1' }),
        }),
      )
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Location'), null)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      let html = await response.text()
      assert.ok(!html.includes('Ash &amp; Smoke'))
      assertContains(html, 'Heavy Metal Guitar Riffs')
      assertContains(html, 'Total: $27.00')
    }
  })

  it('rejects malformed item IDs and missing books before changing the cart', async () => {
    let session = await cartSession()
    for (let method of ['POST', 'DELETE']) {
      for (let bookId of ['', '0', '-1', '1.5', '1abc', '9007199254740992']) {
        let response = await router.fetch(
          requestWithSession('https://remix.run/cart/items', session, {
            method,
            headers: { 'X-Remix-Frame': 'true' },
            body: new URLSearchParams({ bookId, quantity: '3' }),
          }),
        )
        assert.equal(response.status, 400, `${method} ${bookId}`)
        assertContains(await response.text(), 'Invalid book.')
      }
      let missing = await router.fetch(
        requestWithSession('https://remix.run/cart/items', session, {
          method,
          headers: { 'X-Remix-Frame': 'true' },
          body: new URLSearchParams({ bookId: '999999', quantity: '3' }),
        }),
      )
      assert.equal(missing.status, 404)
    }
    let cart = await router.fetch(requestWithSession('https://remix.run/cart', session))
    assertContains(await cart.text(), 'Total: $16.99')
  })
})

async function cartSession(): Promise<string> {
  let response = await router.fetch('https://remix.run/cart/api/add', {
    method: 'POST',
    body: new URLSearchParams({ bookId: '1' }),
  })
  let session = getSessionCookie(response)
  assert.ok(session)
  return session
}
