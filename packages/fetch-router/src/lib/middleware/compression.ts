import type { BrotliOptions, ZlibOptions } from 'node:zlib'
import { isCompressibleMimeType } from '@remix-run/mime'

import type { Middleware } from '../middleware.ts'
import { compress, type CompressOptions } from '../response-helpers/compress.ts'

type Encoding = 'br' | 'gzip' | 'deflate'

export interface CompressionOptions {
  /**
   * Minimum size in bytes to compress (only enforced if Content-Length present).
   * Default: 1024
   */
  threshold?: number

  /**
   * Optional filter to control which responses get compressed based on media type.
   * If not provided, uses compressible media types from mime-db.
   */
  filterMediaType?: (mediaType: string) => boolean

  /**
   * Which encodings the server supports for negotiation in order of preference.
   * Can be static or a function that returns encodings based on the response.
   *
   * Default: ['br', 'gzip', 'deflate']
   */
  encodings?: Encoding[] | ((response: Response) => Encoding[])

  /**
   * node:zlib options for gzip/deflate compression.
   * Can be static or a function that returns options based on the response.
   *
   * See: https://nodejs.org/api/zlib.html#class-options
   */
  zlib?: ZlibOptions | ((response: Response) => ZlibOptions)

  /**
   * node:zlib options for Brotli compression.
   * Can be static or a function that returns options based on the response.
   *
   * See: https://nodejs.org/api/zlib.html#class-brotlioptions
   */
  brotli?: BrotliOptions | ((response: Response) => BrotliOptions)
}

/**
 * Creates a middleware handler that automatically compresses responses based on the
 * client's Accept-Encoding header, along with an additional Content-Type filter
 * by default to only apply compression to appropriate media types.
 *
 * @param options Optional compression settings
 * @returns A middleware handler that automatically compresses responses based on the client's Accept-Encoding header
 * @example
 * ```ts
 * let router = createRouter({
 *   middleware: [compression()],
 * })
 * ```
 */
export function compression(options?: CompressionOptions): Middleware {
  return async (context, next) => {
    let response = await next()

    let contentTypeHeader = response.headers.get('Content-Type')
    if (!contentTypeHeader) {
      return response
    }

    let mediaType = contentTypeHeader.split(';')[0].trim()
    if (!mediaType) {
      return response
    }

    let filterMediaType = options?.filterMediaType ?? isCompressibleMimeType
    if (!filterMediaType(mediaType)) {
      return response
    }

    // If Content-Length is present and below threshold, skip compression.
    // Otherwise, compress (including when Content-Length is absent - we assume it's large enough)
    let contentLengthHeader = response.headers.get('Content-Length')
    if (contentLengthHeader !== null) {
      let contentLength = parseInt(contentLengthHeader, 10)
      if (!isNaN(contentLength) && contentLength < (options?.threshold ?? 1024)) {
        return response
      }
    }

    let compressOptions: CompressOptions = {
      encodings: options?.encodings
        ? typeof options.encodings === 'function'
          ? options.encodings(response)
          : options.encodings
        : undefined,
      zlib: options?.zlib
        ? typeof options.zlib === 'function'
          ? options.zlib(response)
          : options.zlib
        : undefined,
      brotli: options?.brotli
        ? typeof options.brotli === 'function'
          ? options.brotli(response)
          : options.brotli
        : undefined,
    }

    return compress(response, context.request, compressOptions)
  }
}
