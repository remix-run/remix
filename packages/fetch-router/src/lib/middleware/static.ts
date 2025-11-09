import { findFile } from '@remix-run/lazy-file/fs'

import { file, type FileResponseInit } from '../response-helpers/file.ts'
import type { Middleware } from '../middleware.ts'
import type { RequestContext } from '../request-context.ts'
import type { RequestMethod } from '../request-methods.ts'

export type StaticFilesOptions<
  Method extends RequestMethod | 'ANY',
  Params extends Record<string, any>,
> = FileResponseInit & {
  path?: (context: RequestContext<Method, Params>) => string | null | Promise<string | null>
}

/**
 * Resolver that extracts the pathname from the request context, without a
 * leading slash so it's suitable for use as a relative file path.
 *
 * @example
 * // Request to http://example.com/assets/style.css
 * // Returns: "assets/style.css"
 */
function requestPathnameResolver(context: RequestContext): string {
  return context.url.pathname.replace(/^\/+/, '')
}

/**
 * Creates a middleware that serves static files from the filesystem.
 *
 * By default, uses the URL pathname to resolve files. Optionally accepts a
 * custom `path` resolver to customize file resolution (e.g., to use route params).
 * The middleware always falls through to the handler if the file is not found or an error occurs.
 *
 * @param root - The root directory to serve files from (absolute or relative to cwd)
 * @param options - Optional configuration
 *
 * @example
 * // Use URL pathname
 * let router = createRouter({
 *   middleware: [staticFiles('./public')],
 * })
 *
 * @example
 * // Custom path resolver using route params
 * router.get('/assets/*path', {
 *   middleware: [staticFiles('./assets', {
 *     path: ({ params }) => params.path,
 *   })],
 *   handler() { return new Response('Not Found', { status: 404 }) }
 * })
 */
export function staticFiles<
  Method extends RequestMethod | 'ANY',
  Params extends Record<string, any>,
>(root: string, options: StaticFilesOptions<Method, Params> = {}): Middleware<Method, Params> {
  let { path: pathResolver = requestPathnameResolver, ...fileResponseInit } = options

  return async (context, next) => {
    // Only handle GET and HEAD requests
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      return next()
    }

    let relativePath = await pathResolver(context)

    if (relativePath === null) {
      return next()
    }

    let fileToServe = await findFile(root, relativePath)

    if (!fileToServe) {
      return next()
    }

    return file(fileToServe, context, fileResponseInit)
  }
}
