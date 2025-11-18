import * as assert from 'node:assert/strict'
import {
  gunzip,
  brotliDecompress,
  inflate,
  constants,
  createGunzip,
  createBrotliDecompress,
  createInflate,
} from 'node:zlib'
import { promisify } from 'node:util'
import { Readable } from 'node:stream'
import { describe, it } from 'node:test'

import { SuperHeaders } from '@remix-run/headers'
import { compress } from './compress.ts'

const gunzipAsync = promisify(gunzip)
const brotliDecompressAsync = promisify(brotliDecompress)
const inflateAsync = promisify(inflate)

describe('compress()', () => {
  it('compresses response with gzip when client accepts it', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    let headers = new SuperHeaders(compressed.headers)
    assert.ok(headers.vary.has('Accept-Encoding'))

    let buffer = Buffer.from(await compressed.arrayBuffer())
    let decompressed = await gunzipAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('compresses response with brotli when client prefers it', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'br, gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'br')

    let buffer = Buffer.from(await compressed.arrayBuffer())
    let decompressed = await brotliDecompressAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('compresses response with deflate', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'deflate' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['deflate'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'deflate')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    let headers = new SuperHeaders(compressed.headers)
    assert.ok(headers.vary.has('Accept-Encoding'))

    let buffer = Buffer.from(await compressed.arrayBuffer())
    let decompressed = await inflateAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('preserves existing Vary header values when adding Accept-Encoding', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: {
        Vary: 'Accept-Language, User-Agent',
      },
    })

    let compressed = await compress(response, request)

    let varyHeader = compressed.headers.get('Vary') || ''
    let varyValues = varyHeader
      .toLowerCase()
      .split(',')
      .map((v) => v.trim())
    assert.ok(varyValues.includes('accept-language'))
    assert.ok(varyValues.includes('user-agent'))
    assert.ok(varyValues.includes('accept-encoding'))
  })

  it('does not duplicate Accept-Encoding in Vary header', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: {
        Vary: 'Accept-Encoding, Accept-Language',
      },
    })

    let compressed = await compress(response, request)

    let varyHeader = compressed.headers.get('Vary') || ''
    let encodingMatches = varyHeader.match(/accept-encoding/gi) || []
    assert.equal(encodingMatches.length, 1)
  })

  it('does not compress when client does not send Accept-Encoding', async () => {
    let request = new Request('http://localhost')
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    // Per RFC 7231, when no Accept-Encoding header is present,
    // server should use identity (uncompressed) for compatibility
    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(await compressed.text(), 'Hello, World!')
  })

  it('compresses responses when Content-Length is not set', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Response without Content-Length header
    let response = new Response('Small')

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('skips compression for already compressed responses', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Already compressed', {
      headers: { 'Content-Encoding': 'gzip' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed, response)
  })

  it('skips compression when Cache-Control: no-transform is present', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Do not transform', {
      headers: { 'Cache-Control': 'public, no-transform, max-age=3600' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed, response)
  })

  it('skips compression when response has no body', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response(null, { status: 204 })

    let compressed = await compress(response, request)

    assert.equal(compressed, response)
  })

  it('compresses with custom compression level', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Use a large, repetitive string where compression level makes a difference
    let content = 'Hello, World!'.repeat(1000)

    // Compress with level 1 (fast, less compression)
    let level1 = await compress(new Response(content), request, {
      zlib: { level: 1 },
    })
    let level1Buffer = Buffer.from(await level1.arrayBuffer())

    // Compress with level 9 (slow, max compression)
    let level9 = await compress(new Response(content), request, {
      zlib: { level: 9 },
    })
    let level9Buffer = Buffer.from(await level9.arrayBuffer())

    // Verify both are valid gzip
    assert.equal(level1.headers.get('Content-Encoding'), 'gzip')
    assert.equal(level9.headers.get('Content-Encoding'), 'gzip')

    // Verify both decompress correctly
    let decompressed1 = await gunzipAsync(level1Buffer)
    let decompressed9 = await gunzipAsync(level9Buffer)
    assert.equal(decompressed1.toString(), content)
    assert.equal(decompressed9.toString(), content)

    // Level 9 should produce smaller output than level 1
    assert.ok(level9Buffer.length < level1Buffer.length)
  })

  it('compresses with custom brotli options', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'br' },
    })
    // Use repetitive content where window size affects compression ratio
    let content = 'Hello, World! '.repeat(10000)

    // Compress with window size 10 (small window)
    let windowSmall = await compress(new Response(content), request, {
      encodings: ['br'],
      brotli: {
        params: {
          [constants.BROTLI_PARAM_LGWIN]: 10,
        },
      },
    })
    let windowSmallBuffer = Buffer.from(await windowSmall.arrayBuffer())

    // Compress with window size 22 (large window, better for repetitive data)
    let windowLarge = await compress(new Response(content), request, {
      encodings: ['br'],
      brotli: {
        params: {
          [constants.BROTLI_PARAM_LGWIN]: 22,
        },
      },
    })
    let windowLargeBuffer = Buffer.from(await windowLarge.arrayBuffer())

    // Verify both are valid brotli
    assert.equal(windowSmall.headers.get('Content-Encoding'), 'br')
    assert.equal(windowLarge.headers.get('Content-Encoding'), 'br')

    // Verify both decompress correctly
    let decompressedSmall = await brotliDecompressAsync(windowSmallBuffer)
    let decompressedLarge = await brotliDecompressAsync(windowLargeBuffer)
    assert.equal(decompressedSmall.toString(), content)
    assert.equal(decompressedLarge.toString(), content)

    // Different window sizes should produce different compressed output
    // (if options aren't passed through, both would use the same default window)
    assert.notEqual(windowSmallBuffer.length, windowLargeBuffer.length)
  })

  it('limits to specified encodings', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'br, gzip, deflate' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['gzip', 'deflate'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('returns uncompressed when encodings is empty array', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip, br' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, { encodings: [] })

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('handles quality factors in Accept-Encoding', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip;q=0.8, deflate;q=1.0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'deflate')
  })

  it('client quality factors override server preference order', async () => {
    let request = new Request('http://localhost', {
      // Client strongly prefers gzip over br
      headers: { 'Accept-Encoding': 'br;q=0.5, gzip;q=1.0, deflate;q=0.8' },
    })
    let response = new Response('Hello, World!')

    // Server prefers br > gzip > deflate, but client q-values should win
    let compressed = await compress(response, request, {
      encodings: ['br', 'gzip', 'deflate'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('server preference order breaks ties when client has equal quality factors', async () => {
    let request = new Request('http://localhost', {
      // Client has no preference (all default to q=1.0)
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    })
    let response = new Response('Hello, World!')

    // Server prefers deflate first, so it should win the tie
    let compressed = await compress(response, request, {
      encodings: ['deflate', 'br', 'gzip'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'deflate')
  })

  it('respects explicit rejection with q=0', async () => {
    let request = new Request('http://localhost', {
      // Client explicitly rejects gzip and deflate with q=0
      headers: { 'Accept-Encoding': 'gzip;q=0, deflate;q=0, br;q=1.0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should use br since others are explicitly rejected
    assert.equal(compressed.headers.get('Content-Encoding'), 'br')
  })

  it('returns uncompressed when all encodings are rejected but identity is acceptable', async () => {
    let request = new Request('http://localhost', {
      // Client explicitly rejects all compression but accepts identity (default q=1.0)
      headers: { 'Accept-Encoding': 'gzip;q=0, deflate;q=0, br;q=0, identity' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should return identity (no compression)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(compressed, response) // Should be the same response object
  })

  it('requires compression when identity is explicitly rejected', async () => {
    let request = new Request('http://localhost', {
      // Client rejects uncompressed but accepts gzip
      headers: { 'Accept-Encoding': 'identity;q=0, gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    // Must compress since identity is rejected
    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('returns 406 when all encodings including identity are rejected', async () => {
    let request = new Request('http://localhost', {
      // Client rejects everything including identity
      headers: { 'Accept-Encoding': 'gzip;q=0, deflate;q=0, br;q=0, identity;q=0' },
    })
    let response = new Response('Hello, World!')

    let result = await compress(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should return 406 Not Acceptable per RFC 7231
    assert.equal(result.status, 406)
    assert.equal(result.statusText, 'Not Acceptable')
  })

  it('handles wildcard with quality factor', async () => {
    let request = new Request('http://localhost', {
      // Client accepts gzip preferentially, but any other encoding at q=0.5
      headers: { 'Accept-Encoding': 'gzip, *;q=0.5' },
    })
    let response = new Response('Hello, World!')

    // Server offers br, which should match the wildcard
    let compressed = await compress(response, request, {
      encodings: ['br', 'deflate'], // No gzip offered
    })

    // Should use br (matches wildcard with q=0.5)
    assert.equal(compressed.headers.get('Content-Encoding'), 'br')
  })

  it('prefers explicit encoding over wildcard', async () => {
    let request = new Request('http://localhost', {
      // Explicit gzip (q=1.0) vs wildcard (q=0.8)
      headers: { 'Accept-Encoding': 'gzip, *;q=0.8' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['br', 'gzip', 'deflate'],
    })

    // Should prefer explicit gzip (q=1.0) over br matched by wildcard (q=0.8)
    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('respects wildcard rejection with q=0', async () => {
    let request = new Request('http://localhost', {
      // Only accepts gzip explicitly, rejects all others including identity with *;q=0
      headers: { 'Accept-Encoding': 'gzip, *;q=0' },
    })
    let response = new Response('Hello, World!')

    // Server tries to offer br which matches the rejected wildcard
    let result = await compress(response, request, {
      encodings: ['br', 'deflate'], // No gzip offered
    })

    // Wildcard *;q=0 also rejects identity, so should return 406 per RFC 7231
    assert.equal(result.status, 406)
    assert.equal(result.statusText, 'Not Acceptable')
  })

  it('allows identity when wildcard rejects compression but identity is explicit', async () => {
    let request = new Request('http://localhost', {
      // Reject compression but explicitly allow identity
      headers: { 'Accept-Encoding': 'identity, *;q=0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should return uncompressed since identity is explicitly acceptable
    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(compressed, response)
  })

  it('handles wildcard with identity rejection', async () => {
    let request = new Request('http://localhost', {
      // Accepts any compression but rejects identity
      headers: { 'Accept-Encoding': '*;q=1.0, identity;q=0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Must compress since identity is rejected (should use first supported: gzip)
    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('preserves response status and statusText', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Created', {
      status: 201,
      statusText: 'Created',
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.status, 201)
    assert.equal(compressed.statusText, 'Created')
  })

  it('removes Content-Length header', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let largeContent = 'Hello, World!'.repeat(100) // Make it larger than threshold
    let response = new Response(largeContent, {
      headers: { 'Content-Length': String(largeContent.length) },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Length'), null)
  })

  it('sets Accept-Ranges to none', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
  })

  it('converts strong ETags to weak', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: { ETag: '"abc123"' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('ETag'), 'W/"abc123"')
  })

  it('preserves weak ETags', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: { ETag: 'W/"abc123"' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('ETag'), 'W/"abc123"')
  })

  it('does not add ETag when not present', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('ETag'), null)
  })

  it('converts strong ETags to weak for HEAD requests', async () => {
    let request = new Request('http://localhost', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: {
        'Content-Type': 'text/plain',
        ETag: '"xyz789"',
      },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('ETag'), 'W/"xyz789"')
  })

  it('skips responses with Accept-Ranges: bytes', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: { 'Accept-Ranges': 'bytes' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('skips 206 partial content responses', async () => {
    let request = new Request('http://localhost', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Partial content', {
      status: 206,
      headers: { 'Content-Range': 'bytes 0-9/100' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('sets compression headers for HEAD requests without compressing', async () => {
    let request = new Request('http://localhost', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Content larger than default threshold (1024 bytes)
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    assert.equal(compressed.headers.get('Content-Length'), null)
    let headers = new SuperHeaders(compressed.headers)
    assert.ok(headers.vary.has('Accept-Encoding'))
    assert.equal(compressed.body, null)
  })

  it('negotiates encoding for HEAD requests', async () => {
    let request = new Request('http://localhost', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'br' },
    })
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'br')
  })

  it('returns identity for HEAD when client does not accept compression', async () => {
    let request = new Request('http://localhost', {
      method: 'HEAD',
    })
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('sets compression headers for HEAD requests even when body is already null', async () => {
    let request = new Request('http://localhost', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Response with body already removed (common pattern at route level)
    let response = new Response(null, {
      headers: { 'Content-Type': 'text/plain', 'Content-Length': '2000' },
    })

    let compressed = await compress(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    assert.equal(compressed.headers.get('Content-Length'), null)
    let headers = new SuperHeaders(compressed.headers)
    assert.ok(headers.vary.has('Accept-Encoding'))
    assert.equal(compressed.body, null)
  })

  describe('Server-Sent Events', () => {
    let encodings = [
      ['br', createBrotliDecompress],
      ['gzip', createGunzip],
      ['deflate', createInflate],
    ] as const

    for (let [encodingName, createDecompressor] of encodings) {
      it(`automatically applies flush for SSE with ${encodingName}`, async () => {
        let sendEvent: ((data: string) => void) | undefined
        let controller: ReadableStreamDefaultController<Uint8Array> | undefined

        let stream = new ReadableStream({
          start(c) {
            controller = c
            sendEvent = (data: string) => {
              controller!.enqueue(new TextEncoder().encode(data))
            }
          },
        })

        let response = new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream' },
        })

        let request = new Request('http://localhost', {
          headers: { 'Accept-Encoding': encodingName },
        })

        let compressed = await compress(response, request, {
          encodings: [encodingName],
          // Provide custom options WITHOUT flush
          // compress() should automatically apply flush for SSE
          zlib: {
            level: 9,
          },
          brotli: {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 11,
            },
          },
        })

        assert.equal(compressed.headers.get('Content-Encoding'), encodingName)
        assert.ok(compressed.body)

        let decompressor = createDecompressor()
        let nodeReadable = Readable.fromWeb(compressed.body as any)
        let decompressed = nodeReadable.pipe(decompressor)

        // Test that data arrives before stream closes AND is valid SSE format
        let receivedData = await new Promise<string>((resolve, reject) => {
          let timeout = setTimeout(() => {
            reject(new Error(`Timeout: data not flushed - flush may not be working`))
          }, 500)

          decompressed.once('data', (chunk) => {
            clearTimeout(timeout)
            resolve(chunk.toString())
          })

          decompressed.resume()

          // Send SSE event - with flush, it should arrive immediately
          // Without flush, stream stays open and data buffers, causing timeout
          setImmediate(() => {
            sendEvent!('event: message\ndata: test-payload\n\n')
          })
        })

        // Verify the decompressed data is valid SSE format
        assert.ok(receivedData.includes('event: message'), 'Missing event type')
        assert.ok(receivedData.includes('data: test-payload'), 'Missing data payload')
        assert.ok(receivedData.includes('\n\n'), 'Missing SSE message terminator')

        controller!.close()
        decompressed.destroy()
      })
    }

    it('respects explicit flush value even for SSE', async () => {
      let response = new Response('event: message\ndata: test\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      })

      let request = new Request('http://localhost', {
        headers: { 'Accept-Encoding': 'gzip' },
      })

      // Explicitly set flush to Z_NO_FLUSH (not recommended for SSE, but should be respected)
      let compressed = await compress(response, request, {
        zlib: {
          flush: constants.Z_NO_FLUSH,
        },
      })

      assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
      assert.ok(compressed.body)

      // Just verify it compressed, we can't easily test that Z_NO_FLUSH was used
      // but the important thing is it didn't override our explicit setting
      let buffer = await compressed.arrayBuffer()
      let decompressed = await gunzipAsync(Buffer.from(buffer))
      assert.equal(decompressed.toString(), 'event: message\ndata: test\n\n')
    })

    it('only applies flush defaults for text/event-stream', async () => {
      let response = new Response('regular content', {
        headers: { 'Content-Type': 'text/plain' },
      })

      let request = new Request('http://localhost', {
        headers: { 'Accept-Encoding': 'gzip' },
      })

      let compressed = await compress(response, request)

      assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
      // Should compress successfully without any flush defaults
      assert.ok(compressed.body)
    })
  })
})
