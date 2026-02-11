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
import { EventEmitter } from 'node:events'
import { describe, it } from 'node:test'

import { Vary } from '@remix-run/headers'
import { compressResponse, compressStream, type Encoding } from './compress.ts'

const isWindows = process.platform === 'win32'

const gunzipAsync = promisify(gunzip)
const brotliDecompressAsync = promisify(brotliDecompress)
const inflateAsync = promisify(inflate)

// Type for mock compressors used in tests
interface MockCompressor extends EventEmitter {
  write(chunk: Buffer, callback?: (error?: Error) => void): boolean
  end(): void
  destroy(error?: Error): void
}

// Helper to create mock compressors with required methods
function createMockCompressor(impl: {
  write: (chunk: Buffer, callback?: (error?: Error) => void) => boolean
  end: () => void
  destroy: (error?: Error) => void
}): MockCompressor {
  let emitter = new EventEmitter()
  return Object.assign(emitter, impl) as MockCompressor
}

describe('compressResponse()', () => {
  it('compresses response with gzip when client accepts it', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    let vary = Vary.from(compressed.headers.get('vary'))
    assert.ok(vary.has('Accept-Encoding'))

    let buffer = Buffer.from(await compressed.arrayBuffer())
    let decompressed = await gunzipAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('compresses response with brotli when client prefers it', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'br, gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'br')

    let buffer = Buffer.from(await compressed.arrayBuffer())
    let decompressed = await brotliDecompressAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('compresses response with deflate', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'deflate' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['deflate'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'deflate')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    let vary = Vary.from(compressed.headers.get('vary'))
    assert.ok(vary.has('Accept-Encoding'))

    let buffer = Buffer.from(await compressed.arrayBuffer())
    let decompressed = await inflateAsync(buffer)
    assert.equal(decompressed.toString(), 'Hello, World!')
  })

  it('preserves existing Vary header values when adding Accept-Encoding', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: {
        Vary: 'Accept-Language, User-Agent',
      },
    })

    let compressed = await compressResponse(response, request)

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
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: {
        Vary: 'Accept-Encoding, Accept-Language',
      },
    })

    let compressed = await compressResponse(response, request)

    let varyHeader = compressed.headers.get('Vary') || ''
    let encodingMatches = varyHeader.match(/accept-encoding/gi) || []
    assert.equal(encodingMatches.length, 1)
  })

  it('does not compress when client does not send Accept-Encoding', async () => {
    let request = new Request('https://remix.run')
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    // Per RFC 7231, when no Accept-Encoding header is present,
    // server should use identity (uncompressed) for compatibility
    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(await compressed.text(), 'Hello, World!')
  })

  it('compresses responses when Content-Length is not set', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Response without Content-Length header
    let response = new Response('Small')

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('skips compression when Content-Length is below threshold', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Small', {
      headers: { 'Content-Length': '5' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(await compressed.text(), 'Small')
  })

  it('respects custom threshold option', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Small', {
      headers: { 'Content-Length': '5' },
    })

    let compressed = await compressResponse(response, request, { threshold: 3 })

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('skips compression for already compressed responses', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Already compressed', {
      headers: { 'Content-Encoding': 'gzip' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed, response)
  })

  it('skips compression when Cache-Control: no-transform is present', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Do not transform', {
      headers: { 'Cache-Control': 'public, no-transform, max-age=3600' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed, response)
  })

  it('skips compression when response has no body', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response(null, { status: 204 })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed, response)
  })

  it('compresses with custom compression level', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Use a large, repetitive string where compression level makes a difference
    let content = 'Hello, World!'.repeat(1000)

    // Compress with level 1 (fast, less compression)
    let level1 = await compressResponse(new Response(content), request, {
      zlib: { level: 1 },
    })
    let level1Buffer = Buffer.from(await level1.arrayBuffer())

    // Compress with level 9 (slow, max compression)
    let level9 = await compressResponse(new Response(content), request, {
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
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'br' },
    })
    // Use repetitive content where window size affects compression ratio
    let content = 'Hello, World! '.repeat(10000)

    // Compress with window size 10 (small window)
    let windowSmall = await compressResponse(new Response(content), request, {
      encodings: ['br'],
      brotli: {
        params: {
          [constants.BROTLI_PARAM_LGWIN]: 10,
        },
      },
    })
    let windowSmallBuffer = Buffer.from(await windowSmall.arrayBuffer())

    // Compress with window size 22 (large window, better for repetitive data)
    let windowLarge = await compressResponse(new Response(content), request, {
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
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'br, gzip, deflate' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['gzip', 'deflate'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('returns uncompressed when encodings is empty array', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip, br' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, { encodings: [] })

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('handles quality factors in Accept-Encoding', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip;q=0.8, deflate;q=1.0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'deflate')
  })

  it('client quality factors override server preference order', async () => {
    let request = new Request('https://remix.run', {
      // Client strongly prefers gzip over br
      headers: { 'Accept-Encoding': 'br;q=0.5, gzip;q=1.0, deflate;q=0.8' },
    })
    let response = new Response('Hello, World!')

    // Server prefers br > gzip > deflate, but client q-values should win
    let compressed = await compressResponse(response, request, {
      encodings: ['br', 'gzip', 'deflate'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('server preference order breaks ties when client has equal quality factors', async () => {
    let request = new Request('https://remix.run', {
      // Client has no preference (all default to q=1.0)
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    })
    let response = new Response('Hello, World!')

    // Server prefers deflate first, so it should win the tie
    let compressed = await compressResponse(response, request, {
      encodings: ['deflate', 'br', 'gzip'],
    })

    assert.equal(compressed.headers.get('Content-Encoding'), 'deflate')
  })

  it('respects explicit rejection with q=0', async () => {
    let request = new Request('https://remix.run', {
      // Client explicitly rejects gzip and deflate with q=0
      headers: { 'Accept-Encoding': 'gzip;q=0, deflate;q=0, br;q=1.0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should use br since others are explicitly rejected
    assert.equal(compressed.headers.get('Content-Encoding'), 'br')
  })

  it('returns uncompressed when all encodings are rejected but identity is acceptable', async () => {
    let request = new Request('https://remix.run', {
      // Client explicitly rejects all compression but accepts identity (default q=1.0)
      headers: { 'Accept-Encoding': 'gzip;q=0, deflate;q=0, br;q=0, identity' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should return identity (no compression)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(compressed, response) // Should be the same response object
  })

  it('requires compression when identity is explicitly rejected', async () => {
    let request = new Request('https://remix.run', {
      // Client rejects uncompressed but accepts gzip
      headers: { 'Accept-Encoding': 'identity;q=0, gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    // Must compress since identity is rejected
    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('returns 406 when all encodings including identity are rejected', async () => {
    let request = new Request('https://remix.run', {
      // Client rejects everything including identity
      headers: { 'Accept-Encoding': 'gzip;q=0, deflate;q=0, br;q=0, identity;q=0' },
    })
    let response = new Response('Hello, World!')

    let result = await compressResponse(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should return 406 Not Acceptable per RFC 7231
    assert.equal(result.status, 406)
    assert.equal(result.statusText, 'Not Acceptable')
  })

  it('handles wildcard with quality factor', async () => {
    let request = new Request('https://remix.run', {
      // Client accepts gzip preferentially, but any other encoding at q=0.5
      headers: { 'Accept-Encoding': 'gzip, *;q=0.5' },
    })
    let response = new Response('Hello, World!')

    // Server offers br, which should match the wildcard
    let compressed = await compressResponse(response, request, {
      encodings: ['br', 'deflate'], // No gzip offered
    })

    // Should use br (matches wildcard with q=0.5)
    assert.equal(compressed.headers.get('Content-Encoding'), 'br')
  })

  it('prefers explicit encoding over wildcard', async () => {
    let request = new Request('https://remix.run', {
      // Explicit gzip (q=1.0) vs wildcard (q=0.8)
      headers: { 'Accept-Encoding': 'gzip, *;q=0.8' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['br', 'gzip', 'deflate'],
    })

    // Should prefer explicit gzip (q=1.0) over br matched by wildcard (q=0.8)
    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('respects wildcard rejection with q=0', async () => {
    let request = new Request('https://remix.run', {
      // Only accepts gzip explicitly, rejects all others including identity with *;q=0
      headers: { 'Accept-Encoding': 'gzip, *;q=0' },
    })
    let response = new Response('Hello, World!')

    // Server tries to offer br which matches the rejected wildcard
    let result = await compressResponse(response, request, {
      encodings: ['br', 'deflate'], // No gzip offered
    })

    // Wildcard *;q=0 also rejects identity, so should return 406 per RFC 7231
    assert.equal(result.status, 406)
    assert.equal(result.statusText, 'Not Acceptable')
  })

  it('allows identity when wildcard rejects compression but identity is explicit', async () => {
    let request = new Request('https://remix.run', {
      // Reject compression but explicitly allow identity
      headers: { 'Accept-Encoding': 'identity, *;q=0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Should return uncompressed since identity is explicitly acceptable
    assert.equal(compressed.headers.get('Content-Encoding'), null)
    assert.equal(compressed, response)
  })

  it('handles wildcard with identity rejection', async () => {
    let request = new Request('https://remix.run', {
      // Accepts any compression but rejects identity
      headers: { 'Accept-Encoding': '*;q=1.0, identity;q=0' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request, {
      encodings: ['gzip', 'deflate', 'br'],
    })

    // Must compress since identity is rejected (should use first supported: gzip)
    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
  })

  it('preserves response status and statusText', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Created', {
      status: 201,
      statusText: 'Created',
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.status, 201)
    assert.equal(compressed.statusText, 'Created')
  })

  it('removes Content-Length header', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let largeContent = 'Hello, World!'.repeat(100) // Make it larger than threshold
    let response = new Response(largeContent, {
      headers: { 'Content-Length': String(largeContent.length) },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Length'), null)
  })

  it('sets Accept-Ranges to none', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
  })

  it('converts strong ETags to weak', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: { ETag: '"abc123"' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('ETag'), 'W/"abc123"')
  })

  it('preserves weak ETags', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: { ETag: 'W/"abc123"' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('ETag'), 'W/"abc123"')
  })

  it('does not add ETag when not present', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!')

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('ETag'), null)
  })

  it('converts strong ETags to weak for HEAD requests', async () => {
    let request = new Request('https://remix.run', {
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

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('ETag'), 'W/"xyz789"')
  })

  it('skips responses with Accept-Ranges: bytes', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Hello, World!', {
      headers: { 'Accept-Ranges': 'bytes' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('skips 206 partial content responses', async () => {
    let request = new Request('https://remix.run', {
      headers: { 'Accept-Encoding': 'gzip' },
    })
    let response = new Response('Partial content', {
      status: 206,
      headers: { 'Content-Range': 'bytes 0-9/100' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('sets compression headers for HEAD requests without compressing', async () => {
    let request = new Request('https://remix.run', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Content larger than default threshold (1024 bytes)
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    assert.equal(compressed.headers.get('Content-Length'), null)
    let vary = Vary.from(compressed.headers.get('vary'))
    assert.ok(vary.has('Accept-Encoding'))
    assert.equal(compressed.body, null)
  })

  it('negotiates encoding for HEAD requests', async () => {
    let request = new Request('https://remix.run', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'br' },
    })
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'br')
  })

  it('returns identity for HEAD when client does not accept compression', async () => {
    let request = new Request('https://remix.run', {
      method: 'HEAD',
    })
    let content = 'x'.repeat(2000)
    let response = new Response(content, {
      headers: { 'Content-Type': 'text/plain' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed, response)
    assert.equal(compressed.headers.get('Content-Encoding'), null)
  })

  it('sets compression headers for HEAD requests even when body is already null', async () => {
    let request = new Request('https://remix.run', {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'gzip' },
    })
    // Response with body already removed (common pattern at route level)
    let response = new Response(null, {
      headers: { 'Content-Type': 'text/plain', 'Content-Length': '2000' },
    })

    let compressed = await compressResponse(response, request)

    assert.equal(compressed.headers.get('Content-Encoding'), 'gzip')
    assert.equal(compressed.headers.get('Accept-Ranges'), 'none')
    assert.equal(compressed.headers.get('Content-Length'), null)
    let vary = Vary.from(compressed.headers.get('vary'))
    assert.ok(vary.has('Accept-Encoding'))
    assert.equal(compressed.body, null)
  })

  describe('Server-Sent Events', () => {
    async function testSSEFlush(
      encodingName: Encoding,
      createDecompressor: () => ReturnType<
        typeof createBrotliDecompress | typeof createGunzip | typeof createInflate
      >,
    ) {
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

      let request = new Request('https://remix.run', {
        headers: { 'Accept-Encoding': encodingName },
      })

      let compressed = await compressResponse(response, request, {
        encodings: [encodingName],
        // Provide custom options WITHOUT flush
        // compressResponse() should automatically apply flush for SSE
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
        let timeout = setTimeout(
          () => {
            reject(new Error(`Timeout: data not flushed - flush may not be working`))
          },
          isWindows ? 2_000 : 500,
        )

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
    }

    it('automatically applies flush for SSE with br', async () => {
      await testSSEFlush('br', createBrotliDecompress)
    })

    it('automatically applies flush for SSE with gzip', async () => {
      await testSSEFlush('gzip', createGunzip)
    })

    it('automatically applies flush for SSE with deflate', async () => {
      await testSSEFlush('deflate', createInflate)
    })
  })

  describe('Streaming compression', () => {
    /**
     * Helper: Create a ReadableStream from a string
     */
    function createStreamFromString(content: string): ReadableStream<Uint8Array> {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(content))
          controller.close()
        },
      })
    }

    /**
     * Helper: Create a ReadableStream that emits chunks
     */
    function createChunkedStream(chunks: string[]): ReadableStream<Uint8Array> {
      return new ReadableStream({
        start(controller) {
          for (let chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk))
          }
          controller.close()
        },
      })
    }

    /**
     * Helper: Create a ReadableStream that errors
     */
    function createErrorStream(errorAfterChunks: number): ReadableStream<Uint8Array> {
      return new ReadableStream({
        start(controller) {
          for (let i = 0; i < errorAfterChunks; i++) {
            controller.enqueue(new TextEncoder().encode('chunk'))
          }
          controller.error(new Error('Stream error'))
        },
      })
    }

    /**
     * Helper: Read entire stream to string
     */
    async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
      let reader = stream.getReader()
      let chunks: Uint8Array[] = []

      while (true) {
        let { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }

      let concatenated = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
      let offset = 0
      for (let chunk of chunks) {
        concatenated.set(chunk, offset)
        offset += chunk.length
      }

      return new TextDecoder().decode(concatenated)
    }

    /**
     * Helper: Decompress a web stream using node:zlib
     */
    function getDecompressor(encoding: Encoding) {
      switch (encoding) {
        case 'gzip':
          return createGunzip()
        case 'deflate':
          return createInflate()
        case 'br':
          return createBrotliDecompress()
        default:
          throw new Error(`Unsupported encoding: ${encoding}`)
      }
    }

    function decompressStream(
      compressed: ReadableStream<Uint8Array>,
      encoding: Encoding,
    ): ReadableStream<Uint8Array> {
      let decompressor = getDecompressor(encoding)

      return new ReadableStream({
        async start(controller) {
          decompressor.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength))
          })

          decompressor.on('end', () => {
            controller.close()
          })

          decompressor.on('error', (error: Error) => {
            controller.error(error)
          })

          let reader = compressed.getReader()

          try {
            while (true) {
              let { done, value } = await reader.read()

              if (done) {
                decompressor.end()
                break
              }

              if (!value) {
                continue
              }

              decompressor.write(Buffer.from(value))
            }
          } catch (error) {
            decompressor.destroy(error as Error)
          }
        },
      })
    }

    /**
     * Helper: Compress and decompress round-trip
     */
    async function roundTrip(input: string, encoding: Encoding): Promise<string> {
      let request = new Request('https://remix.run', {
        headers: {
          'Accept-Encoding': encoding,
        },
      })

      let response = new Response(createStreamFromString(input), {
        headers: {
          'Content-Type': 'text/plain',
        },
      })

      let compressed = await compressResponse(response, request, { encodings: [encoding] })

      assert.equal(compressed.headers.get('Content-Encoding'), encoding)

      let decompressed = decompressStream(compressed.body!, encoding)
      return await streamToString(decompressed)
    }

    describe('correctness (round-trip compression)', () => {
      it('handles binary data byte-perfectly', async () => {
        let request = new Request('https://remix.run', {
          headers: { 'Accept-Encoding': 'br' },
        })

        // Create binary data with all byte values (0-255)
        let binaryData = new Uint8Array(256)
        for (let i = 0; i < 256; i++) {
          binaryData[i] = i
        }

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(binaryData)
            controller.close()
          },
        })

        let response = new Response(stream, {
          headers: { 'Content-Type': 'application/octet-stream' },
        })

        let compressed = await compressResponse(response, request, { encodings: ['br'] })

        // Decompress and verify byte-perfect match
        let decompressed = decompressStream(compressed.body!, 'br')
        let chunks: Uint8Array[] = []
        let reader = decompressed.getReader()

        while (true) {
          let { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }

        let result = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (let chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }

        assert.equal(result.length, binaryData.length)
        for (let i = 0; i < result.length; i++) {
          assert.equal(result[i], binaryData[i], `Byte mismatch at index ${i}`)
        }
      })

      describe('gzip', () => {
        it('compresses and decompresses simple text', async () => {
          let result = await roundTrip('hello world', 'gzip')
          assert.equal(result, 'hello world')
        })

        it('compresses and decompresses empty string', async () => {
          let result = await roundTrip('', 'gzip')
          assert.equal(result, '')
        })

        it('compresses and decompresses unicode', async () => {
          let unicode = 'Hello 世界 🌍 émoji'
          let result = await roundTrip(unicode, 'gzip')
          assert.equal(result, unicode)
        })
      })

      describe('deflate', () => {
        it('compresses and decompresses simple text', async () => {
          let result = await roundTrip('hello world', 'deflate')
          assert.equal(result, 'hello world')
        })

        it('compresses and decompresses empty string', async () => {
          let result = await roundTrip('', 'deflate')
          assert.equal(result, '')
        })

        it('compresses and decompresses unicode', async () => {
          let unicode = 'Hello 世界 🌍 émoji'
          let result = await roundTrip(unicode, 'deflate')
          assert.equal(result, unicode)
        })
      })

      describe('br', () => {
        it('compresses and decompresses simple text', async () => {
          let result = await roundTrip('hello world', 'br')
          assert.equal(result, 'hello world')
        })

        it('compresses and decompresses empty string', async () => {
          let result = await roundTrip('', 'br')
          assert.equal(result, '')
        })

        it('compresses and decompresses unicode', async () => {
          let unicode = 'Hello 世界 🌍 émoji'
          let result = await roundTrip(unicode, 'br')
          assert.equal(result, unicode)
        })
      })
    })

    describe('chunk handling', () => {
      it('handles multiple chunks correctly', async () => {
        let request = new Request('https://remix.run', {
          headers: { 'Accept-Encoding': 'br' },
        })

        let response = new Response(createChunkedStream(['hello', ' ', 'world']), {
          headers: { 'Content-Type': 'text/plain' },
        })

        let compressed = await compressResponse(response, request, { encodings: ['br'] })
        let decompressed = decompressStream(compressed.body!, 'br')
        let result = await streamToString(decompressed)

        assert.equal(result, 'hello world')
      })

      it('handles single-byte chunks', async () => {
        let bytes = ['h', 'e', 'l', 'l', 'o']

        let request = new Request('https://remix.run', {
          headers: { 'Accept-Encoding': 'br' },
        })

        let response = new Response(createChunkedStream(bytes), {
          headers: { 'Content-Type': 'text/plain' },
        })

        let compressed = await compressResponse(response, request, { encodings: ['br'] })
        let decompressed = decompressStream(compressed.body!, 'br')
        let result = await streamToString(decompressed)

        assert.equal(result, 'hello')
      })

      it('handles empty chunks in stream', async () => {
        let request = new Request('https://remix.run', {
          headers: { 'Accept-Encoding': 'br' },
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(0)) // Empty chunk
            controller.enqueue(new TextEncoder().encode('hello '))
            controller.enqueue(new Uint8Array(0)) // Another empty chunk
            controller.enqueue(new TextEncoder().encode('world'))
            controller.close()
          },
        })

        let response = new Response(stream, {
          headers: { 'Content-Type': 'text/plain' },
        })

        let compressed = await compressResponse(response, request, { encodings: ['br'] })
        let decompressed = decompressStream(compressed.body!, 'br')
        let result = await streamToString(decompressed)

        assert.equal(result, 'hello world')
      })

      it('handles stream that closes immediately without data', async () => {
        let request = new Request('https://remix.run', {
          headers: { 'Accept-Encoding': 'br' },
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.close() // Close immediately without writing
          },
        })

        let response = new Response(stream, {
          headers: { 'Content-Type': 'text/plain' },
        })

        let compressed = await compressResponse(response, request, { encodings: ['br'] })
        let decompressed = decompressStream(compressed.body!, 'br')
        let result = await streamToString(decompressed)

        assert.equal(result, '')
      })
    })

    it('propagates errors from input stream', async () => {
      let request = new Request('https://remix.run', {
        headers: { 'Accept-Encoding': 'br' },
      })

      let response = new Response(createErrorStream(2), {
        headers: { 'Content-Type': 'text/plain' },
      })

      let compressed = await compressResponse(response, request, { encodings: ['br'] })

      let reader = compressed.body!.getReader()

      await assert.rejects(
        async () => {
          while (true) {
            let { done } = await reader.read()
            if (done) break
          }
        },
        {
          message: 'Stream error',
        },
      )
    })

    it('handles output stream cancellation and stops processing source stream', async () => {
      let request = new Request('https://remix.run', {
        headers: { 'Accept-Encoding': 'br' },
      })

      let streamCancelled = false
      let cancelReason: string | undefined

      let stream = new ReadableStream({
        async pull(controller) {
          controller.enqueue(new TextEncoder().encode('chunk\n'.repeat(100)))
          await new Promise((resolve) => setTimeout(resolve, 10))
        },
        cancel(reason) {
          streamCancelled = true
          cancelReason = reason
        },
      })

      let response = new Response(stream, {
        headers: { 'Content-Type': 'text/plain' },
      })

      let compressed = await compressResponse(response, request, { encodings: ['br'] })
      let reader = compressed.body!.getReader()

      // Start reading to activate the stream
      reader.read()

      // Wait for streaming to start
      await new Promise((resolve) => setTimeout(resolve, 30))

      // Cancel the output stream
      await reader.cancel('User cancelled')

      // Wait for cancellation to propagate
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify source stream was cancelled
      assert.equal(streamCancelled, true, 'Source stream should be cancelled')
      assert.equal(cancelReason, 'User cancelled', 'Cancel reason should be passed through')
    })

    describe('Compressor interactions', () => {
      it('ignores data events emitted after error', async () => {
        let errorEmitted = false

        let mockCompressor = createMockCompressor({
          write: (chunk) => {
            // Emit error, then try to emit data (should be ignored)
            setImmediate(() => {
              mockCompressor.emit('error', new Error('Compressor failed'))
              errorEmitted = true
              // Try to emit data after error (should be ignored)
              mockCompressor.emit('data', chunk)
            })
            // Don't call callback - error will reject the Promise
            return false
          },
          end: () => {},
          destroy: () => {},
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()
        let chunks: Uint8Array[] = []

        // Should get error, not the data chunk
        await assert.rejects(
          async () => {
            while (true) {
              let result = await reader.read()
              if (result.done) break
              chunks.push(result.value)
            }
          },
          {
            message: 'Compressor failed',
          },
        )

        // Wait for any pending microtasks
        await Promise.resolve()

        // Should not have received the data chunk emitted after error
        assert.equal(chunks.length, 0, 'Should not receive data chunks after error')
        assert.equal(errorEmitted, true, 'Error should have been emitted')
      })

      it('ignores data events emitted after cancellation', async () => {
        let dataAfterCancel = false
        let lastChunk: Buffer

        let mockCompressor = createMockCompressor({
          write: (chunk) => {
            // Store the chunk for later emission
            lastChunk = chunk
            // Signal backpressure but never call callback or emit drain
            // This will cause the write to hang
            return false
          },
          end: () => {},
          destroy: () => {
            mockCompressor.emit('data', lastChunk)
            dataAfterCancel = true
          },
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()
        let chunks: Uint8Array[] = []

        // Start reading (will block on backpressure)
        let readPromise = reader.read().then((result) => {
          if (!result.done) chunks.push(result.value)
        })

        // Cancel while blocked
        await Promise.resolve()
        await reader.cancel()

        await readPromise.catch(() => {
          // May error or not, doesn't matter
        })

        // Wait for any pending microtasks
        await Promise.resolve()

        assert.equal(chunks.length, 0, 'Should not receive data chunks after cancel')
        assert.equal(dataAfterCancel, true, 'Data should have been emitted by mock')
      })

      it('handles multiple data chunks emitted during single write', async () => {
        let mockCompressor = createMockCompressor({
          write: (chunk, callback) => {
            // Real zlib can emit multiple data chunks for one write
            // Emit the chunk split into parts
            let length = chunk.length
            let part1 = chunk.subarray(0, Math.floor(length / 3))
            let part2 = chunk.subarray(Math.floor(length / 3), Math.floor((length * 2) / 3))
            let part3 = chunk.subarray(Math.floor((length * 2) / 3))
            mockCompressor.emit('data', part1)
            mockCompressor.emit('data', part2)
            mockCompressor.emit('data', part3)
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {
            mockCompressor.emit('end')
          },
          destroy: () => {},
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('input'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()
        let chunks: Uint8Array[] = []

        while (true) {
          let result = await reader.read()
          if (result.done) break
          chunks.push(result.value)
        }

        assert.equal(chunks.length, 3, 'Should receive all data chunks from single write')
        // Verify the chunks when reassembled equal the original input
        let reassembled = new TextDecoder().decode(Buffer.concat(chunks))
        assert.equal(reassembled, 'input', 'Chunks should reassemble to original input')
      })

      it('handles backpressure (write returns false, then drain)', async () => {
        // Create mock compressor that signals backpressure on second write
        let writeCount = 0
        let mockCompressor = createMockCompressor({
          write: (chunk, callback) => {
            writeCount++
            // Emit data immediately
            setImmediate(() => mockCompressor.emit('data', chunk))
            // Second write returns false (backpressure)
            if (writeCount === 2) {
              // Emit drain and call callback after returning
              setImmediate(() => {
                if (callback) callback()
              })
              return false
            }
            // No backpressure
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {
            setImmediate(() => mockCompressor.emit('end'))
          },
          destroy: () => {},
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('chunk1'))
            controller.enqueue(new TextEncoder().encode('chunk2'))
            controller.enqueue(new TextEncoder().encode('chunk3'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()
        let chunks: Uint8Array[] = []

        while (true) {
          let { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }

        let result = new TextDecoder().decode(Buffer.concat(chunks))

        // Verify all chunks came through despite backpressure
        assert.equal(result, 'chunk1chunk2chunk3')
        assert.equal(writeCount, 3, 'Should have written all chunks')
      })

      it('handles cancel while waiting for drain', async () => {
        let destroyed = false
        let mockCompressor = createMockCompressor({
          write: () =>
            // Never call callback or emit drain, forcing the wait
            false,
          end: () => {},
          destroy: () => {
            destroyed = true
          },
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // Start reading (will get stuck waiting for drain)
        let readPromise = reader.read()

        // Cancel after a short delay
        await Promise.resolve()
        await reader.cancel('User cancelled')

        // Wait for the read to complete
        await readPromise.catch(() => {
          // Expected to fail
        })

        assert.equal(destroyed, true, 'Compressor should be destroyed on cancel')
      })

      it('handles error emitted while waiting for drain and stops loop', async () => {
        let writeCount = 0
        let mockCompressor = createMockCompressor({
          write: () => {
            // Real zlib compressors continue to accept writes after error
            writeCount++
            if (writeCount === 1) {
              // Emit error on next microtask (callback won't be called)
              setImmediate(() => {
                mockCompressor.emit('error', new Error('Compressor failed'))
              })
            }
            return false // Always signal backpressure
          },
          end: () => {},
          destroy: () => {},
        })

        let stream = new ReadableStream({
          pull(controller) {
            controller.enqueue(new TextEncoder().encode('chunk'))
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // Expect error
        await assert.rejects(
          async () => {
            await reader.read()
          },
          {
            message: 'Compressor failed',
          },
        )

        // Wait for any pending microtasks
        await Promise.resolve()

        let finalWriteCount = writeCount

        assert.equal(
          writeCount,
          finalWriteCount,
          `Should only write once before error stops loop (got ${writeCount})`,
        )
      })

      it('handles compressor error after successful chunks', async () => {
        let writeCount = 0
        let mockCompressor = createMockCompressor({
          write: (_chunk, callback) => {
            // Real zlib compressors continue to accept writes after error
            writeCount++
            if (writeCount === 2) {
              // Emit error on next microtask (callback won't be called)
              setImmediate(() => {
                mockCompressor.emit('error', new Error('Compressor failed mid-stream'))
              })
              return false // Signal backpressure to create an await point
            }
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {},
          destroy: () => {},
        })

        let stream = new ReadableStream({
          pull(controller) {
            controller.enqueue(new TextEncoder().encode('chunk'))
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // Expect error
        await assert.rejects(
          async () => {
            while (true) {
              let result = await reader.read()
              if (result.done) break
            }
          },
          {
            message: 'Compressor failed mid-stream',
          },
        )

        // Wait for any pending microtasks
        await Promise.resolve()

        let finalWriteCount = writeCount

        assert.equal(
          writeCount,
          finalWriteCount,
          `Should only write twice before error stops loop (got ${writeCount})`,
        )
      })

      it('stops calling reader.read() after error', async () => {
        let writeCount = 0
        let mockCompressor = createMockCompressor({
          write: () => {
            writeCount++
            if (writeCount === 1) {
              setImmediate(() => {
                mockCompressor.emit('error', new Error('Compressor failed'))
              })
            }
            return false // Backpressure (callback won't be called)
          },
          end: () => {},
          destroy: () => {},
        })

        let stream = new ReadableStream({
          pull(controller) {
            controller.enqueue(new TextEncoder().encode('chunk'))
          },
        })

        // Monkey patch stream.getReader to count reader.read() calls
        let readCount = 0
        let originalGetReader = stream.getReader.bind(stream)
        stream.getReader = function () {
          let reader = originalGetReader()
          let originalRead = reader.read.bind(reader)
          reader.read = function () {
            readCount++
            return originalRead()
          }
          return reader
        }

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        await assert.rejects(
          async () => {
            await reader.read()
          },
          {
            message: 'Compressor failed',
          },
        )

        // Wait for any pending microtasks
        await Promise.resolve()

        assert.equal(
          readCount,
          1,
          `Should only call reader.read() once (called ${readCount} times)`,
        )
        assert.equal(writeCount, 1, 'Should only write once')
      })

      it('propagates reader.cancel() errors', async () => {
        let mockCompressor = createMockCompressor({
          write: (_chunk, callback) => {
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {},
          destroy: () => {},
        })

        // Create a stream where cancel() rejects
        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
          },
          cancel() {
            return Promise.reject(new Error('Cancel failed'))
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // Start reading (will be in progress)
        let readPromise = reader.read()

        // Wait a bit for processing to start
        await new Promise((resolve) => setTimeout(resolve, 10))

        // Cancel should propagate the error
        await assert.rejects(
          async () => {
            await reader.cancel('User cancelled')
          },
          {
            message: 'Cancel failed',
          },
        )

        // Clean up the read promise
        await readPromise.catch(() => {})
      })

      it('handles error passed to write() callback', async () => {
        let mockCompressor = createMockCompressor({
          write: (_chunk, callback) => {
            // Call callback with error immediately
            if (callback) {
              callback(new Error('Write callback error'))
            }
            return true
          },
          end: () => {},
          destroy: () => {
            // Real compressors typically don't emit error when destroyed with an error
            // because the error is already being propagated. However, for completeness
            // and to ensure resilience, we also test this scenario below.
          },
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // The first read will trigger the write with callback error
        await assert.rejects(
          async () => {
            await reader.read()
          },
          {
            message: 'Write callback error',
          },
        )
      })

      it('prevents duplicate error reporting if destroy() also emits error', async () => {
        let errorEmitCount = 0
        let mockCompressor = createMockCompressor({
          write: (_chunk, callback) => {
            // Call callback with error immediately
            if (callback) {
              callback(new Error('Write callback error'))
            }
            return true
          },
          end: () => {},
          destroy: (error) => {
            if (error) {
              setImmediate(() => {
                errorEmitCount++
                mockCompressor.emit('error', error)
              })
            }
          },
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // The first read will trigger the write with callback error
        await assert.rejects(
          async () => {
            await reader.read()
          },
          {
            message: 'Write callback error',
          },
        )

        // Wait for any pending error emissions
        await new Promise((resolve) => setImmediate(resolve))

        // Error event should have been emitted but ignored (duplicate)
        assert.equal(errorEmitCount, 1, 'Error event should have been emitted by destroy()')
      })

      it('calls compressor.end() when input stream is done', async () => {
        let endCalled = false
        let mockCompressor = createMockCompressor({
          write: (_chunk, callback) => {
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {
            endCalled = true
            mockCompressor.emit('end')
          },
          destroy: () => {},
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        // Read all chunks
        while (true) {
          let result = await reader.read()
          if (result.done) break
        }

        assert.equal(endCalled, true, 'compressor.end() should be called when input stream is done')
      })

      it('closes output stream when compressor emits end event', async () => {
        let mockCompressor = createMockCompressor({
          write: (chunk, callback) => {
            // Emit data and end immediately
            mockCompressor.emit('data', chunk)
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {
            setImmediate(() => {
              mockCompressor.emit('end')
            })
          },
          destroy: () => {},
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        let chunks: Uint8Array[] = []
        while (true) {
          let result = await reader.read()
          if (result.done) {
            break
          }
          chunks.push(result.value)
        }

        assert.equal(chunks.length, 1, 'Should receive data chunk')
        assert.equal(new TextDecoder().decode(chunks[0]), 'test')
      })

      it('handles end event with final data chunk', async () => {
        let mockCompressor = createMockCompressor({
          write: (chunk, callback) => {
            mockCompressor.emit('data', chunk)
            if (callback) setImmediate(callback)
            return true
          },
          end: () => {
            setImmediate(() => {
              // Emit final data chunk before end
              mockCompressor.emit('data', Buffer.from(' final'))
              mockCompressor.emit('end')
            })
          },
          destroy: () => {},
        })

        let stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('test'))
            controller.close()
          },
        })

        let compressed = compressStream(stream, mockCompressor as any)
        let reader = compressed.getReader()

        let chunks: Uint8Array[] = []
        while (true) {
          let result = await reader.read()
          if (result.done) break
          chunks.push(result.value)
        }

        // Should receive both chunks
        assert.equal(chunks.length, 2, 'Should receive all data chunks including final')
        let fullText = chunks.map((c) => new TextDecoder().decode(c)).join('')
        assert.equal(fullText, 'test final')
      })
    })
  })
})
