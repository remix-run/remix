import {
  constants,
  createBrotliCompress,
  createDeflate,
  createGzip,
  type BrotliCompress,
  type Gzip,
  type Deflate,
} from 'node:zlib'
import type { BrotliOptions, ZlibOptions } from 'node:zlib'

import { AcceptEncoding, SuperHeaders } from '@remix-run/headers'

export type Encoding = 'br' | 'gzip' | 'deflate'
const defaultEncodings: Encoding[] = ['br', 'gzip', 'deflate']

export interface CompressResponseOptions {
  /**
   * Which encodings the server supports for negotiation in order of preference.
   * Supported encodings: 'br', 'gzip', 'deflate'.
   * Default: ['br', 'gzip', 'deflate']
   */
  encodings?: Encoding[]

  /**
   * node:zlib options for gzip/deflate compression.
   *
   * For SSE responses (text/event-stream), `flush: Z_SYNC_FLUSH` is automatically
   * applied unless you explicitly set a flush value.
   *
   * See: https://nodejs.org/api/zlib.html#class-options
   */
  zlib?: ZlibOptions

  /**
   * node:zlib options for Brotli compression.
   *
   * For SSE responses (text/event-stream), `flush: BROTLI_OPERATION_FLUSH` is
   * automatically applied unless you explicitly set a flush value.
   *
   * See: https://nodejs.org/api/zlib.html#class-brotlioptions
   */
  brotli?: BrotliOptions
}

/**
 * Compresses a Response based on the client's Accept-Encoding header.
 *
 * Compression is skipped for:
 * - Responses with no Accept-Encoding header (RFC 7231)
 * - Empty responses
 * - Already compressed responses
 * - Responses with Cache-Control: no-transform
 * - Responses advertising range support (Accept-Ranges: bytes)
 * - Partial content responses (206 status)
 *
 * When compressing, this function:
 * - Sets Content-Encoding header
 * - Removes Content-Length header
 * - Sets Accept-Ranges to 'none'
 * - Adds 'Accept-Encoding' to Vary header
 * - Converts strong ETags to weak ETags (per RFC 7232)
 *
 * @param response The response to compress
 * @param request The request (needed to check Accept-Encoding header)
 * @param options Optional compression settings
 * @returns A compressed Response or the original if no compression is suitable
 */
export async function compressResponse(
  response: Response,
  request: Request,
  options?: CompressResponseOptions,
): Promise<Response> {
  let compressOptions = options ?? {}
  let supportedEncodings = compressOptions.encodings ?? defaultEncodings
  let acceptEncodingHeader = request.headers.get('Accept-Encoding')
  let responseHeaders = new SuperHeaders(response.headers)

  if (
    !acceptEncodingHeader ||
    supportedEncodings.length === 0 ||
    // Empty response
    (request.method !== 'HEAD' && !response.body) ||
    // Already compressed
    responseHeaders.contentEncoding != null ||
    // Cache-Control: no-transform
    responseHeaders.cacheControl.noTransform ||
    // Response advertising range support
    responseHeaders.acceptRanges === 'bytes' ||
    // Partial content responses
    response.status === 206
  ) {
    return response
  }

  let acceptEncoding = new AcceptEncoding(acceptEncodingHeader)
  let selectedEncoding = negotiateEncoding(acceptEncoding, supportedEncodings)
  if (selectedEncoding === null) {
    // Client has explicitly rejected all supported encodings, including 'identity'
    return new Response(
      `Only ${[supportedEncodings, 'identity'].map((encoding) => `'${encoding}'`).join(', ')} encodings are supported`,
      {
        status: 406,
        statusText: 'Not Acceptable',
      },
    )
  }

  if (selectedEncoding === 'identity') {
    return response
  }

  // For HEAD requests, set compression headers without actually compressing
  if (request.method === 'HEAD') {
    setCompressionHeaders(responseHeaders, selectedEncoding)

    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  }

  return applyCompression(response, responseHeaders, selectedEncoding, compressOptions)
}

function negotiateEncoding(
  acceptEncoding: AcceptEncoding,
  supportedEncodings: readonly Encoding[],
): Encoding | 'identity' | null {
  if (acceptEncoding.encodings.length === 0) {
    return 'identity'
  }

  let preferred = acceptEncoding.getPreferred(supportedEncodings)

  if (!preferred) {
    // Clients can explicitly reject 'identity' by setting its weight to 0,
    // otherwise it is considered an acceptable fallback.
    return acceptEncoding.getWeight('identity') === 0 ? null : 'identity'
  }

  return preferred
}

function setCompressionHeaders(headers: SuperHeaders, encoding: string): void {
  headers.contentEncoding = encoding
  headers.acceptRanges = 'none'
  headers.contentLength = null
  headers.vary.add('Accept-Encoding')

  // Convert strong ETags to weak since compressed representation is byte-different
  if (headers.etag && !headers.etag.startsWith('W/')) {
    headers.etag = `W/${headers.etag}`
  }
}

const zlibFlushOptions = {
  flush: constants.Z_SYNC_FLUSH,
}

const brotliFlushOptions = {
  flush: constants.BROTLI_OPERATION_FLUSH,
}

function applyCompression(
  response: Response,
  responseHeaders: SuperHeaders,
  encoding: Encoding,
  options: CompressResponseOptions,
): Response {
  if (!response.body) {
    return response
  }

  // Detect SSE for automatic flush configuration
  let contentType = response.headers.get('Content-Type')
  let mediaType = contentType?.split(';')[0].trim()
  let isSSE = mediaType === 'text/event-stream'

  let compressor = createCompressor(encoding, {
    ...options,
    // Apply SSE flush defaults if not explicitly set
    brotli: {
      ...options.brotli,
      ...(isSSE && options.brotli?.flush === undefined ? brotliFlushOptions : null),
    },
    zlib: {
      ...options.zlib,
      ...(isSSE && options.zlib?.flush === undefined ? zlibFlushOptions : null),
    },
  })

  setCompressionHeaders(responseHeaders, encoding)

  return new Response(compressStream(response.body, compressor), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

/**
 * Compresses a response stream that bridges node:zlib to Web Streams.
 * Reads from the input stream, compresses chunks through the compressor,
 * and returns a new ReadableStream with the compressed data.
 */
export function compressStream(
  input: ReadableStream<Uint8Array>,
  compressor: Gzip | Deflate | BrotliCompress,
): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let cancelled = false
  let errored = false

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = input.getReader()

      compressor.on('data', (chunk: Buffer) => {
        if (!cancelled && !errored) {
          controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength))
        }
      })

      compressor.on('end', () => {
        if (!cancelled && !errored) {
          controller.close()
        }
      })

      compressor.on('error', (error) => {
        // Ignore duplicate error events
        if (errored) {
          return
        }
        errored = true
        if (!cancelled) {
          controller.error(error)
        }
      })

      try {
        while (true) {
          if (cancelled || errored) {
            break
          }

          let { done, value } = await reader.read()

          if (cancelled || errored) {
            break
          }

          if (done) {
            compressor.end()
            break
          }

          if (!value) {
            continue
          }

          await new Promise<void>((resolve, reject) => {
            let resolvedImmediately = false

            let canContinue = compressor.write(Buffer.from(value), (error) => {
              if (resolvedImmediately) {
                return
              }
              if (error) {
                reject(error)
              } else {
                resolve()
              }
            })

            if (canContinue) {
              resolvedImmediately = true
              resolve()
            }
          })
        }
      } catch (error) {
        errored = true
        compressor.destroy(error as Error)
        if (!cancelled) {
          controller.error(error)
        }
      } finally {
        reader.releaseLock()
      }
    },

    async cancel(reason) {
      cancelled = true
      // Destroy compressor first to unblock any pending write operations
      compressor.destroy()
      await reader?.cancel(reason)
    },
  })
}

function createCompressor(
  encoding: Encoding,
  options: CompressResponseOptions,
): Gzip | Deflate | BrotliCompress {
  switch (encoding) {
    case 'br':
      return createBrotliCompress(options.brotli)
    case 'gzip':
      return createGzip(options.zlib)
    case 'deflate':
      return createDeflate(options.zlib)
    default:
      throw new Error(`Unsupported encoding: ${encoding}`)
  }
}
