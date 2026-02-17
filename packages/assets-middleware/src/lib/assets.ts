import type { Middleware } from '@remix-run/fetch-router'
import {
  createAssetResolver,
  type AssetsManifest,
  type CreateAssetResolverOptions,
} from '@remix-run/assets'

/**
 * Options for the assets middleware.
 * When manifest uses locally-scoped paths (relative to outDir), set baseUrl
 * to the URL prefix where the build output is served (e.g. '/build/assets').
 */
export interface AssetsMiddlewareOptions {
  baseUrl?: CreateAssetResolverOptions['baseUrl']
}

/**
 * Middleware returned by assets().
 */
export type AssetsMiddleware = Middleware

/**
 * Creates middleware that provides asset resolution from an assets manifest.
 *
 * Makes `context.assets` available to route handlers for resolving entry points
 * to their built output files and module preloads.
 *
 * @param manifest A compatible AssetsManifest
 * @param options Optional baseUrl when manifest uses locally-scoped paths
 * @returns Middleware that sets `context.assets`
 *
 * @example
 * // Locally-scoped manifest (build outputs to build/assets, paths like "entry-ABC123.js")
 * assets(manifest, { baseUrl: '/build/assets' })
 * staticFiles('.', { filter: (path) => path.startsWith('build/assets/') })
 *
 * router.get('/', ({ assets }) => {
 *   let entry = assets.resolve('app/entry.tsx')
 *   // entry.href = '/build/assets/entry-ABC123.js'
 * })
 */
export function assets(
  manifest: AssetsManifest,
  options?: AssetsMiddlewareOptions,
): AssetsMiddleware {
  let resolveAsset = createAssetResolver(manifest, options)
  return (context, next) => {
    context.assets = { resolve: resolveAsset }
    return next()
  }
}
