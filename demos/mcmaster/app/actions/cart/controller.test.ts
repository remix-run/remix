import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter, getCookiePair, origin } from '../../../test/helpers.ts'

const router = await createTestRouter()

function addToCart(partNumber: string, quantity: string, headers?: HeadersInit) {
  return router.fetch(`${origin}/cart/add`, {
    method: 'POST',
    body: new URLSearchParams({ partNumber, quantity }),
    headers,
  })
}

describe('cart', () => {
  it('adds a part and redirects back to the page that submitted the form', async () => {
    let response = await addToCart('1000A003', '3', {
      Referer: `${origin}/parts/1000A003`,
    })

    assert.equal(response.status, 303)
    assert.equal(response.headers.get('Location'), '/parts/1000A003')
  })

  it('redirects to the cart when the referring page is on another site', async () => {
    let response = await addToCart('1000A003', '1', { Referer: 'https://elsewhere.example/' })

    assert.equal(response.headers.get('Location'), '/cart')
  })

  it('shows added parts in the cart summary frame', async () => {
    let first = await addToCart('1000A003', '3')
    let session = getCookiePair(first, 'session')
    let second = await addToCart('1000A003', '2', { Cookie: session })

    let summary = await router.fetch(`${origin}/fragments/cart-summary`, {
      headers: { Cookie: getCookiePair(second, 'session') },
    })

    assert.equal(summary.headers.get('Cache-Control'), 'private, no-store')
    assert.match(await summary.text(), /5 items · \$54\.00/)
  })

  it('updates quantities and removes lines set to zero', async () => {
    let added = await addToCart('1000A003', '3')
    let updated = await router.fetch(`${origin}/cart/update`, {
      method: 'POST',
      body: new URLSearchParams({ partNumber: '1000A003', quantity: '0' }),
      headers: { Cookie: getCookiePair(added, 'session') },
    })

    let cart = await router.fetch(`${origin}/cart`, {
      headers: { Cookie: getCookiePair(updated, 'session') },
    })

    assert.equal(updated.headers.get('Location'), '/cart')
    assert.match(await cart.text(), /Your order is empty/)
  })

  it('removes a line', async () => {
    let added = await addToCart('1000A003', '3')
    let removed = await router.fetch(`${origin}/cart/remove`, {
      method: 'POST',
      body: new URLSearchParams({ partNumber: '1000A003' }),
      headers: { Cookie: getCookiePair(added, 'session') },
    })

    let summary = await router.fetch(`${origin}/fragments/cart-summary`, {
      headers: { Cookie: getCookiePair(removed, 'session') },
    })

    assert.match(await summary.text(), /0 items/)
  })

  it('rejects quantities that are not whole numbers between 1 and 999', async () => {
    let statuses = await Promise.all(
      ['0', '2.5', '1000', 'lots'].map(async (quantity) => {
        let response = await addToCart('1000A003', quantity)
        return response.status
      }),
    )

    assert.deepEqual(statuses, [400, 400, 400, 400])
  })

  it('rejects unknown parts', async () => {
    let response = await addToCart('00000A000', '1')

    assert.equal(response.status, 404)
  })

  it('keeps the cart page out of shared caches', async () => {
    let response = await router.fetch(`${origin}/cart`, {
      headers: { Accept: 'text/html', 'X-Remix-Frame': 'true', 'X-Remix-Target': 'content' },
    })

    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(response.headers.get('ETag'), null)
  })
})
