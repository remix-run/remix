import type { Middleware } from '@remix-run/fetch-router'
import { createAssets, type AssetManifest, type CreateAssetsOptions } from '@remix-run/assets'

/**
 * Options for the assets middleware.
 * When manifest uses locally-scoped paths (relative to outDir), set baseUrl
 * to the URL prefix where the build output is served (e.g. '/build/assets').
 */
export interface AssetsMiddlewareOptions {
  baseUrl?: CreateAssetsOptions['baseUrl']
}

/**
 * Middleware returned by assets().
 */
export type AssetsMiddleware = Middleware

/**
 * Creates middleware that provides asset resolution from an esbuild metafile.
 *
 * Makes `context.assets` available to route handlers for resolving entry points
 * to their built output files and chunks.
 *
 * @param manifest An esbuild metafile or compatible AssetManifest
 * @param options Optional baseUrl when manifest uses locally-scoped paths
 * @returns Middleware that sets `context.assets`
 *
 * @example
 * // Locally-scoped manifest (build outputs to build/assets, paths like "entry-ABC123.js")
 * assets(manifest, { baseUrl: '/build/assets' })
 * staticFiles('.', { filter: (path) => path.startsWith('build/assets/') })
 *
 * router.get('/', ({ assets }) => {
 *   let entry = assets.get('app/entry.tsx')
 *   // entry.href = '/build/assets/entry-ABC123.js'
 * })
 */
export function assets(
  manifest: AssetManifest,
  options?: AssetsMiddlewareOptions,
): AssetsMiddleware {
  let assetsApi = createAssets(manifest, options)
  return (context, next) => {
    context.assets = assetsApi
    return next()
  }
}
