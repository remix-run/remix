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
 * @param options Configuration options (root, allow, deny, workspaceRoot, workspaceAllow, workspaceDeny, sourcemap, external)
 * @returns The dev assets middleware
 */
export function devAssets(options: CreateDevAssetsHandlerOptions): Middleware {
  let root = path.resolve(options.root ?? process.cwd())
  let handler = createDevAssetsHandler(options)
  let assetsApi = createDevAssets(root)

  return async (context, next) => {
    context.assets = assetsApi

    let response = await handler.serve(context.request)
    if (response) {
      return response
    }
    return next()
  }
}
