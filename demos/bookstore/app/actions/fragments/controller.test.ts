import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter, getSessionCookie, requestWithSession } from '../../../test/helpers.ts'

const router = await createTestRouter()

describe('cart button handlers', () => {
  it('uses a same-origin referrer for native redirects and falls back to home', async () => {
    for (let referrer of ['', 'not a URL', 'https://other.example/books']) {
      let response = await router.fetch('https://remix.run/fragments/cart-button/1', {
        method: 'POST',
        headers: { Referer: referrer },
      })
      assert.equal(response.status, 303)
      assert.equal(response.headers.get('Location'), '/')
    }

    let response = await router.fetch('https://remix.run/fragments/cart-button/1', {
      method: 'POST',
      headers: { Referer: 'https://remix.run//other.example/books?from=catalog' },
    })
    assert.equal(response.status, 303)
    assert.equal(
      response.headers.get('Location'),
      'https://remix.run//other.example/books?from=catalog',
    )
  })

  it('rejects missing books before mutating the cart', async () => {
    let added = await router.fetch('https://remix.run/fragments/cart-button/1', { method: 'POST' })
    let session = getSessionCookie(added)
    assert.ok(session)
    for (let bookId of ['invalid', '999999']) {
      let response = await router.fetch(
        requestWithSession(`https://remix.run/fragments/cart-button/${bookId}`, session, {
          method: 'POST',
          headers: { 'X-Remix-Frame': 'true' },
        }),
      )
      assert.equal(response.status, 404)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.match(await response.text(), /Book not found/)
    }
    let response = await router.fetch(
      requestWithSession('https://remix.run/fragments/cart-button/1', session),
    )
    assert.match(await response.text(), /Remove from Cart/)
  })
})
