import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  assertContains,
  createTestRouter,
  getSessionCookie,
  requestWithSession,
} from '../../../test/helpers.ts'

const router = await createTestRouter()

describe('cart toggle', () => {
  it('redirects the button’s frame to its new button', async () => {
    let response = await router.fetch('https://remix.run/api/cart/toggle', {
      method: 'POST',
      headers: { 'X-Remix-Frame': 'true', 'X-Remix-Target': 'cart-button-1' },
      body: new URLSearchParams({ bookId: '1' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/fragments/cart-button/1')
    let sessionId = getSessionCookie(response)
    assert.ok(sessionId)
    let button = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-button/1', sessionId),
    )
    assertContains(await button.text(), 'Remove from Cart')
  })

  it('returns another frame’s submission to the page it came from', async () => {
    let response = await router.fetch('https://remix.run/api/cart/toggle', {
      method: 'POST',
      headers: {
        'X-Remix-Frame': 'true',
        'X-Remix-Target': 'cart-button-2',
        Referer: 'https://remix.run/books',
      },
      body: new URLSearchParams({ bookId: '1' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), 'https://remix.run/books')
  })

  it('removes a book that’s already in the cart', async () => {
    let first = await router.fetch('https://remix.run/api/cart/toggle', {
      method: 'POST',
      body: new URLSearchParams({ bookId: '1' }),
      redirect: 'manual',
    })
    let sessionId = getSessionCookie(first)
    assert.ok(sessionId)

    await router.fetch(
      requestWithSession('https://remix.run/api/cart/toggle', sessionId, {
        method: 'POST',
        body: new URLSearchParams({ bookId: '1' }),
      }),
    )

    let button = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-button/1', sessionId),
    )
    assertContains(await button.text(), 'Add to Cart')
  })

  it('returns a document submission to the page it came from', async () => {
    let response = await router.fetch('https://remix.run/api/cart/toggle', {
      method: 'POST',
      headers: { Referer: 'https://remix.run/books?page=2' },
      body: new URLSearchParams({ bookId: '1' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), 'https://remix.run/books?page=2')
  })

  it('sends a document submission from another site to the book', async () => {
    let response = await router.fetch('https://remix.run/api/cart/toggle', {
      method: 'POST',
      headers: { Referer: 'https://example.com/books' },
      body: new URLSearchParams({ bookId: '1' }),
      redirect: 'manual',
    })

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), '/books/bbq')
  })
})
