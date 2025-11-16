import * as assert from 'node:assert/strict'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { describe, it } from 'node:test'

import { createRoutes } from '../route-map.ts'
import { createRouter } from '../router.ts'
import { compression, isCompressibleMediaType } from './compression.ts'

const gunzipAsync = promisify(gunzip)

describe('isCompressibleMediaType()', () => {
  it('returns true for common compressible media types', () => {
    assert.equal(isCompressibleMediaType('text/html'), true)
    assert.equal(isCompressibleMediaType('text/plain'), true)
    assert.equal(isCompressibleMediaType('application/json'), true)
    assert.equal(isCompressibleMediaType('application/javascript'), true)
    assert.equal(isCompressibleMediaType('text/css'), true)
  })

  it('returns true for text/* types', () => {
    assert.equal(isCompressibleMediaType('text/custom'), true)
    assert.equal(isCompressibleMediaType('text/markdown'), true)
  })

  it('returns true for types with +json, +text, or +xml suffix', () => {
    assert.equal(isCompressibleMediaType('application/vnd.api+json'), true)
    assert.equal(isCompressibleMediaType('application/custom+xml'), true)
    assert.equal(isCompressibleMediaType('application/something+text'), true)
  })

  it('returns false for non-compressible media types', () => {
    assert.equal(isCompressibleMediaType('image/png'), false)
    assert.equal(isCompressibleMediaType('image/jpeg'), false)
    assert.equal(isCompressibleMediaType('video/mp4'), false)
    assert.equal(isCompressibleMediaType('audio/mpeg'), false)
  })

  it('returns false for empty string', () => {
    assert.equal(isCompressibleMediaType(''), false)
  })
})

describe('compression()', () => {
  it('compresses compressible content types', async () => {
    let routes = createRoutes({
      home: '/',
    })

    let router = createRouter({
      middleware: [compression()],
    })

    router.map(routes.home, () => {
      return new Response('Hello, World!', {
        headers: { 'Content-Type': 'text/html' },
      })
    })

    let response = await router.fetch('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Encoding'), 'gzip')

    let buffer = Buffer.from(await response.arrayBuffer())
    let decompressed = await gunzipAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('does not compress non-compressible content types', async () => {
    let routes = createRoutes({
      image: '/image.png',
    })

    let router = createRouter({
      middleware: [compression()],
    })

    router.map(routes.image, () => {
      return new Response('fake image data', {
        headers: { 'Content-Type': 'image/png' },
      })
    })

    let response = await router.fetch('https://remix.run/image.png', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Encoding'), null)
    assert.equal(await response.text(), 'fake image data')
  })

  it('respects custom filterMediaType', async () => {
    let routes = createRoutes({
      json: '/data.json',
      html: '/page.html',
    })

    let router = createRouter({
      middleware: [
        compression({
          filterMediaType: (mediaType) => {
            // Only compress JSON
            return mediaType.includes('json')
          },
        }),
      ],
    })

    router.map(routes.json, () => {
      return new Response('{"data":"value"}', {
        headers: { 'Content-Type': 'application/json' },
      })
    })

    router.map(routes.html, () => {
      return new Response('<html>test</html>', {
        headers: { 'Content-Type': 'text/html' },
      })
    })

    let jsonResponse = await router.fetch('https://remix.run/data.json', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(jsonResponse.headers.get('Content-Encoding'), 'gzip')

    let htmlResponse = await router.fetch('https://remix.run/page.html', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(htmlResponse.headers.get('Content-Encoding'), null)
    assert.equal(await htmlResponse.text(), '<html>test</html>')
  })

  it('allows custom filterMediaType to use isCompressibleMediaType', async () => {
    let routes = createRoutes({
      json: '/data.json',
      html: '/page.html',
    })

    let router = createRouter({
      middleware: [
        compression({
          filterMediaType: (mediaType) => {
            // Only compress if it's compressible AND not HTML
            return isCompressibleMediaType(mediaType) && !mediaType.includes('html')
          },
        }),
      ],
    })

    router.map(routes.json, () => {
      return new Response('{"data":"value"}', {
        headers: { 'Content-Type': 'application/json' },
      })
    })

    router.map(routes.html, () => {
      return new Response('<html>test</html>', {
        headers: { 'Content-Type': 'text/html' },
      })
    })

    let jsonResponse = await router.fetch('https://remix.run/data.json', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(jsonResponse.headers.get('Content-Encoding'), 'gzip')

    let htmlResponse = await router.fetch('https://remix.run/page.html', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    // HTML is compressible but our custom filter excludes it
    assert.equal(htmlResponse.headers.get('Content-Encoding'), null)
    assert.equal(await htmlResponse.text(), '<html>test</html>')
  })
})
