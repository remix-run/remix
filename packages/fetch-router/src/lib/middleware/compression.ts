import type { Middleware } from '../middleware.ts'
import { compress, type CompressOptions } from '../response-helpers/compress.ts'
import { compressibleMediaTypes } from '../compressible-media-types.ts'

export interface CompressionOptions extends CompressOptions {
  /**
   * Optional filter to control which responses get compressed based on media type.
   * If not provided, uses compressible media types from mime-db.
   */
  filterMediaType?: (mediaType: string) => boolean
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
  let { filterMediaType = isCompressibleMediaType, ...compressOptions } = options ?? {}

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

    if (!filterMediaType(mediaType)) {
      return response
    }

    return compress(response, context.request, compressOptions)
  }
}

/**
 * Checks if a media type (MIME type) is known to be compressible.
 *
 * Returns true for:
 * - Compressible media types from mime-db, except for types starting with `x-` (experimental) or `vnd.` (vendor-specific).
 * - Any text/* type
 * - Types with +json, +text, or +xml suffix
 *
 * @param mediaType The media type to check (e.g. "application/json")
 * @returns true if the media type is known to be compressible
 */
export function isCompressibleMediaType(mediaType: string): boolean {
  if (!mediaType) return false

  if (compressibleMediaTypes.has(mediaType)) {
    return true
  }

  return genericCompressibleRegex.test(mediaType)
}

// Check for text/*, or anything with +json, +text, or +xml suffix
const genericCompressibleRegex = /^text\/|\+(?:json|text|xml)$/i
