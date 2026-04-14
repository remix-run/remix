import * as path from 'node:path'
import * as fs from 'node:fs'
import { isAssetServerCompilationError } from './compilation-error.ts'
import { createAccessPolicy } from './access.ts'
import { createModuleCompiler, createResponseForModule } from './scripts/compiler.ts'
import { normalizeFilePath } from './paths.ts'
import { compileRoutes } from './routes.ts'
import type { AssetRouteDefinition, CompiledRoutes } from './routes.ts'
import { createAssetServerWatcher } from './watch.ts'
import type { AssetServerWatcher } from './watch.ts'

interface AssetServerWatchOptions {
  /**
   * Ignore matching file paths.
   */
  ignore?: readonly string[]
  /**
   * Use polling instead of native filesystem events. Defaults to `false`.
   */
  poll?: boolean
  /**
   * Polling interval in milliseconds when `poll` is enabled. Defaults to `100`.
   */
  pollInterval?: number
}

interface FingerprintOptions {
  /**
   * Per-build invalidation token that must change whenever fingerprinted module URLs
   * should be invalidated together.
   */
  buildId: string
}

const scriptTargets = [
  'es2015',
  'es2016',
  'es2017',
  'es2018',
  'es2019',
  'es2020',
  'es2021',
  'es2022',
  'es2023',
  'es2024',
  'es2025',
  'es2026',
  'esnext',
] as const
const scriptTargetSet = new Set<string>(scriptTargets)

export type ScriptsTarget = (typeof scriptTargets)[number]

export interface AssetServerOptions {
  /** Routes that map public URL patterns to file-space patterns. */
  routes: ReadonlyArray<AssetRouteDefinition>
  /**
   * Root directory used to resolve relative file-space patterns. Defaults to `process.cwd()`.
   */
  root?: string
  /**
   * File-space allow-list paths or filesystem glob patterns. Relative values are resolved from `root`.
   */
  allow: readonly string[]
  /**
   * File-space deny-list paths or filesystem glob patterns. Relative values are resolved from `root`.
   */
  deny?: readonly string[]
  /**
   * Controls optional source-based URL fingerprinting for rewritten import URLs.
   *
   * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
   * Cannot be used together with `watch`.
   */
  fingerprint?: FingerprintOptions
  /**
   * Script pipeline configuration. Omit to use defaults.
   */
  scripts?: {
    /**
     * Source map mode (disabled when omitted).
     * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
     * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
     */
    sourceMaps?: 'inline' | 'external'
    /**
     * Controls the source paths written into source map `sources`.
     * - `'url'` (default): use the stable server path (e.g. `'/assets/app/entry.ts'`)
     * - `'absolute'`: use the original filesystem path on disk
     */
    sourceMapSourcePaths?: 'url' | 'absolute'
    /**
     * Minify emitted modules.
     */
    minify?: boolean
    /**
     * Replace global expressions with constant values during transform, e.g.
     * `{ 'process.env.NODE_ENV': '"production"' }`
     */
    define?: Record<string, string>
    /**
     * Lower emitted syntax to a specific ECMAScript target. Omit this option to preserve
     * modern syntax unless project configuration already requests a lower target.
     */
    target?: ScriptsTarget
    /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
    external?: string[]
  }
  /**
   * Enable filesystem-backed cache invalidation for long-lived server instances.
   * Pass `true` to use the default watcher options, or an options object to
   * customize the watcher behavior.
   */
  watch?: boolean | AssetServerWatchOptions
  /**
   * Handles unexpected request-time compilation errors. Return a `Response` to override the
   * default `500 Internal Server Error` response, or return nothing to use the default.
   */
  onError?: (error: unknown) => void | Response | Promise<void | Response>
}

export interface AssetServer {
  /**
   * Serves a script request. Returns `Response | null` — null means the request was not
   * handled by this server, letting the router fall through to a 404.
   */
  fetch(request: Request): Promise<Response | null>
  /**
   * Returns the request href for a served module file.
   */
  getHref(filePath: string): Promise<string>
  /**
   * Returns preload URLs for one or more served module files, ordered shallowest-first.
   */
  getPreloads(filePath: string | readonly string[]): Promise<string[]>
  /**
   * Closes any watcher resources owned by this server instance.
   */
  close(): Promise<void>
}

type AssetServerInternals = {
  watcher: AssetServerWatcher | null
}

const internalStateByAssetServer = new WeakMap<AssetServer, AssetServerInternals>()

type ResolvedAssetServerOptions = {
  allow: readonly string[]
  buildId?: string
  define?: Record<string, string>
  deny?: readonly string[]
  external: string[]
  fingerprintModules: boolean
  minify: boolean
  onError: NonNullable<AssetServerOptions['onError']>
  root: string
  routeDefinitions: readonly AssetRouteDefinition[]
  routes: CompiledRoutes
  sourceMapSourcePaths: 'url' | 'absolute'
  sourceMaps?: 'inline' | 'external'
  scriptsTarget?: ScriptsTarget
  watchOptions: AssetServerWatchOptions | null
}

// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function getInternalAssetServerWatchedDirectories(assetServer: AssetServer): string[] {
  return internalStateByAssetServer.get(assetServer)?.watcher?.getWatchedDirectories() ?? []
}

// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function waitForInternalAssetServerWatcher(assetServer: AssetServer): Promise<void> {
  return internalStateByAssetServer.get(assetServer)?.watcher?.whenReady() ?? Promise.resolve()
}

/**
 * Create an asset server instance
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, caching, and configurable route mapping.
 *
 * @param options Server configuration
 * @returns A {@link AssetServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
 *
 * @example
 * ```ts
 * let assetServer = createAssetServer({
 *   routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/*path' }],
 *   allow: ['app/**'],
 * })
 *
 * route('/assets/*path', ({ request }) => assetServer.fetch(request))
 * ```
 */
export function createAssetServer(options: AssetServerOptions): AssetServer {
  let resolvedOptions = resolveAssetServerOptions(options)
  let accessPolicy = createAccessPolicy({
    allow: resolvedOptions.allow,
    deny: resolvedOptions.deny,
    root: resolvedOptions.root,
  })
  let moduleCompiler = createModuleCompiler({
    buildId: resolvedOptions.buildId,
    define: resolvedOptions.define,
    external: resolvedOptions.external,
    fingerprintModules: resolvedOptions.fingerprintModules,
    isAllowed: accessPolicy.isAllowed,
    minify: resolvedOptions.minify,
    root: resolvedOptions.root,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps,
    target: resolvedOptions.scriptsTarget,
  })
  let watcher = resolvedOptions.watchOptions
    ? createAssetServerWatcher({
        ...resolvedOptions.watchOptions,
        onFileEvent: handleWatchEvent,
        root: resolvedOptions.root,
        routes: resolvedOptions.routeDefinitions,
      })
    : null

  async function responseForError(error: unknown): Promise<Response> {
    try {
      return (await resolvedOptions.onError(error)) ?? internalServerError()
    } catch (error) {
      console.error(`There was an error in the asset server error handler: ${error}`)
      return internalServerError()
    }
  }

  async function handleWatchEvent(filePath: string, event: 'add' | 'change' | 'unlink') {
    try {
      await moduleCompiler.handleFileEvent(filePath, event)
    } catch (error) {
      console.error(`There was an error invalidating the asset server cache: ${error}`)
    }
  }

  let assetServer: AssetServer = {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let parsedRequestPathname = moduleCompiler.parseRequestPathname(new URL(request.url).pathname)
      if (!parsedRequestPathname) return null

      try {
        let ifNoneMatch = request.headers.get('If-None-Match')
        let compiledModule = await moduleCompiler.compileModule(parsedRequestPathname.filePath)

        if (parsedRequestPathname.requestedFingerprint !== null) {
          if (compiledModule.fingerprint !== parsedRequestPathname.requestedFingerprint) return null
        }

        return createResponseForModule(compiledModule, {
          cacheControl: parsedRequestPathname.cacheControl,
          ifNoneMatch,
          isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
          method: request.method,
        })
      } catch (error) {
        // A direct request can race with the filesystem or fail a deeper allow check while
        // compiling imports. In this fetch context, both cases should fall through as "not
        // handled here" so the outer router can continue to its own 404 behavior.
        if (
          isAssetServerCompilationError(error) &&
          (error.code === 'MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_ALLOWED')
        ) {
          return null
        }

        return responseForError(error)
      }
    },

    async getHref(filePath) {
      return moduleCompiler.getHref(filePath)
    },
    async getPreloads(filePath) {
      return moduleCompiler.getPreloadUrls(filePath)
    },
    async close() {
      await watcher?.close()
    },
  }

  internalStateByAssetServer.set(assetServer, {
    watcher,
  })

  return assetServer
}

function internalServerError(): Response {
  return new Response('Internal Server Error', {
    status: 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function defaultErrorHandler(error: unknown): void {
  console.error(error)
}

function resolveAssetServerOptions(options: AssetServerOptions): ResolvedAssetServerOptions {
  let root = normalizeFilePath(fs.realpathSync(path.resolve(options.root ?? process.cwd())))
  let scriptOptions = options.scripts ?? {}
  let fingerprintOptions = normalizeFingerprintOptions({
    fingerprint: options.fingerprint,
    watch: options.watch,
  })

  return {
    allow: options.allow,
    buildId: fingerprintOptions.buildId,
    define: scriptOptions.define,
    deny: options.deny,
    external: scriptOptions.external ?? [],
    fingerprintModules: fingerprintOptions.enabled,
    minify: scriptOptions.minify ?? false,
    onError: options.onError ?? defaultErrorHandler,
    root,
    routeDefinitions: options.routes,
    routes: compileRoutes({
      root,
      routes: options.routes,
    }),
    sourceMapSourcePaths: scriptOptions.sourceMapSourcePaths ?? 'url',
    sourceMaps: scriptOptions.sourceMaps,
    scriptsTarget: normalizeTarget(scriptOptions.target),
    watchOptions: normalizeWatchOptions(options.watch),
  }
}

function normalizeTarget(
  target: NonNullable<AssetServerOptions['scripts']>['target'],
): ScriptsTarget | undefined {
  if (target == null) return undefined

  if (typeof target !== 'string' || !scriptTargetSet.has(target)) {
    throw new TypeError(
      `Expected target to be one of ${scriptTargets.map((value) => `"${value}"`).join(', ')}. Received "${target}".`,
    )
  }

  return target as ScriptsTarget
}

function normalizeFingerprintOptions(options: {
  fingerprint: AssetServerOptions['fingerprint']
  watch: AssetServerOptions['watch']
}):
  | {
      enabled: false
      buildId?: string
    }
  | {
      enabled: true
      buildId: string
    } {
  if (!options.fingerprint) {
    return {
      enabled: false,
    }
  }

  if (typeof options.fingerprint.buildId !== 'string') {
    throw new TypeError('fingerprint.buildId must be a string')
  }

  if (options.fingerprint.buildId.length === 0) {
    throw new TypeError('fingerprint.buildId must be a non-empty string')
  }

  if (options.watch) {
    throw new TypeError('fingerprint cannot be used with watch mode')
  }

  return {
    enabled: true,
    buildId: options.fingerprint.buildId,
  }
}

function normalizeWatchOptions(
  options: AssetServerOptions['watch'],
): AssetServerWatchOptions | null {
  if (!options) return null
  return options === true ? {} : options
}
