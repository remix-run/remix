import SuperHeaders from '@remix-run/headers'
import { isCompressibleMimeType } from '@remix-run/mime'

/**
 * Custom function for computing file digests.
 *
 * @param file The file to hash
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
 * Options for creating a file response.
 */
export interface FileResponseOptions {
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
   * - String: Web Crypto API algorithm name ('SHA-256', 'SHA-384', 'SHA-512', 'SHA-1').
   *   Note: Using strong ETags will buffer the entire file into memory before hashing.
   *   Consider using weak ETags (default) or a custom digest function for large files.
   * - Function: Custom digest computation that receives a File and returns the digest string
   *
   * Only used when `etag: 'strong'`. Ignored for weak ETags.
   *
   * @default 'SHA-256'
   * @example async (file) => await customHash(file)
   */
  digest?: AlgorithmIdentifier | FileDigestFunction
  /**
   * Whether to include `Last-Modified` headers.
   *
   * @default true
   */
  lastModified?: boolean
  /**
   * Whether to support HTTP `Range` requests for partial content.
   *
   * When enabled, includes `Accept-Ranges` header and handles `Range` requests
   * with 206 Partial Content responses.
   *
   * Defaults to enabling ranges only for non-compressible MIME types,
   * as defined by `isCompressibleMimeType()` from `@remix-run/mime`.
   *
   * Note: Range requests and compression are mutually exclusive. When
   * `Accept-Ranges: bytes` is present in the response headers, the compression
   * middleware will not compress the response. This is why the default behavior
   * enables ranges only for non-compressible types.
   */
  acceptRanges?: boolean
}

/**
 * Creates a file [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * with full HTTP semantics including ETags, Last-Modified, conditional requests, and Range support.
 *
 * @param file The file to send
 * @param request The request object
 * @param options Configuration options
 * @returns A `Response` object containing the file
 *
 * @example
 * import { createFileResponse } from '@remix-run/response/file'
 * let file = openFile('./public/image.jpg')
 * return createFileResponse(file, request, {
 *   cacheControl: 'public, max-age=3600'
 * })
 */
export async function createFileResponse(
  file: File,
  request: Request,
  options: FileResponseOptions = {},
): Promise<Response> {
  let {
    cacheControl,
    etag: etagStrategy = 'weak',
    digest: digestOption = 'SHA-256',
    lastModified: lastModifiedEnabled = true,
    acceptRanges: acceptRangesOption,
  } = options

  let headers = new SuperHeaders(request.headers)

  let contentType = file.type
  let contentLength = file.size

  let etag: string | undefined
  if (etagStrategy === 'weak') {
    etag = generateWeakETag(file)
  } else if (etagStrategy === 'strong') {
    let digest = await computeDigest(file, digestOption)
    etag = `"${digest}"`
  }

  let lastModified: number | undefined
  if (lastModifiedEnabled) {
    lastModified = file.lastModified
  }

  // Determine if we should accept ranges
  // Default: enable ranges only for non-compressible MIME types
  let acceptRangesEnabled =
    acceptRangesOption !== undefined ? acceptRangesOption : !isCompressibleMimeType(contentType)

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
      if (!range.canSatisfy(file.size)) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: new SuperHeaders({
            contentRange: { unit: 'bytes', size: file.size },
          }),
        })
      }

      let normalizedRanges = range.normalize(file.size)

      // We only support single ranges (not multipart)
      if (normalizedRanges.length > 1) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: new SuperHeaders({
            contentRange: { unit: 'bytes', size: file.size },
          }),
        })
      }

      let { start, end } = normalizedRanges[0]
      let { size } = file

      return new Response(file.slice(start, end + 1), {
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

  return new Response(request.method === 'HEAD' ? null : file, {
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
 * @param file The file to hash
 * @param digestOption Web Crypto algorithm name or custom digest function
 * @returns The computed digest as a hex string
 */
async function computeDigest(
  file: File,
  digestOption: AlgorithmIdentifier | FileDigestFunction,
): Promise<string> {
  return typeof digestOption === 'function'
    ? await digestOption(file)
    : await hashFile(file, digestOption)
}

/**
 * Hashes a file using Web Crypto API.
 *
 * Note: This loads the entire file into memory before hashing. For large files,
 * consider using weak ETags (default) or providing a custom digest function.
 *
 * @param file The file to hash
 * @param algorithm Web Crypto API algorithm name (default: 'SHA-256')
 * @returns The hash as a hex string
 */
async function hashFile(file: File, algorithm: AlgorithmIdentifier = 'SHA-256'): Promise<string> {
  let buffer = await file.arrayBuffer()
  let hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Removes milliseconds from a timestamp, returning seconds.
 * HTTP dates only have second precision, so this is useful for date comparisons.
 */
function removeMilliseconds(time: number | Date): number {
  let timestamp = time instanceof Date ? time.getTime() : time
  return Math.floor(timestamp / 1000)
}
