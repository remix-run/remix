import { findFile } from '@remix-run/lazy-file/fs'

import { file, type FileResponseOptions } from '@remix-run/fetch-router/response-helpers'
import type { Middleware } from '@remix-run/fetch-router'

/**
 * Function that determines if HTTP Range requests should be supported for a given file.
 *
 * @param file - The File object being served
 * @returns true if range requests should be supported
 */
export type AcceptRangesFunction = (file: File) => boolean

export type StaticFilesOptions = Omit<FileResponseOptions, 'acceptRanges'> & {
  /**
   * Filter function to determine which files should be served.
   *
   * @param path The relative path being requested
   * @returns Whether to serve the file
   */
  filter?: (path: string) => boolean

  /**
   * Whether to support HTTP Range requests for partial content.
   *
   * Can be a boolean or a function that receives the file.
   * When enabled, includes Accept-Ranges header and handles Range requests
   * with 206 Partial Content responses.
   *
   * Defaults to enabling ranges only for non-compressible MIME types,
   * as defined by `isCompressibleMimeType()` from `@remix-run/mime`.
   *
   * Note: Range requests and compression are mutually exclusive. When
   * `Accept-Ranges: bytes` is present in the response headers, the compression
   * middleware will not compress the response. This is why the default behavior
   * enables ranges only for non-compressible types.
   *
   * @example
   * // Force range request support for all files
   * acceptRanges: true
   *
   * @example
   * // Enable ranges for videos only
   * acceptRanges: (file) => file.type.startsWith('video/')
   */
  acceptRanges?: boolean | AcceptRangesFunction
}

/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Uses the URL pathname to resolve files, removing the leading slash to make it
 * a relative path. The middleware always falls through to the handler if the file
 * is not found or an error occurs.
 *
 * @param root The root directory to serve files from (absolute or relative to cwd)
 * @param options (optional) configuration for file responses
 *
 * @example
 * let router = createRouter({
 *   middleware: [staticFiles('./public')],
 * })
 *
 * @example
 * // With cache control
 * let router = createRouter({
 *   middleware: [
 *     staticFiles('./public', {
 *       cacheControl: 'public, max-age=3600',
 *     }),
 *   ],
 * })
 */
export function staticFiles(root: string, options: StaticFilesOptions = {}): Middleware {
  let { filter, acceptRanges, ...fileOptions } = options

  return async (context, next) => {
    if (context.method !== 'GET' && context.method !== 'HEAD') {
      return next()
    }

    let relativePath = context.url.pathname.replace(/^\/+/, '')

    if (filter && !filter(relativePath)) {
      return next()
    }

    let fileToServe = await findFile(root, relativePath)

    if (!fileToServe) {
      return next()
    }

    return file(fileToServe, context.request, {
      ...fileOptions,
      acceptRanges: typeof acceptRanges === 'function' ? acceptRanges(fileToServe) : acceptRanges,
    })
  }
}
