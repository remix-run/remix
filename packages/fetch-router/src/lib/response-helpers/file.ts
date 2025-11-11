import SuperHeaders from '@remix-run/headers'

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
 * Hash algorithm name for SubtleCrypto.digest() or custom digest function.
 */
type DigestAlgorithm = 'SHA-256' | 'SHA-512' | 'SHA-384' | 'SHA-1' | (string & {}) // Allows any string while providing autocomplete for common algorithms

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
 * @param file - The file to send
 * @param request - The request object
 * @param init - Optional configuration for HTTP headers and features
 * @returns A Response with appropriate headers and body
 *
 * @example
 * let result = await findFile('./public', 'image.jpg')
 * if (result) {
 *   return file(result, request, {
 *     cacheControl: 'public, max-age=3600'
 *   })
 * }
 */
export async function file(
  fileToSend: File,
  request: Request,
  init: FileResponseInit = {},
): Promise<Response> {
  let {
    cacheControl,
    etag: etagStrategy = 'weak',
    digest: digestOption = 'SHA-256',
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

  let headers = new SuperHeaders(request.headers)

  let contentType = fileToSend.type
  let contentLength = fileToSend.size

  let etag: string | undefined
  if (etagStrategy === 'weak') {
    etag = generateWeakETag(fileToSend)
  } else if (etagStrategy === 'strong') {
    let digest = await computeDigest(fileToSend, digestOption)
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

  let hasIfMatch = headers.has('If-Match')

  // If-Match support: https://httpwg.org/specs/rfc9110.html#field.if-match
  if (etag && hasIfMatch && !headers.ifMatch.matches(etag)) {
    return new Response('Precondition Failed', {
      status: 412,
      headers: new SuperHeaders(
        omitNullableValues({
          etag,
          lastModified,
          acceptRanges,
        }),
      ),
    })
  }

  // If-Unmodified-Since support: https://httpwg.org/specs/rfc9110.html#field.if-unmodified-since
  if (lastModified && !hasIfMatch) {
    let ifUnmodifiedSince = headers.ifUnmodifiedSince
    if (ifUnmodifiedSince != null) {
      if (removeMilliseconds(lastModified) > removeMilliseconds(ifUnmodifiedSince)) {
        return new Response('Precondition Failed', {
          status: 412,
          headers: new SuperHeaders(
            omitNullableValues({
              etag,
              lastModified,
              acceptRanges,
            }),
          ),
        })
      }
    }
  }

  // If-None-Match support: https://httpwg.org/specs/rfc9110.html#field.if-none-match
  // If-Modified-Since support: https://httpwg.org/specs/rfc9110.html#field.if-modified-since
  if (etag || lastModified) {
    let shouldReturnNotModified = false

    if (etag && headers.ifNoneMatch.matches(etag)) {
      shouldReturnNotModified = true
    } else if (lastModified && headers.ifNoneMatch.tags.length === 0) {
      let ifModifiedSince = headers.ifModifiedSince
      if (ifModifiedSince != null) {
        if (removeMilliseconds(lastModified) <= removeMilliseconds(ifModifiedSince)) {
          shouldReturnNotModified = true
        }
      }
    }

    if (shouldReturnNotModified) {
      return new Response(null, {
        status: 304,
        headers: new SuperHeaders(
          omitNullableValues({
            etag,
            lastModified,
            acceptRanges,
          }),
        ),
      })
    }
  }

  // Range support: https://httpwg.org/specs/rfc9110.html#field.range
  // If-Range support: https://httpwg.org/specs/rfc9110.html#field.if-range
  if (acceptRanges && request.method === 'GET' && headers.has('Range')) {
    let range = headers.range

    // Check if the Range header was sent but parsing resulted in no valid ranges (malformed)
    if (range.ranges.length === 0) {
      return new Response('Bad Request', {
        status: 400,
      })
    }

    // If-Range support: https://httpwg.org/specs/rfc9110.html#field.if-range
    if (
      headers.ifRange.matches({
        etag,
        lastModified,
      })
    ) {
      if (!range.canSatisfy(fileToSend.size)) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: new SuperHeaders({
            contentRange: { unit: 'bytes', size: fileToSend.size },
          }),
        })
      }

      let normalizedRanges = range.normalize(fileToSend.size)

      // We only support single ranges (not multipart)
      if (normalizedRanges.length > 1) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: new SuperHeaders({
            contentRange: { unit: 'bytes', size: fileToSend.size },
          }),
        })
      }

      let { start, end } = normalizedRanges[0]
      let { size } = fileToSend

      return new Response(fileToSend.slice(start, end + 1), {
        status: 206,
        headers: new SuperHeaders(
          omitNullableValues({
            contentType,
            contentLength: end - start + 1,
            contentRange: { unit: 'bytes', start, end, size },
            etag,
            lastModified,
            cacheControl,
            acceptRanges,
          }),
        ),
      })
    }
  }

  return new Response(request.method === 'HEAD' ? null : fileToSend, {
    status: 200,
    headers: new SuperHeaders(
      omitNullableValues({
        contentType,
        contentLength,
        etag,
        lastModified,
        cacheControl,
        acceptRanges,
      }),
    ),
  })
}

function generateWeakETag(file: File): string {
  return `W/"${file.size}-${file.lastModified}"`
}

type OmitNullableValues<T> = {
  [K in keyof T as T[K] extends null | undefined ? never : K]: NonNullable<T[K]>
}

function omitNullableValues<T extends Record<string, any>>(headers: T): OmitNullableValues<T> {
  let result: any = {}
  for (let key in headers) {
    if (headers[key] != null) {
      result[key] = headers[key]
    }
  }
  return result
}

/**
 * Computes a digest (hash) for a file.
 *
 * @param file - The file to hash
 * @param digestOption - Algorithm name or custom digest function
 * @returns The computed digest as a hex string
 */
async function computeDigest(
  file: File,
  digestOption: DigestAlgorithm | FileDigestFunction,
): Promise<string> {
  return typeof digestOption === 'function'
    ? // Custom digest function
      await digestOption(file)
    : // Use SubtleCrypto with algorithm name
      await hashFile(file, digestOption)
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
 * Removes milliseconds from a timestamp, returning seconds.
 * HTTP dates only have second precision, so this is useful for date comparisons.
 */
function removeMilliseconds(time: number | Date): number {
  let timestamp = time instanceof Date ? time.getTime() : time
  return Math.floor(timestamp / 1000)
}
