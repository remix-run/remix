import SuperHeaders from '@remix-run/headers'

import type { RequestContext } from '../request-context.ts'
import type { RequestMethod } from '../request-methods.ts'

/**
 * Custom function for computing file digests.
 *
 * @param file - The file to hash
 * @returns The computed digest as a string
 *
 * @example
 * async (file) => {
 *   let buffer = await file.arrayBuffer()
 *   return customHash(buffer)
 * }
 */
export type FileDigestFunction = (file: File) => Promise<string>

/**
 * Function to generate cache keys for digest storage.
 *
 * @param params - Object containing the file path and File object
 * @returns The cache key as a string
 *
 * @example
 * ({ path, file }) => `${path}:${file.lastModified}`
 * @example
 * ({ path, file }) => `v2:${path}:${file.lastModified}`
 */
export type FileDigestCacheKeyFunction = (params: { path: string; file: File }) => string

/**
 * Hash algorithm name for SubtleCrypto.digest() or custom digest function.
 */
type DigestAlgorithm = 'SHA-256' | 'SHA-512' | 'SHA-384' | 'SHA-1' | (string & {}) // Allows any string while providing autocomplete for common algorithms

/**
 * Cache interface for storing computed file digests.
 */
interface DigestCache {
  get(key: string): Promise<string | undefined> | string | undefined
  set(key: string, digest: string): void
}

export interface FileResponseInit {
  /**
   * Cache-Control header value. If not provided, no Cache-Control header will be set.
   *
   * @example 'public, max-age=31536000, immutable' // for hashed assets
   * @example 'public, max-age=3600' // 1 hour
   * @example 'no-cache' // always revalidate
   */
  cacheControl?: string

  /**
   * ETag generation strategy.
   *
   * - `'weak'`: Generates weak ETags based on file size and last modified time (`W/"<size>-<mtime>"`)
   * - `'strong'`: Generates strong ETags by hashing file content (requires digest computation)
   * - `false`: Disables ETag generation
   *
   * @default 'weak'
   */
  etag?: false | 'weak' | 'strong'

  /**
   * Hash algorithm or custom digest function for strong ETags.
   *
   * When `etag` is `'strong'`, this determines how the file content is hashed.
   * - String: Algorithm name for SubtleCrypto.digest() (e.g., 'SHA-256', 'SHA-512')
   * - Function: Custom digest computation that receives a File and returns the digest string
   *
   * Only used when `etag: 'strong'`. Ignored for weak ETags.
   *
   * @default 'SHA-256'
   * @example 'SHA-512'
   * @example async (file) => customHash(await file.arrayBuffer())
   */
  digest?: DigestAlgorithm | FileDigestFunction

  /**
   * Cache for storing computed file digests to avoid re-hashing files.
   *
   * Only used when `etag: 'strong'`. Since hashing file content is expensive,
   * providing a cache is strongly recommended for production use.
   *
   * Any object with `get(key)` and `set(key, digest)` methods can be used.
   * If not provided, digests will be computed on every request.
   *
   * @example new Map()
   */
  digestCache?: DigestCache

  /**
   * Function to generate cache keys for digest storage.
   *
   * The default includes file path and last modified time to ensure cache invalidation
   * when files change: `${path}:${file.lastModified}`
   *
   * The `path` is provided by the file resolver.
   *
   * Only used when `etag: 'strong'` and `digestCache` is provided.
   *
   * @default ({ path, file }) => `${path}:${file.lastModified}`
   * @example ({ path, file }) => `prefix:${path}:${file.lastModified}`
   */
  digestCacheKey?: FileDigestCacheKeyFunction

  /**
   * Whether to include Last-Modified headers.
   *
   * @default true
   */
  lastModified?: boolean

  /**
   * Whether to support HTTP Range requests for partial content.
   *
   * When enabled, includes Accept-Ranges header and handles Range requests
   * with 206 Partial Content responses.
   *
   * @default true
   */
  acceptRanges?: boolean
}

/**
 * A helper for working with file [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)s.
 *
 * Returns a Response with full HTTP semantics including ETags, Last-Modified,
 * conditional requests, and Range support.
 *
 * The file's `name` property should contain the full absolute path on the server.
 *
 * @param file - The file to send
 * @param context - The request context
 * @param init - Optional configuration for HTTP headers and features
 * @returns A Response with appropriate headers and body
 *
 * @example
 * let result = await findFile('./public', 'image.jpg')
 * if (result) {
 *   return file(result, context, {
 *     cacheControl: 'public, max-age=3600'
 *   })
 * }
 */
export async function file<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
>(
  fileToSend: File,
  context: RequestContext<Method, Params>,
  init: FileResponseInit = {},
): Promise<Response> {
  let { request } = context
  let path = fileToSend.name

  let {
    cacheControl,
    etag: etagStrategy = 'weak',
    digest: digestOption = 'SHA-256',
    digestCache,
    digestCacheKey = ({ path, file }: { path: string; file: File }) =>
      `${path}:${file.lastModified}`,
    lastModified: lastModifiedEnabled = true,
    acceptRanges: acceptRangesEnabled = true,
  } = init

  // Only support GET and HEAD methods
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: new SuperHeaders({
        allow: ['GET', 'HEAD'],
      }),
    })
  }

  let contentType = fileToSend.type
  let contentLength = fileToSend.size

  let etag: string | undefined
  if (etagStrategy === 'weak') {
    etag = generateWeakETag(fileToSend)
  } else if (etagStrategy === 'strong') {
    let digest = await computeDigest(path, fileToSend, digestOption, digestCache, digestCacheKey)
    etag = `"${digest}"`
  }

  let lastModified: number | undefined
  if (lastModifiedEnabled) {
    lastModified = fileToSend.lastModified
  }

  let acceptRanges: 'bytes' | undefined
  if (acceptRangesEnabled) {
    acceptRanges = 'bytes'
  }

  let hasIfMatch = context.headers.has('If-Match')

  // If-Match support: https://httpwg.org/specs/rfc9110.html#field.if-match
  if (etag && hasIfMatch && !context.headers.ifMatch.matches(etag)) {
    return new Response('Precondition Failed', {
      status: 412,
      headers: new SuperHeaders({
        etag,
        lastModified,
        acceptRanges,
      }),
    })
  }

  // If-Unmodified-Since support: https://httpwg.org/specs/rfc9110.html#field.if-unmodified-since
  if (lastModified && !hasIfMatch) {
    let ifUnmodifiedSinceDate = context.headers.ifUnmodifiedSince
    if (ifUnmodifiedSinceDate != null) {
      let ifUnmodifiedSinceTime = ifUnmodifiedSinceDate.getTime()
      if (roundToSecond(lastModified) > roundToSecond(ifUnmodifiedSinceTime)) {
        return new Response('Precondition Failed', {
          status: 412,
          headers: new SuperHeaders({
            etag,
            lastModified,
            acceptRanges,
          }),
        })
      }
    }
  }

  // If-None-Match support: https://httpwg.org/specs/rfc9110.html#field.if-none-match
  // If-Modified-Since support: https://httpwg.org/specs/rfc9110.html#field.if-modified-since
  if (etag || lastModified) {
    let shouldReturnNotModified = false

    if (etag && context.headers.ifNoneMatch.matches(etag)) {
      shouldReturnNotModified = true
    } else if (lastModified && context.headers.ifNoneMatch.tags.length === 0) {
      let ifModifiedSinceDate = context.headers.ifModifiedSince
      if (ifModifiedSinceDate != null) {
        let ifModifiedSinceTime = ifModifiedSinceDate.getTime()
        if (roundToSecond(lastModified) <= roundToSecond(ifModifiedSinceTime)) {
          shouldReturnNotModified = true
        }
      }
    }

    if (shouldReturnNotModified) {
      return new Response(null, {
        status: 304,
        headers: new SuperHeaders({
          etag,
          lastModified,
          acceptRanges,
        }),
      })
    }
  }

  // Range support: https://httpwg.org/specs/rfc9110.html#field.range
  // If-Range support: https://httpwg.org/specs/rfc9110.html#field.if-range
  if (acceptRanges && request.method === 'GET' && context.headers.has('Range')) {
    let range = context.headers.range

    // Check if the Range header was sent but parsing resulted in no valid ranges (malformed)
    if (range.ranges.length === 0) {
      return new Response('Bad Request', {
        status: 400,
      })
    }

    let shouldProcessRange = true

    let ifRange = request.headers.get('If-Range')
    if (ifRange != null) {
      // Since we only use weak ETags, we can only compare Last-Modified timestamps
      let ifRangeTime = parseHttpDate(ifRange)
      shouldProcessRange = Boolean(
        lastModified && ifRangeTime && roundToSecond(lastModified) === roundToSecond(ifRangeTime),
      )
    }

    if (shouldProcessRange) {
      if (!range.canSatisfy(fileToSend.size)) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: new SuperHeaders({
            contentRange: { unit: 'bytes', size: fileToSend.size },
          }),
        })
      }

      let normalized = range.normalize(fileToSend.size)

      // We only support single ranges (not multipart)
      if (normalized.length > 1) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: new SuperHeaders({
            contentRange: { unit: 'bytes', size: fileToSend.size },
          }),
        })
      }

      let { start, end } = normalized[0]
      let { size } = fileToSend

      return new Response(fileToSend.slice(start, end + 1), {
        status: 206,
        headers: new SuperHeaders({
          contentType,
          contentLength: end - start + 1,
          contentRange: { unit: 'bytes', start, end, size },
          etag,
          lastModified,
          cacheControl,
          acceptRanges,
        }),
      })
    }
  }

  return new Response(request.method === 'HEAD' ? null : fileToSend, {
    status: 200,
    headers: new SuperHeaders({
      contentType,
      contentLength,
      etag,
      lastModified,
      cacheControl,
      acceptRanges,
    }),
  })
}

function generateWeakETag(file: File): string {
  return `W/"${file.size}-${file.lastModified}"`
}

/**
 * Computes a digest (hash) for a file, with optional caching.
 *
 * @param path - The file path (for cache key generation)
 * @param file - The file to hash
 * @param digestOption - Algorithm name or custom digest function
 * @param cache - Optional cache for storing computed digests
 * @param getCacheKey - Function to generate cache key from path and file
 * @returns The computed digest as a hex string
 */
async function computeDigest(
  path: string,
  file: File,
  digestOption: DigestAlgorithm | FileDigestFunction,
  cache: DigestCache | undefined,
  getCacheKey: FileDigestCacheKeyFunction,
): Promise<string> {
  // Check cache first if provided
  if (cache) {
    let key = getCacheKey({ path, file })
    let cached = await cache.get(key)
    if (cached) {
      return cached
    }
  }

  // Compute digest
  let digest: string
  if (typeof digestOption === 'function') {
    // Custom digest function
    digest = await digestOption(file)
  } else {
    // Use SubtleCrypto with algorithm name
    digest = await hashFile(file, digestOption)
  }

  // Store in cache if provided
  if (cache) {
    let key = getCacheKey({ path, file })
    await cache.set(key, digest)
  }

  return digest
}

/**
 * Hashes a file using SubtleCrypto.
 *
 * @param file - The file to hash
 * @param algorithm - Hash algorithm name (e.g., 'SHA-256')
 * @returns The hash as a hex string
 */
async function hashFile(file: File, algorithm: string): Promise<string> {
  let buffer = await file.arrayBuffer()
  let hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  let hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Rounds a timestamp to the nearest second for comparison.
 */
function roundToSecond(time: number): number {
  return Math.floor(time / 1000)
}

const imfFixdatePattern =
  /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/

/**
 * Parses an HTTP date header value.
 * HTTP dates must follow RFC 7231 IMF-fixdate format:
 * "Day, DD Mon YYYY HH:MM:SS GMT" (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
 * Returns the timestamp in milliseconds, or null if invalid.
 */
function parseHttpDate(dateString: string): number | null {
  if (!imfFixdatePattern.test(dateString)) {
    return null
  }

  let timestamp = Date.parse(dateString)
  if (isNaN(timestamp)) {
    return null
  }

  return timestamp
}
