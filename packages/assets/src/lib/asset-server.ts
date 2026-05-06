import * as path from 'node:path'
import * as fs from 'node:fs'
import { createAccessPolicy } from './access.ts'
import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from './compilation-error.ts'
import { createFileCompiler, createResponseForFile } from './files/compiler.ts'
import type { FileCompiler } from './files/compiler.ts'
import { normalizeFilesOptions, serializeAssetTransformInvocations } from './files/config.ts'
import type {
  AssetRequestTransformMap,
  AssetServerFilesOptions,
  AssetTransformInvocation,
  ResolvedAssetServerFilesOptions,
} from './files/config.ts'
import { getFingerprintRequestCacheControl, parseFingerprintSuffix } from './fingerprint.ts'
import { getInjectedPackageRouteConfigs } from './injected-packages.ts'
import { normalizeFilePath, normalizePathname } from './paths.ts'
import { compileRoutes } from './routes.ts'
import type { CompiledRoutes } from './routes.ts'
import { createResponseForScript, createScriptCompiler } from './scripts/compiler.ts'
import { supportedScriptExtensions } from './scripts/resolve.ts'
import { createResponseForStyle, createStyleCompiler, isStyleFilePath } from './styles/compiler.ts'
import { resolveScriptTarget, resolveStyleTarget } from './target.ts'
import type { AssetTarget, ResolvedScriptTarget, ResolvedStyleTarget } from './target.ts'
import { createAssetServerWatcher } from './watch.ts'
import type { AssetServerWatcher, ChokidarWatcher } from './watch.ts'

interface AssetServerWatchOptions {
  /**
   * Ignore matching glob patterns or file paths. Relative values are resolved
   * from `rootDir`.
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
   * Per-build invalidation token that must change whenever fingerprinted asset URLs
   * should be invalidated together.
   */
  buildId: string
}

type AssetSourceMaps = 'inline' | 'external'
type AssetSourceMapSourcePaths = 'url' | 'absolute'

interface AssetServerScriptOptions {
  /**
   * Replace global expressions with constant values during transform, e.g.
   * `{ 'process.env.NODE_ENV': '"production"' }`
   */
  define?: Record<string, string>
  /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
  external?: string[]
}

const scriptExtensionSet = new Set<string>(supportedScriptExtensions)

export interface AssetServerOptions<transforms extends AssetRequestTransformMap = {}> {
  /** Public mount path for this asset server, e.g. `'/assets'`. */
  basePath: string
  /** File patterns keyed by public URL patterns relative to `basePath`. */
  /** File patterns keyed by public URL patterns. */
  fileMap: Readonly<Record<string, string>>
  /**
   * Root directory used to resolve relative file paths. Defaults to `process.cwd()`.
   */
  rootDir?: string
  /**
   * Glob patterns or file paths that are allowed to be served. Relative values are resolved from `rootDir`.
   */
  allow: readonly string[]
  /**
   * Glob patterns or file paths that are denied from being served. Relative values are resolved from `rootDir`.
   */
  deny?: readonly string[]
  /**
   * Controls optional source-based URL fingerprinting for rewritten asset URLs.
   *
   * When omitted, all served assets use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
   * Cannot be used together with active watch mode. Set `watch: false` when fingerprinting.
   */
  fingerprint?: FingerprintOptions
  /**
   * Shared compatibility target for scripts and styles. Browser targets apply to both
   * pipelines, and `es` only affects scripts.
   */
  target?: AssetTarget
  /**
   * Source map mode for scripts and styles.
   * - `'external'`: serve source maps as separate `.map` files
   * - `'inline'`: embed source maps as a base64 data URL in the compiled asset
   */
  sourceMaps?: AssetSourceMaps
  /**
   * Source path strategy for source map `sources`.
   * - `'url'` (default): use the stable server path (e.g. `'/assets/app/entry.ts'`)
   * - `'absolute'`: use the original filesystem path on disk
   */
  sourceMapSourcePaths?: AssetSourceMapSourcePaths
  /**
   * Minification setting for emitted scripts and styles.
   */
  minify?: boolean
  /**
   * Script-only configuration.
   */
  scripts?: AssetServerScriptOptions
  /**
   * Leaf file asset configuration. Files configured here are served directly and can be
   * referenced from CSS `url(...)` rules. Compiled asset extensions like `.css` and script
   * module extensions are not allowed here.
   */
  files?: AssetServerFilesOptions<transforms>
  /**
   * Enable filesystem-backed cache invalidation for long-lived server instances.
   * Enabled by default. Pass `true` to use the default watcher options, an options
   * object to customize watcher behavior, or `false` to disable watching.
   */
  watch?: boolean | AssetServerWatchOptions
  /**
   * Handles unexpected request-time compilation errors. Return a `Response` to override the
   * default `500 Internal Server Error` response, or return nothing to use the default.
   */
  onError?: (error: unknown) => void | Response | Promise<void | Response>
}

type AssetServerCreateOptions<transforms extends AssetRequestTransformMap> = Omit<
  AssetServerOptions<transforms>,
  'files'
> & {
  files?: Omit<AssetServerFilesOptions<transforms>, 'transforms'> & {
    transforms?: transforms
  }
}

export type AssetServerGetHrefOptions<transforms extends AssetRequestTransformMap> =
  | undefined
  | {
      transform: readonly AssetTransformInvocation<transforms>[]
    }

export interface AssetServer<transforms extends AssetRequestTransformMap = {}> {
  /**
   * Serves a script or style request. Returns `Response | null` — null means the request
   * was not handled by this server, letting the router fall through to a 404.
   */
  fetch(request: Request): Promise<Response | null>
  /**
   * Returns the request href for a served asset file.
   */
  getHref(filePath: string, options?: AssetServerGetHrefOptions<transforms>): Promise<string>
  /**
   * Returns preload URLs for one or more served asset files, ordered shallowest-first.
   */
  getPreloads(filePath: string | readonly string[]): Promise<string[]>
  /**
   * Closes any watcher resources owned by this server instance.
   */
  close(): Promise<void>
}

type ResolvedAssetServerOptions<transforms extends AssetRequestTransformMap> = {
  allow: readonly string[]
  basePath: string
  buildId?: string
  define?: Record<string, string>
  deny?: readonly string[]
  external: string[]
  files: ResolvedAssetServerFilesOptions<transforms>
  fingerprintAssets: boolean
  minify: boolean
  onError: NonNullable<AssetServerOptions['onError']>
  rootDir: string
  routes: CompiledRoutes
  sourceMapSourcePaths: 'url' | 'absolute'
  sourceMaps?: 'inline' | 'external'
  scriptsTarget?: ResolvedScriptTarget
  stylesTarget?: ResolvedStyleTarget
  watchOptions: AssetServerWatchOptions | null
}

const chokidarWatcherByAssetServer = new WeakMap<object, ChokidarWatcher>()
const watcherByAssetServer = new WeakMap<object, AssetServerWatcher>()

export function getInternalChokidarWatcher<transforms extends AssetRequestTransformMap>(
  assetServer: AssetServer<transforms>,
): ChokidarWatcher | undefined {
  return chokidarWatcherByAssetServer.get(assetServer)
}

export function getInternalWatchTargets<transforms extends AssetRequestTransformMap>(
  assetServer: AssetServer<transforms>,
): readonly string[] {
  return watcherByAssetServer.get(assetServer)?.getWatchedTargets() ?? []
}

/**
 * Create an asset server instance
 *
 * Compiles TypeScript/JavaScript scripts and CSS styles on demand with optional
 * source-based URL fingerprinting, caching, and configurable file mapping.
 *
 * @param options Server configuration
 * @returns A {@link AssetServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
 *
 * @example
 * ```ts
 * let assetServer = createAssetServer({
 *   basePath: '/assets',
 *   fileMap: {
 *     '/app/*path': 'app/*path',
 *   },
 *   allow: ['app/**'],
 * })
 *
 * route('/assets/*path', ({ request }) => assetServer.fetch(request))
 * ```
 */
export function createAssetServer<const transforms extends AssetRequestTransformMap = {}>(
  options: AssetServerCreateOptions<transforms>,
): AssetServer<transforms> {
  let resolvedOptions = resolveAssetServerOptions(options)
  let accessPolicy = createAccessPolicy({
    allow: resolvedOptions.allow,
    deny: resolvedOptions.deny,
    rootDir: resolvedOptions.rootDir,
  })
  let watcher: AssetServerWatcher | null = null
  let chokidarWatcher: ChokidarWatcher | null = null
  let fileCompiler: FileCompiler | null = null
  let scriptCompiler = createScriptCompiler({
    buildId: resolvedOptions.buildId,
    define: resolvedOptions.define,
    external: resolvedOptions.external,
    fingerprintAssets: resolvedOptions.fingerprintAssets,
    isAllowed: accessPolicy.isAllowed,
    minify: resolvedOptions.minify,
    onWatchDirectoriesChange: (delta) => {
      if (!watcher) return
      watcher.updateWatchedDirectories(delta)
    },
    rootDir: resolvedOptions.rootDir,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps,
    target: resolvedOptions.scriptsTarget,
    watchIgnore: resolvedOptions.watchOptions?.ignore,
    watchMode: resolvedOptions.watchOptions !== null,
  })
  let styleCompiler = createStyleCompiler({
    buildId: resolvedOptions.buildId,
    fingerprintAssets: resolvedOptions.fingerprintAssets,
    getServedFileUrl: (identityPath: string, options: { transform: string | null }) => {
      if (!fileCompiler) {
        throw createAssetServerCompilationError(`File type is not supported: ${identityPath}`, {
          code: 'FILE_NOT_SUPPORTED',
        })
      }

      if (options.transform !== null) {
        fileCompiler.validateTransformQuery(options.transform)
      }

      return fileCompiler.getHref(identityPath, { transform: options.transform })
    },
    isAllowed: accessPolicy.isAllowed,
    isServedFilePath(filePath) {
      return fileCompiler?.isServedFilePath(filePath) ?? false
    },
    minify: resolvedOptions.minify,
    onWatchDirectoriesChange: (delta) => {
      if (!watcher) return
      watcher.updateWatchedDirectories(delta)
    },
    rootDir: resolvedOptions.rootDir,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps,
    targets: resolvedOptions.stylesTarget,
    watchIgnore: resolvedOptions.watchOptions?.ignore,
  })
  if (resolvedOptions.files.extensions.length > 0) {
    fileCompiler = createFileCompiler({
      buildId: resolvedOptions.buildId,
      cache: resolvedOptions.files.cache,
      extensions: resolvedOptions.files.extensions,
      fingerprintAssets: resolvedOptions.fingerprintAssets,
      globalTransforms: resolvedOptions.files.globalTransforms,
      isAllowed: accessPolicy.isAllowed,
      maxRequestTransforms: resolvedOptions.files.maxRequestTransforms,
      onWatchDirectoriesChange: (delta) => {
        if (!watcher) return
        watcher.updateWatchedDirectories(delta)
      },
      transforms: resolvedOptions.files.transforms,
      rootDir: resolvedOptions.rootDir,
      routes: resolvedOptions.routes,
    })
  }
  if (resolvedOptions.watchOptions) {
    watcher = createAssetServerWatcher({
      ...resolvedOptions.watchOptions,
      onChokidarWatcherCreated(createdWatcher) {
        chokidarWatcher = createdWatcher
      },
      onFileEvent: handleWatchEvent,
      rootDir: resolvedOptions.rootDir,
    })
  }

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
      let normalizedFilePath = normalizeFilePath(filePath)
      await scriptCompiler.handleFileEvent(normalizedFilePath, event)
      await styleCompiler.handleFileEvent(normalizedFilePath, event)
      await fileCompiler?.handleFileEvent(normalizedFilePath, event)
    } catch (error) {
      console.error(`There was an error invalidating the asset server cache: ${error}`)
    }
  }

  let assetServer: AssetServer<transforms> = {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let requestUrl = new URL(request.url)
      let requestedTransform = normalizeRequestedTransformQuery(
        requestUrl.searchParams.get('transform'),
      )
      let parsedRequestPathname = parseAssetRequestPathname(requestUrl.pathname, {
        fingerprintAssets: resolvedOptions.fingerprintAssets,
        routes: resolvedOptions.routes,
      })
      if (!parsedRequestPathname) return null

      try {
        let ifNoneMatch = request.headers.get('If-None-Match')

        if (isStyleFilePath(parsedRequestPathname.filePath)) {
          if (requestedTransform !== null) {
            return badRequest(
              'Asset request transforms are only supported for configured file assets',
            )
          }
          let styleResult = await styleCompiler.getStyle(parsedRequestPathname.filePath, {
            ifNoneMatch,
            isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
            requestedFingerprint: parsedRequestPathname.requestedFingerprint,
          })
          if (styleResult.type === 'not-modified') {
            return new Response(null, {
              status: 304,
              headers: { ETag: styleResult.etag },
            })
          }

          let compiledStyle = styleResult.style

          if (parsedRequestPathname.requestedFingerprint !== null) {
            if (compiledStyle.fingerprint !== parsedRequestPathname.requestedFingerprint)
              return null
          }

          return createResponseForStyle(compiledStyle, {
            cacheControl: parsedRequestPathname.cacheControl,
            ifNoneMatch,
            isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
            method: request.method,
          })
        }

        if (!isScriptFilePath(parsedRequestPathname.filePath)) {
          if (!fileCompiler?.isServedFilePath(parsedRequestPathname.filePath)) {
            return null
          }
          if (parsedRequestPathname.isSourceMapRequest) {
            return null
          }

          let fileResult = await fileCompiler.getFile(parsedRequestPathname.filePath, {
            ifNoneMatch,
            requestedFingerprint: parsedRequestPathname.requestedFingerprint,
            transform: requestedTransform,
          })
          if (fileResult.type === 'not-modified') {
            return new Response(null, {
              status: 304,
              headers: { ETag: fileResult.etag },
            })
          }

          if (parsedRequestPathname.requestedFingerprint !== null) {
            if (fileResult.file.fingerprint !== parsedRequestPathname.requestedFingerprint) {
              return null
            }
          }

          return createResponseForFile(fileResult.file, {
            cacheControl: parsedRequestPathname.cacheControl,
            ifNoneMatch,
            method: request.method,
          })
        }

        if (requestedTransform !== null) {
          return badRequest(
            'Asset request transforms are only supported for configured file assets',
          )
        }
        let scriptResult = await scriptCompiler.getScript(parsedRequestPathname.filePath, {
          ifNoneMatch,
          isSourceMapRequest: parsedRequestPathname.isSourceMapRequest,
          requestedFingerprint: parsedRequestPathname.requestedFingerprint,
        })
        if (scriptResult.type === 'not-modified') {
          return new Response(null, {
            status: 304,
            headers: { ETag: scriptResult.etag },
          })
        }

        let compiledScript = scriptResult.script

        if (parsedRequestPathname.requestedFingerprint !== null) {
          if (compiledScript.fingerprint !== parsedRequestPathname.requestedFingerprint) return null
        }

        return createResponseForScript(compiledScript, {
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
          (error.code === 'FILE_NOT_FOUND' || error.code === 'FILE_NOT_ALLOWED')
        ) {
          return null
        }
        if (isAssetServerCompilationError(error) && error.code === 'INVALID_TRANSFORM_QUERY') {
          return new Response(error.message, {
            status: 400,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        }

        return responseForError(error)
      }
    },

    async getHref(filePath, hrefOptions) {
      let transform = getHrefTransform(hrefOptions, resolvedOptions.files)
      let typeCheckFilePath = stripFilePathUrlSuffix(filePath)

      if (isStyleFilePath(typeCheckFilePath)) {
        if (transform !== null) {
          throw new TypeError(
            'assetServer.getHref() only supports transforms for configured file assets',
          )
        }
        return styleCompiler.getHref(filePath)
      }

      if (fileCompiler?.isServedFilePath(typeCheckFilePath)) {
        return fileCompiler.getHref(filePath, {
          transform,
        })
      }

      if (!isScriptFilePath(typeCheckFilePath)) {
        throw createAssetServerCompilationError(`File type is not supported: ${filePath}`, {
          code: 'FILE_NOT_SUPPORTED',
        })
      }

      if (transform !== null) {
        throw new TypeError(
          'assetServer.getHref() only supports transforms for configured file assets',
        )
      }

      return scriptCompiler.getHref(filePath)
    },
    async getPreloads(filePath) {
      let filePaths = Array.isArray(filePath) ? filePath : [filePath]
      let fileAssetFiles: string[] = []
      let styleFiles: string[] = []
      let scriptFiles: string[] = []
      let groupedAssetTypes: ('script' | 'style' | 'file')[] = []

      for (let nextFilePath of filePaths) {
        let typeCheckFilePath = stripFilePathUrlSuffix(nextFilePath)

        if (isStyleFilePath(typeCheckFilePath)) {
          if (!groupedAssetTypes.includes('style')) {
            groupedAssetTypes.push('style')
          }
          styleFiles.push(nextFilePath)
          continue
        }

        if (fileCompiler?.isServedFilePath(typeCheckFilePath)) {
          if (!groupedAssetTypes.includes('file')) {
            groupedAssetTypes.push('file')
          }
          fileAssetFiles.push(nextFilePath)
          continue
        }

        if (!groupedAssetTypes.includes('script')) {
          groupedAssetTypes.push('script')
        }
        scriptFiles.push(nextFilePath)
      }

      if (styleFiles.length === 0 && scriptFiles.length === 0 && fileAssetFiles.length === 0) {
        return []
      }

      if (styleFiles.length === 0 && fileAssetFiles.length === 0) {
        return flattenPreloadLayers(await scriptCompiler.getPreloadLayers(filePath))
      }

      if (scriptFiles.length === 0 && fileAssetFiles.length === 0) {
        return flattenPreloadLayers(await styleCompiler.getPreloadLayers(filePath))
      }

      if (scriptFiles.length === 0 && styleFiles.length === 0) {
        return flattenPreloadLayers(await getFilePreloadLayers(fileCompiler, fileAssetFiles))
      }

      // Mixed asset type preloads need to be merged, so we merge in order of first asset type seen.
      let preloadLayerGroupPromises = groupedAssetTypes.flatMap((assetType) => {
        switch (assetType) {
          case 'script':
            return scriptFiles.length > 0 ? [scriptCompiler.getPreloadLayers(scriptFiles)] : []
          case 'style':
            return styleFiles.length > 0 ? [styleCompiler.getPreloadLayers(styleFiles)] : []
          case 'file':
            return fileAssetFiles.length > 0
              ? [getFilePreloadLayers(fileCompiler, fileAssetFiles)]
              : []
        }
      })

      return mergePreloadLayers(await Promise.all(preloadLayerGroupPromises))
    },
    async close() {
      await watcher?.close()
    },
  }

  if (chokidarWatcher) {
    chokidarWatcherByAssetServer.set(assetServer, chokidarWatcher)
  }
  if (watcher) {
    watcherByAssetServer.set(assetServer, watcher)
  }

  return assetServer
}

function getHrefTransform<transforms extends AssetRequestTransformMap>(
  options: AssetServerGetHrefOptions<transforms> | undefined,
  files: ResolvedAssetServerFilesOptions<transforms>,
): string | null {
  if (!options) return null
  let transform = options.transform
  if (transform.length === 0) {
    return null
  }

  return serializeAssetTransformInvocations(transform, files.transforms, files.maxRequestTransforms)
}

function normalizeRequestedTransformQuery(transformQuery: string | null): string | null {
  if (transformQuery === null) return null

  try {
    let parsed = JSON.parse(transformQuery)
    return Array.isArray(parsed) && parsed.length === 0 ? null : transformQuery
  } catch {
    return transformQuery
  }
}

function internalServerError(): Response {
  return new Response('Internal Server Error', {
    status: 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function mergePreloadLayers(preloadLayersByRoot: readonly (readonly string[][])[]): string[] {
  let urls: string[] = []
  let seen = new Set<string>()
  let maxDepth = Math.max(0, ...preloadLayersByRoot.map((layers) => layers.length))

  for (let depth = 0; depth < maxDepth; depth++) {
    for (let preloadLayers of preloadLayersByRoot) {
      for (let url of preloadLayers[depth] ?? []) {
        if (seen.has(url)) continue
        seen.add(url)
        urls.push(url)
      }
    }
  }

  return urls
}

function flattenPreloadLayers(preloadLayers: readonly (readonly string[])[]): string[] {
  return preloadLayers.flatMap((layer) => layer)
}

async function getFilePreloadLayers<transforms extends AssetRequestTransformMap>(
  fileCompiler: FileCompiler | null,
  filePaths: readonly string[],
): Promise<string[][]> {
  if (filePaths.length === 0) {
    return []
  }

  if (!fileCompiler) {
    throw createAssetServerCompilationError('File type is not supported', {
      code: 'FILE_NOT_SUPPORTED',
    })
  }

  return [
    await Promise.all(
      filePaths.map((filePath) =>
        fileCompiler.getHref(filePath, {
          transform: null,
        }),
      ),
    ),
  ]
}

function defaultErrorHandler(error: unknown): void {
  console.error(error)
}

function resolveAssetServerOptions<transforms extends AssetRequestTransformMap>(
  options: AssetServerCreateOptions<transforms>,
): ResolvedAssetServerOptions<transforms> {
  let rootDir = normalizeFilePath(fs.realpathSync(path.resolve(options.rootDir ?? process.cwd())))
  let basePath = normalizeBasePath(options.basePath)
  let scriptOptions = options.scripts ?? {}
  let fingerprintOptions = normalizeFingerprintOptions({
    fingerprint: options.fingerprint,
    watch: options.watch,
  })

  return {
    allow: options.allow,
    basePath,
    buildId: fingerprintOptions.buildId,
    define: scriptOptions.define,
    deny: options.deny,
    external: scriptOptions.external ?? [],
    files: normalizeFilesOptions(options.files),
    fingerprintAssets: fingerprintOptions.enabled,
    minify: options.minify ?? false,
    onError: options.onError ?? defaultErrorHandler,
    rootDir,
    routes: compileRoutes(basePath, [
      {
        fileMap: options.fileMap,
        rootDir,
      },
      ...getInjectedPackageRouteConfigs(),
    ]),
    sourceMapSourcePaths: options.sourceMapSourcePaths ?? 'url',
    sourceMaps: options.sourceMaps,
    scriptsTarget: resolveScriptTarget(options.target),
    stylesTarget: resolveStyleTarget(options.target),
    watchOptions: normalizeWatchOptions(options.watch),
  }
}

function normalizeBasePath(basePath: string): string {
  if (typeof basePath !== 'string') {
    throw new TypeError('basePath must be a string')
  }

  return normalizePathname(basePath || '/').replace(/\/+$/, '') || '/'
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

  if (options.watch !== false) {
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
  if (options === false) return null
  if (options == null || options === true) return {}
  return options
}

function parseAssetRequestPathname(
  pathname: string,
  options: {
    fingerprintAssets: boolean
    routes: CompiledRoutes
  },
): {
  cacheControl: string
  filePath: string
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
} | null {
  let isSourceMapRequest = pathname.endsWith('.map')
  let pathWithoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname
  let fingerprint = parseFingerprintSuffix(pathWithoutMap)
  let filePath = options.routes.resolveUrlPathname(fingerprint.pathname)
  if (!filePath) return null
  if (options.fingerprintAssets && fingerprint.requestedFingerprint === null) return null

  return {
    cacheControl: getFingerprintRequestCacheControl(fingerprint.requestedFingerprint),
    filePath,
    isSourceMapRequest,
    requestedFingerprint: fingerprint.requestedFingerprint,
  }
}

function isScriptFilePath(filePath: string): boolean {
  return scriptExtensionSet.has(path.extname(filePath).toLowerCase())
}

function stripFilePathUrlSuffix(filePath: string): string {
  if (filePath.startsWith('file://')) {
    return new URL(filePath).pathname
  }

  let queryIndex = filePath.indexOf('?')
  return queryIndex === -1 ? filePath : filePath.slice(0, queryIndex)
}
