import { findFile } from '@remix-run/lazy-file/fs'

import { file, type FileResponseOptions } from '../response-helpers/file.ts'
import type { Middleware } from '../middleware.ts'

export type StaticFilesOptions = FileResponseOptions & {
  /**
   * Filter function to determine which files should be served.
   *
   * @param path - The relative path being requested
   * @returns Whether to serve the file
   */
  filter?: (path: string) => boolean
}

/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * Uses the URL pathname to resolve files, removing the leading slash to make it
 * a relative path. The middleware always falls through to the handler if the file
 * is not found or an error occurs.
 *
 * @param root - The root directory to serve files from (absolute or relative to cwd)
 * @param options - Optional configuration for file responses
 *
 * @example
 * let router = createRouter({
 *   middleware: [staticFiles('./public')],
 * })
 *
 * @example
 * // With cache control
 * let router = createRouter({
 *   middleware: [staticFiles('./public', {
 *     cacheControl: 'public, max-age=3600',
 *   })],
 * })
 */
export function staticFiles(root: string, options: StaticFilesOptions = {}): Middleware {
  let { filter, ...fileOptions } = options

  return async (context, next) => {
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
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

    return file(fileToServe, context.request, fileOptions)
  }
}
