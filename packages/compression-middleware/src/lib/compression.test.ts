import * as assert from 'node:assert/strict'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'
import { describe, it } from 'node:test'
import { createRouter } from '@remix-run/fetch-router'
import { isCompressibleMimeType } from '@remix-run/mime'

import { compression } from './compression.ts'

const gunzipAsync = promisify(gunzip)

describe('compression()', () => {
  it('compresses compressible content types', async () => {
    let router = createRouter({
      middleware: [compression()],
    })

    router.get(
      '/',
      () =>
        new Response('Hello, World!', {
          headers: { 'Content-Type': 'text/html' },
        }),
    )

    let response = await router.fetch('https://remix.run/', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Encoding'), 'gzip')

    let buffer = Buffer.from(await response.arrayBuffer())
    let decompressed = await gunzipAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('does not compress non-compressible content types', async () => {
    let router = createRouter({
      middleware: [compression()],
    })

    router.get(
      '/image.png',
      () =>
        new Response('fake image data', {
          headers: { 'Content-Type': 'image/png' },
        }),
    )

    let response = await router.fetch('https://remix.run/image.png', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Encoding'), null)
    assert.equal(await response.text(), 'fake image data')
  })

  it('respects threshold option', async () => {
    let router = createRouter({
      middleware: [compression({ threshold: 10 })],
    })

    router.get(
      '/',
      () =>
        new Response('Small', {
          headers: { 'Content-Type': 'text/plain', 'Content-Length': '5' },
        }),
    )

    let response = await router.fetch('https://remix.run/', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.headers.get('Content-Encoding'), null)
    assert.equal(await response.text(), 'Small')
  })

  it('compresses responses when Content-Length is not set', async () => {
    let router = createRouter({
      middleware: [compression({ threshold: 1024 })],
    })

    router.get(
      '/',
      () =>
        // Small response without Content-Length header
        new Response('Small', {
          headers: { 'Content-Type': 'text/plain' },
        }),
    )

    let response = await router.fetch('https://remix.run/', {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    // Should compress because threshold check requires Content-Length
    assert.equal(response.headers.get('Content-Encoding'), 'gzip')
  })

  it('respects custom filterMediaType', async () => {
    let router = createRouter({
      middleware: [
        compression({
          filterMediaType: (mediaType) =>
            // Only compress JSON
            mediaType.includes('json'),
        }),
      ],
    })

    router.get(
      '/data.json',
      () =>
        new Response('{"data":"value"}', {
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    router.get(
      '/page.html',
      () =>
        new Response('<html>test</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    )

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

  it('allows custom filterMediaType to use isCompressibleMimeType', async () => {
    let router = createRouter({
      middleware: [
        compression({
          filterMediaType: (mediaType) =>
            // Only compress if it's compressible AND not HTML
            isCompressibleMimeType(mediaType) && !mediaType.includes('html'),
        }),
      ],
    })

    router.get(
      '/data.json',
      () =>
        new Response('{"data":"value"}', {
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    router.get(
      '/page.html',
      () =>
        new Response('<html>test</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    )

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

  it('supports dynamic encodings based on response', async () => {
    let router = createRouter({
      middleware: [
        compression({
          encodings: (response) =>
            response.headers.get('Content-Type') === 'text/event-stream'
              ? ['gzip', 'deflate']
              : ['br', 'gzip', 'deflate'],
        }),
      ],
    })

    router.get(
      '/events',
      () =>
        new Response('event: message\ndata: hello\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    )

    router.get(
      '/data.json',
      () =>
        new Response('{"data":"value"}', {
          headers: { 'Content-Type': 'application/json' },
        }),
    )

    // SSE should use gzip (brotli excluded)
    let sseResponse = await router.fetch('https://remix.run/events', {
      headers: { 'Accept-Encoding': 'br, gzip' },
    })
    assert.equal(sseResponse.headers.get('Content-Encoding'), 'gzip')

    // JSON should use brotli (brotli included)
    let jsonResponse = await router.fetch('https://remix.run/data.json', {
      headers: { 'Accept-Encoding': 'br, gzip' },
    })
    assert.equal(jsonResponse.headers.get('Content-Encoding'), 'br')
  })

  it('allows disabling compression per response via empty encodings array', async () => {
    let router = createRouter({
      middleware: [
        compression({
          encodings: (response) =>
            // Don't compress responses with X-No-Compress header
            response.headers.has('X-No-Compress') ? [] : ['gzip'],
        }),
      ],
    })

    router.get(
      '/nocompress',
      () =>
        new Response('not compressed', {
          headers: { 'Content-Type': 'text/plain', 'X-No-Compress': 'true' },
        }),
    )

    router.get(
      '/compress',
      () =>
        new Response('compressed', {
          headers: { 'Content-Type': 'text/plain' },
        }),
    )

    let noCompressResponse = await router.fetch('https://remix.run/nocompress', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    assert.equal(noCompressResponse.headers.get('Content-Encoding'), null)
    assert.equal(await noCompressResponse.text(), 'not compressed')

    let compressResponse = await router.fetch('https://remix.run/compress', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    assert.equal(compressResponse.headers.get('Content-Encoding'), 'gzip')
  })
})
