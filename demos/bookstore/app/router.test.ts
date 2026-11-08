import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { createTestRouter } from '../test/helpers.ts'

const router = await createTestRouter()

describe('router', () => {
  it('responds to basic GET request', async () => {
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.ok(response.headers.get('Content-Security-Policy'))

    let html = await response.text()
    assert.ok(html.includes('Welcome to the Bookstore'))
  })

  it('returns 404 for unknown routes', async () => {
    let response = await router.fetch('https://remix.run/does-not-exist')

    assert.equal(response.status, 404)
  })

  it('serves fingerprinted, immutable images shared by catalog and product pages', async () => {
    let response = await router.fetch('https://remix.run/')
    let html = await response.text()
    let cover = html.match(/src="(\/assets\/app\/images\/bbq-1\.@[\w-]+\.png)"/)
    assert.ok(cover)

    let image = await router.fetch(new URL(cover[1], 'https://remix.run'))
    assert.equal(image.status, 200)
    assert.equal(image.headers.get('Content-Type'), 'image/png')
    assert.equal(image.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
    assert.deepEqual(
      new Uint8Array(await image.arrayBuffer()).slice(0, 8),
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    )

    let product = await router.fetch('https://remix.run/books/bbq')
    let productHtml = await product.text()
    let preload = productHtml.match(
      /<link rel="preload" as="image" href="(\/assets\/app\/images\/bbq-1\.@[\w-]+\.png)"/,
    )
    assert.ok(preload)
    assert.equal(preload[1], cover[1])

    let staticImage = await router.fetch('https://remix.run/images/bbq-1.png')
    assert.equal(staticImage.status, 404)
    await staticImage.text()
  })

  it('caches successful browsing frame GETs privately for 30 seconds', async () => {
    for (let path of [
      '/',
      '/books',
      '/books/genre/cookbook',
      '/books/bbq',
      '/search?q=smoke',
      '/about',
      '/contact',
      '/register',
    ]) {
      let response = await router.fetch(`https://remix.run${path}`, {
        headers: { 'X-Remix-Frame': 'true' },
      })

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'private, max-age=30')
      assert.equal(
        response.headers.get('Vary')?.toLowerCase(),
        'cookie, x-remix-frame, x-remix-target, x-remix-top-frame-src, accept-encoding',
      )
      await response.text()
    }
  })

  it('keeps browsing document responses uncached', async () => {
    for (let path of [
      '/',
      '/books',
      '/books/genre/cookbook',
      '/books/bbq',
      '/search?q=smoke',
      '/about',
      '/contact',
      '/register',
    ]) {
      let response = await router.fetch(`https://remix.run${path}`)

      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.equal(response.headers.get('Vary')?.toLowerCase(), 'accept-encoding')
      await response.text()
    }
  })

  it('keeps cart documents and frames uncached', async () => {
    let document = await router.fetch('https://remix.run/cart')
    assert.equal(document.status, 200)
    assert.equal(document.headers.get('Cache-Control'), 'no-store')
    await document.text()

    let frame = await router.fetch('https://remix.run/cart', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    assert.equal(frame.status, 200)
    assert.equal(frame.headers.get('Cache-Control'), 'no-store')
    await frame.text()
  })

  it('does not opt cart fragments or missing books into caching', async () => {
    let cart = await router.fetch('https://remix.run/fragments/cart-items', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    assert.equal(cart.status, 200)
    assert.equal(cart.headers.get('Cache-Control'), 'no-store')
    await cart.text()

    let missing = await router.fetch('https://remix.run/books/does-not-exist', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('Cache-Control'), null)
    await missing.text()
  })
})
