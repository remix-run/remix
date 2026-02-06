import * as path from 'node:path'
import type { Middleware } from '@remix-run/fetch-router'
import {
  createDevAssetsHandler,
  createDevAssets,
  type CreateDevAssetsHandlerOptions,
} from '@remix-run/assets'

/**
 * Creates a middleware that serves and transforms source files for development.
 *
 * @param options Configuration options (root, allow, deny, workspace, esbuildConfig)
 * @returns The dev assets middleware
 */
export function devAssets(options: CreateDevAssetsHandlerOptions): Middleware {
  let root = path.resolve(options.root ?? process.cwd())
  let handler = createDevAssetsHandler(options)
  let assetsApi = createDevAssets(root)

  return async (context, next) => {
    context.assets = assetsApi

    if (context.method !== 'GET' && context.method !== 'HEAD') {
      return next()
    }

    let pathname = context.url.pathname
    let headers = context.request.headers
    let response = await handler.serve(pathname, headers)

    if (response) {
      return response
    }
    return next()
  }
}
