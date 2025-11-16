import { createBrotliCompress, createDeflate, createGzip } from 'node:zlib'
import type { BrotliOptions, ZlibOptions } from 'node:zlib'
import { Readable } from 'node:stream'
import type { Transform } from 'node:stream'

import { AcceptEncoding, SuperHeaders } from '@remix-run/headers'

type Encoding = 'br' | 'gzip' | 'deflate'
const defaultEncodings: readonly Encoding[] = Object.freeze(['br', 'gzip', 'deflate'])

export interface CompressOptions {
  /**
   * Minimum size in bytes to compress (only enforced if Content-Length present).
   * Default: 1024
   */
  threshold?: number

  /**
   * Which encodings the server supports for negotiation in order of preference.
   * Supported encodings: 'br', 'gzip', 'deflate'.
   * Default: ['br', 'gzip', 'deflate']
   */
  encodings?: Encoding[]

  /**
   * node:zlib options for gzip/deflate compression.
   * See: https://nodejs.org/api/zlib.html#class-options
   */
  zlib?: ZlibOptions

  /**
   * node:zlib options for Brotli compression.
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
 * - Responses smaller than threshold (default 1024 bytes)
 * - Already compressed responses
 * - Responses with Cache-Control: no-transform
 * - Responses advertising range support (Accept-Ranges: bytes)
 * - Partial content responses (206 status)
 * - Server-Sent Events (text/event-stream media type)
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
export async function compress(
  response: Response,
  request: Request,
  options?: CompressOptions,
): Promise<Response> {
  let compressOptions = options ?? {}
  let acceptEncodingHeader = request.headers.get('Accept-Encoding')
  let responseHeaders = new SuperHeaders(response.headers)

  if (
    !acceptEncodingHeader ||
    // Empty response
    (request.method !== 'HEAD' && !response.body) ||
    // Response smaller than threshold
    (responseHeaders.contentLength !== null &&
      responseHeaders.contentLength < (compressOptions.threshold ?? 1024)) ||
    // Already compressed
    responseHeaders.contentEncoding != null ||
    // Cache-Control: no-transform
    responseHeaders.cacheControl.noTransform ||
    // Response advertising range support
    responseHeaders.acceptRanges === 'bytes' ||
    // Partial content responses
    response.status === 206 ||
    // Server-Sent Events
    responseHeaders.contentType?.mediaType === 'text/event-stream'
  ) {
    return response
  }

  let acceptEncoding = new AcceptEncoding(acceptEncodingHeader)
  let supportedEncodings = compressOptions.encodings ?? defaultEncodings
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

  return compressStream(response, responseHeaders, selectedEncoding, compressOptions)
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

function compressStream(
  response: Response,
  responseHeaders: SuperHeaders,
  encoding: Encoding,
  options: CompressOptions,
): Response {
  let compressionTransform = createCompressionTransform(encoding, options)

  let compressedStream = Readable.toWeb(
    Readable.fromWeb(response.body as any).pipe(compressionTransform),
  ) as ReadableStream<Uint8Array>

  setCompressionHeaders(responseHeaders, encoding)

  return new Response(compressedStream, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

function createCompressionTransform(encoding: Encoding, options: CompressOptions): Transform {
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
