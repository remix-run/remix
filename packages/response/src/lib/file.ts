import {
  type ContentRangeInit,
  ContentRange,
  IfMatch,
  IfNoneMatch,
  IfRange,
  Range,
} from '@remix-run/headers'
import { isCompressibleMimeType, mimeTypeToContentType } from '@remix-run/mime'

/**
 * Minimal interface for file-like objects used by `createFileResponse`.
 */
export interface FileLike {
  /** File compatibility - included for interface completeness */
  readonly name: string
  /** Used for Content-Length header and range calculations */
  readonly size: number
  /** Used for Content-Type header */
  readonly type: string
  /** Used for Last-Modified header and weak ETag generation */
  readonly lastModified: number
  /** Used for streaming the response body */
  stream(): ReadableStream<Uint8Array>
  /** Used for strong ETag digest calculation */
  arrayBuffer(): Promise<ArrayBuffer>
  /** Used for range requests (206 Partial Content) */
  slice(
    start?: number,
    end?: number,
    contentType?: string,
  ): { stream(): ReadableStream<Uint8Array> }
}

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
export type FileDigestFunction<file extends FileLike = File> = (file: file) => Promise<string>

/**
 * Options for creating a file response.
 */
export interface FileResponseOptions<file extends FileLike = File> {
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
   * - Function: Custom digest computation that receives a file and returns the digest string
   *
   * Only used when `etag: 'strong'`. Ignored for weak ETags.
   *
   * @default 'SHA-256'
   * @example async (file) => await customHash(file)
   */
  digest?: AlgorithmIdentifier | FileDigestFunction<file>
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
 * Accepts both native `File` objects and `LazyFile` from `@remix-run/lazy-file`.
 *
 * @param file The file to send (native `File` or `LazyFile`)
 * @param request The request object
 * @param options Configuration options
 * @returns A `Response` object containing the file
 *
 * @example
 * import { createFileResponse } from 'remix/response/file'
 * import { openLazyFile } from 'remix/fs'
 *
 * let lazyFile = openLazyFile('./public/image.jpg')
 * return createFileResponse(lazyFile, request, {
 *   cacheControl: 'public, max-age=3600'
 * })
 */
export async function createFileResponse<file extends FileLike>(
  file: file,
  request: Request,
  options: FileResponseOptions<file> = {},
): Promise<Response> {
  let {
    cacheControl,
    etag: etagStrategy = 'weak',
    digest: digestOption = 'SHA-256',
    lastModified: lastModifiedEnabled = true,
    acceptRanges: acceptRangesOption,
  } = options

  let headers = request.headers

  let contentType = mimeTypeToContentType(file.type)
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
  if (etag && hasIfMatch) {
    let ifMatch = IfMatch.from(headers.get('if-match'))
    if (!ifMatch.matches(etag)) {
      return new Response('Precondition Failed', {
        status: 412,
        headers: buildResponseHeaders({
          etag,
          lastModified,
          acceptRanges,
        }),
      })
    }
  }

  // If-Unmodified-Since support: https://httpwg.org/specs/rfc9110.html#field.if-unmodified-since
  if (lastModified && !hasIfMatch) {
    let ifUnmodifiedSinceHeader = headers.get('if-unmodified-since')
    if (ifUnmodifiedSinceHeader != null) {
      let ifUnmodifiedSince = new Date(ifUnmodifiedSinceHeader)
      if (removeMilliseconds(lastModified) > removeMilliseconds(ifUnmodifiedSince)) {
        return new Response('Precondition Failed', {
          status: 412,
          headers: buildResponseHeaders({
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
    let ifNoneMatch = IfNoneMatch.from(headers.get('if-none-match'))

    if (etag && ifNoneMatch.matches(etag)) {
      shouldReturnNotModified = true
    } else if (lastModified && ifNoneMatch.tags.length === 0) {
      let ifModifiedSinceHeader = headers.get('if-modified-since')
      if (ifModifiedSinceHeader != null) {
        let ifModifiedSince = new Date(ifModifiedSinceHeader)
        if (removeMilliseconds(lastModified) <= removeMilliseconds(ifModifiedSince)) {
          shouldReturnNotModified = true
        }
      }
    }

    if (shouldReturnNotModified) {
      return new Response(null, {
        status: 304,
        headers: buildResponseHeaders({
          etag,
          lastModified,
          acceptRanges,
        }),
      })
    }
  }

  // Range support: https://httpwg.org/specs/rfc9110.html#field.range
  // If-Range support: https://httpwg.org/specs/rfc9110.html#field.if-range
  if (acceptRanges && request.method === 'GET' && headers.has('Range')) {
    let range = Range.from(headers.get('range'))

    // Check if the Range header was sent but parsing resulted in no valid ranges (malformed)
    if (range.ranges.length === 0) {
      return new Response('Bad Request', {
        status: 400,
      })
    }

    // If-Range support: https://httpwg.org/specs/rfc9110.html#field.if-range
    let ifRange = IfRange.from(headers.get('if-range'))
    if (
      ifRange.matches({
        etag,
        lastModified,
      })
    ) {
      if (!range.canSatisfy(file.size)) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: buildResponseHeaders({
            contentRange: ContentRange.from({ unit: 'bytes', size: file.size }),
          }),
        })
      }

      let normalizedRanges = range.normalize(file.size)

      // We only support single ranges (not multipart)
      if (normalizedRanges.length > 1) {
        return new Response('Range Not Satisfiable', {
          status: 416,
          headers: buildResponseHeaders({
            contentRange: ContentRange.from({ unit: 'bytes', size: file.size }),
          }),
        })
      }

      let { start, end } = normalizedRanges[0]
      let { size } = file

      return new Response(file.slice(start, end + 1).stream(), {
        status: 206,
        headers: buildResponseHeaders({
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

  return new Response(request.method === 'HEAD' ? null : file.stream(), {
    status: 200,
    headers: buildResponseHeaders({
      contentType,
      contentLength,
      etag,
      lastModified,
      cacheControl,
      acceptRanges,
    }),
  })
}

function generateWeakETag(file: FileLike): string {
  return `W/"${file.size}-${file.lastModified}"`
}

interface ResponseHeaderValues {
  contentType?: string
  contentLength?: number
  contentRange?: ContentRangeInit
  etag?: string
  lastModified?: number
  cacheControl?: string
  acceptRanges?: 'bytes'
}

function buildResponseHeaders(values: ResponseHeaderValues): Headers {
  let headers = new Headers()

  if (values.contentType) {
    headers.set('Content-Type', values.contentType)
  }
  if (values.contentLength != null) {
    headers.set('Content-Length', String(values.contentLength))
  }
  if (values.contentRange) {
    let str = ContentRange.from(values.contentRange).toString()
    if (str) headers.set('Content-Range', str)
  }
  if (values.etag) {
    headers.set('ETag', values.etag)
  }
  if (values.lastModified != null) {
    headers.set('Last-Modified', new Date(values.lastModified).toUTCString())
  }
  if (values.cacheControl) {
    headers.set('Cache-Control', values.cacheControl)
  }
  if (values.acceptRanges) {
    headers.set('Accept-Ranges', values.acceptRanges)
  }

  return headers
}

/**
 * Computes a digest (hash) for a file.
 *
 * @param file The file to hash
 * @param digestOption Web Crypto algorithm name or custom digest function
 * @returns The computed digest as a hex string
 */
async function computeDigest<file extends FileLike>(
  file: file,
  digestOption: AlgorithmIdentifier | FileDigestFunction<file>,
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
async function hashFile<F extends FileLike>(
  file: F,
  algorithm: AlgorithmIdentifier = 'SHA-256',
): Promise<string> {
  let buffer = await file.arrayBuffer()
  let hashBuffer = await crypto.subtle.digest(algorithm, buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Removes milliseconds from a timestamp, returning seconds.
 * HTTP dates only have second precision, so this is useful for date comparisons.
 *
 * @param time The timestamp or Date to truncate
 * @returns The timestamp in seconds (milliseconds removed)
 */
function removeMilliseconds(time: number | Date): number {
  let timestamp = time instanceof Date ? time.getTime() : time
  return Math.floor(timestamp / 1000)
}
