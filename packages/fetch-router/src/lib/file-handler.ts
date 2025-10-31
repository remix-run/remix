import SuperHeaders from '@remix-run/headers'

import type { RequestContext } from './request-context.ts'
import type { RequestHandler } from './request-handler.ts'
import type { RequestMethod } from './request-methods.ts'

export type FileResolver<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
> = (context: RequestContext<Method, Params>) => File | null | Promise<File | null>

export interface FileHandlerOptions {
  /**
   * Cache-Control header value. If not provided, no Cache-Control header will be set.
   *
   * @example 'public, max-age=31536000, immutable' // for hashed assets
   * @example 'public, max-age=3600' // 1 hour
   * @example 'no-cache' // always revalidate
   */
  cacheControl?: string

  /**
   * Whether to generate ETags for files.
   *
   * ETags are generated using a weak tag format based on file size and last modified time:
   * `W/"<size>-<lastModified>"`
   *
   * @default true
   */
  etag?: boolean

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
 * Creates a file handler that implements HTTP semantics for serving files.
 *
 * The handler can be used directly as a route handler, or wrapped in middleware
 * that intercepts 404 responses to fall through to other handlers.
 *
 * @param resolveFile - Function that resolves the file for a given request
 * @param options - Optional configuration for HTTP headers and features
 * @returns A route handler function
 *
 * @example
 * // Use directly as a route handler
 * let fileHandler = createFileHandler(
 *   async (context) => {
 *     let filePath = path.join('/files', context.params.path)
 *     try {
 *       return openFile(filePath)
 *     } catch {
 *       return null  // -> 404
 *     }
 *   },
 *   {
 *     etag: true,
 *     acceptRanges: true
 *   }
 * )
 *
 * router.get('/files/*path', fileHandler)
 *
 * @example
 * // Wrap in custom middleware
 * router.get('/files/*path', async (context) => {
 *   let response = await fileHandler(context)
 *   if (response.status === 404) {
 *     return new Response('Custom 404', { status: 404 })
 *   }
 *   return response
 * })
 */
export function createFileHandler<
  Method extends RequestMethod | 'ANY' = RequestMethod | 'ANY',
  Params extends Record<string, any> = {},
>(
  resolveFile: FileResolver<Method, Params>,
  options: FileHandlerOptions = {},
): RequestHandler<Method, Params> {
  let {
    cacheControl,
    etag: etagEnabled = true,
    lastModified: lastModifiedEnabled = true,
    acceptRanges: acceptRangesEnabled = true,
  } = options

  return async (context: RequestContext<Method, Params>): Promise<Response> => {
    let { request } = context

    // Only support GET and HEAD methods
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: {
          Allow: 'GET, HEAD',
        },
      })
    }

    // Resolve the file
    let file = await resolveFile(context)

    if (!file) {
      return new Response('Not Found', { status: 404 })
    }

    let contentType = file.type
    let contentLength = file.size

    let etag: string | undefined
    if (etagEnabled) {
      etag = generateWeakETag(file)
    }

    let lastModified: number | undefined
    if (lastModifiedEnabled) {
      lastModified = file.lastModified
    }

    let acceptRanges: 'bytes' | undefined
    if (acceptRangesEnabled) {
      acceptRanges = 'bytes'
    }

    // If-Match support: https://httpwg.org/specs/rfc9110.html#field.if-match
    let ifMatch = request.headers.get('If-Match')
    if (etag && ifMatch != null && !matchesETag(ifMatch, etag)) {
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
    if (lastModified && ifMatch == null) {
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

      let ifNoneMatch = context.headers.ifNoneMatch
      let ifModifiedSinceDate = context.headers.ifModifiedSince

      if (ifNoneMatch.tags.length > 0) {
        if (etag && ifNoneMatch.matches(etag)) {
          shouldReturnNotModified = true
        }
      } else if (ifModifiedSinceDate != null && lastModified) {
        let ifModifiedSinceTime = ifModifiedSinceDate.getTime()
        if (roundToSecond(lastModified) <= roundToSecond(ifModifiedSinceTime)) {
          shouldReturnNotModified = true
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
    if (acceptRanges && request.method === 'GET') {
      let range = request.headers.get('Range')
      if (range) {
        let shouldProcessRange = true

        let ifRange = request.headers.get('If-Range')
        if (ifRange != null) {
          // Since we only use weak ETags, we can only compare Last-Modified timestamps
          let ifRangeTime = parseHttpDate(ifRange)
          shouldProcessRange = Boolean(
            lastModified &&
              ifRangeTime &&
              roundToSecond(lastModified) === roundToSecond(ifRangeTime),
          )
        }

        if (shouldProcessRange) {
          let rangeResult = parseRangeHeader(range, file.size)

          if (rangeResult.type === 'malformed') {
            return new Response('Bad Request', {
              status: 400,
            })
          }

          if (rangeResult.type === 'unsatisfiable') {
            return new Response('Range Not Satisfiable', {
              status: 416,
              headers: {
                'Content-Range': `bytes */${file.size}`,
              },
            })
          }

          let { start, end } = rangeResult
          let { size } = file

          return new Response(file.slice(start, end + 1), {
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
    }

    return new Response(request.method === 'HEAD' ? null : file, {
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
}

function generateWeakETag(file: File): string {
  return `W/"${file.size}-${file.lastModified}"`
}

function matchesETag(ifNoneMatch: string, etag: string): boolean {
  let tags = ifNoneMatch.split(',').map((tag) => tag.trim())
  return tags.includes(etag) || tags.includes('*')
}

/**
 * Rounds a timestamp to second precision.
 * HTTP Last-Modified headers only have second precision, so this is used
 * when comparing dates for conditional requests.
 */
function roundToSecond(timestamp: number): number {
  return Math.floor(timestamp / 1000)
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

const rangeHeaderPattern = /^bytes=(.+)$/
const rangeHeaderPartPattern = /^(\d*)-(\d*)$/

type ParseRangeResult =
  | { type: 'success'; start: number; end: number }
  | { type: 'malformed' }
  | { type: 'unsatisfiable' }

/**
 * Parses a single range header part (e.g., "0-99", "100-", "-500"). Returns a
 * result indicating success with normalized bounds, or malformed/unsatisfiable.
 */
function parseRangeHeaderPart(rangeHeaderPart: string, fileSize: number): ParseRangeResult {
  let match = rangeHeaderPart.trim().match(rangeHeaderPartPattern)
  if (!match) {
    return { type: 'malformed' }
  }

  let [, startStr, endStr] = match

  // At least one bound must be specified
  if (!startStr && !endStr) {
    return { type: 'malformed' }
  }

  let start = startStr ? parseInt(startStr, 10) : null
  let end = endStr ? parseInt(endStr, 10) : null

  // Normalize the range based on what's specified
  if (start != null && end != null) {
    // Both bounds specified (e.g., "0-99")
    if (start > end) {
      return { type: 'malformed' }
    }

    // Clamp end to file size
    if (end >= fileSize) {
      end = fileSize - 1
    }
  } else if (start != null) {
    // Only start specified (e.g., "100-")
    end = fileSize - 1
  } else {
    // Only end specified (e.g., "-500" means last 500 bytes)
    let suffix = end!
    start = Math.max(0, fileSize - suffix)
    end = fileSize - 1
  }

  if (start >= fileSize) {
    return { type: 'unsatisfiable' }
  }

  return { type: 'success', start, end }
}

/**
 * Parses a Range header value. Returns a result object with a type of
 * 'success', 'malformed', or 'unsatisfiable'. The `start` and `end` values are
 * only present if the type is 'success'. Multipart ranges are not supported.
 */
function parseRangeHeader(range: string, fileSize: number): ParseRangeResult {
  // Extract the bytes= portion
  let bytesMatch = range.trim().match(rangeHeaderPattern)

  if (!bytesMatch) {
    return { type: 'malformed' }
  }

  let rangeParts = bytesMatch[1].split(',')

  let firstRangeResult: ParseRangeResult | undefined
  for (let rangePart of rangeParts) {
    let rangePartResult = parseRangeHeaderPart(rangePart, fileSize)
    if (!firstRangeResult) {
      firstRangeResult = rangePartResult
    }
    if (rangePartResult.type === 'malformed') {
      return { type: 'malformed' }
    }
  }

  if (!firstRangeResult) {
    return { type: 'malformed' }
  }

  if (rangeParts.length > 1) {
    // If we're here, the client sent valid multipart ranges, so we want to
    // communicate that their request is syntactically valid but unsatisfiable.
    // This is to keep it distinct from a malformed range header.
    return { type: 'unsatisfiable' }
  }

  return firstRangeResult
}
