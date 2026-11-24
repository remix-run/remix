import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import sharp from 'sharp'

import { createTestRouter } from '../test/helpers.ts'
import { assets } from './utils/assets.ts'

const router = await createTestRouter()

describe('router', () => {
  it('responds to basic GET request', async () => {
    let response = await router.fetch('https://remix.run/')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/html; charset=UTF-8')
    assert.ok(response.headers.get('Content-Security-Policy'))

    let html = await response.text()
    assert.ok(html.includes('Welcome to the Record Store'))
  })

  it('returns 404 for unknown routes', async () => {
    let response = await router.fetch('https://remix.run/does-not-exist')

    assert.equal(response.status, 404)
  })

  it('serves responsive WebP variants shared by catalog and product pages with immutable fingerprints', async () => {
    let response = await router.fetch('https://remix.run/albums')
    let html = await response.text()
    let cover = html.match(
      /src="(\/assets\/app\/images\/bbq-1\.@[\w-]+\.png\?transform=album-image-640)"/,
    )
    assert.ok(cover)

    let original = await readFile(new URL('./images/bbq-1.png', import.meta.url))
    let srcSet = html.match(/<img[^>]+srcset="([^"]+)"/)
    assert.ok(srcSet)
    let candidates = srcSet[1].split(', ')
    assert.equal(candidates.length, 5)
    assert.ok(candidates.includes(`${cover[1]} 640w`))
    for (let candidate of candidates) {
      let [href, descriptor] = candidate.split(' ')
      let variant = await router.fetch(new URL(href, 'https://remix.run'))
      assert.equal(variant.status, 200)
      assert.equal(variant.headers.get('Content-Type'), 'image/webp')
      assert.equal(variant.headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
      let bytes = new Uint8Array(await variant.arrayBuffer())
      let size = await sharp(bytes).metadata()
      assert.equal(size.format, 'webp')
      assert.equal(size.width, Number.parseInt(descriptor))
      assert.equal(size.height, size.width)
      assert.ok(bytes.byteLength < original.byteLength)
      if (href === cover[1]) assert.ok(bytes.byteLength < original.byteLength / 4)
    }

    let sourceHref = await assets.getHref(
      fileURLToPath(new URL('./images/bbq-1.png', import.meta.url)),
    )
    let source = await router.fetch(new URL(sourceHref, 'https://remix.run'))
    assert.equal(source.headers.get('Content-Type'), 'image/png')
    assert.deepEqual(new Uint8Array(await source.arrayBuffer()), new Uint8Array(original))

    let product = await router.fetch('https://remix.run/albums/bbq')
    let productHtml = await product.text()
    let preload = productHtml.match(
      /<link rel="preload" as="image"[^>]* href="(\/assets\/app\/images\/bbq-1\.@[\w-]+\.png\?transform=album-image-640)"/,
    )
    assert.ok(preload)
    let productHead = productHtml.match(/<head>([\s\S]*?)<\/head>/)?.[1]
    assert.ok(productHead)
    assert.ok(productHead.indexOf(preload[0]) < productHead.indexOf('<link rel="stylesheet"'))
    assert.ok(productHead.indexOf(preload[0]) < productHead.indexOf('<script'))
    assert.equal(preload[1], cover[1])
    assert.equal(productHtml.match(/<link[^>]+imagesrcset="([^"]+)"/)?.[1], srcSet[1])
    assert.equal(productHtml.match(/<img[^>]+srcset="([^"]+)"/)?.[1], srcSet[1])
    assert.equal(
      productHtml.match(/<link[^>]+imagesizes="([^"]+)"/)?.[1],
      productHtml.match(/<img[^>]+sizes="([^"]+)"/)?.[1],
    )

    let staticImage = await router.fetch('https://remix.run/images/bbq-1.png')
    assert.equal(staticImage.status, 404)
    await staticImage.text()
  })

  it('caches browsing frames privately for 30 seconds while keeping documents uncached', async () => {
    for (let path of [
      '/',
      '/albums',
      '/albums/genre/cookbook',
      '/albums/bbq',
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
        response.headers.get('Vary'),
        'Cookie, X-Remix-Frame, X-Remix-Target, X-Remix-Top-Frame-Src, Accept-Encoding',
      )
      await response.text()
      let document = await router.fetch(`https://remix.run${path}`)
      assert.equal(document.status, 200)
      assert.equal(document.headers.get('Cache-Control'), 'no-store')
      assert.equal(document.headers.get('Vary'), 'Accept-Encoding')
      await document.text()
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

  it('does not opt cart fragments or missing albums into caching', async () => {
    let cart = await router.fetch('https://remix.run/cart/items', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    assert.equal(cart.status, 200)
    assert.equal(cart.headers.get('Cache-Control'), 'no-store')
    await cart.text()

    let missing = await router.fetch('https://remix.run/albums/does-not-exist', {
      headers: { 'X-Remix-Frame': 'true' },
    })
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('Cache-Control'), null)
    await missing.text()
  })
})
