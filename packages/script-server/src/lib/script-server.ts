import * as path from 'node:path'
import * as fs from 'node:fs'
import chokidar from 'chokidar'
import {
  createScriptServerCompilationError,
  isScriptServerCompilationError,
} from './compilation-error.ts'
import { createModuleCompiler, createResponseForModule } from './modules.ts'
import { normalizeFilePath, resolveFilePath } from './paths.ts'
import { compileRoutes } from './routes.ts'
import type { ScriptRouteDefinition } from './routes.ts'

let fingerprintedCacheControl = 'public, max-age=31536000, immutable'
let defaultWatchPoll = false
let defaultWatchPollInterval = 100

export interface ScriptServerWatchOptions {
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

export interface ScriptServerFingerprintInternalModulesOptions {
  /**
   * Per-build invalidation token that must change whenever fingerprinted module URLs
   * should be invalidated together.
   */
  buildId: string
  /**
   * Cache-Control header used for fingerprinted internal modules.
   * Defaults to `public, max-age=31536000, immutable`.
   */
  cacheControl?: string
}

export interface ScriptServerOptions {
  /** Routes that map public URL patterns to file-space patterns. */
  routes: ReadonlyArray<ScriptRouteDefinition>
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
   * Source map mode (disabled when omitted).
   * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
   * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
   */
  sourceMaps?: 'inline' | 'external'
  /**
   * Controls the source paths written into sourcemap `sources`.
   * - `'url'` (default): use the stable server path (e.g. `'/scripts/app/entry.ts'`)
   * - `'absolute'`: use the original filesystem path on disk
   */
  sourceMapSourcePaths?: 'url' | 'absolute'
  /**
   * File-space paths or glob patterns for modules that should keep stable non-fingerprinted URLs
   * when internal module fingerprinting is enabled. Relative values are resolved from `root`.
   */
  entryPoints?: readonly string[]
  /**
   * Controls optional source-based URL fingerprinting for non-entry modules.
   *
   * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
   * Requires at least one `entryPoints` pattern and cannot be used together with `watch`.
   */
  fingerprintInternalModules?: ScriptServerFingerprintInternalModulesOptions
  /**
   * Minify emitted modules.
   */
  minify?: boolean
  /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
  external?: string[]
  /**
   * Enable filesystem-backed cache invalidation for long-lived server instances.
   * Pass `true` to use the default watcher options, or an options object to
   * customize the watcher behavior.
   */
  watch?: boolean | ScriptServerWatchOptions
  /**
   * Handles unexpected request-time compilation errors. Return a `Response` to override the
   * default `500 Internal Server Error` response, or return nothing to use the default.
   */
  onError?: (error: unknown) => void | Response | Promise<void | Response>
}

export interface ScriptServer {
  /**
   * Serves a script request. Returns `Response | null` — null means the request was not
   * handled by this server, letting the router fall through to a 404.
   */
  fetch(request: Request): Promise<Response | null>
  /**
   * Returns preload URLs for one or more module request paths, ordered shallowest-first.
   */
  preloads(modulePathname: string | readonly string[]): Promise<string[]>
  /**
   * Closes any watcher resources owned by this server instance.
   */
  close(): Promise<void>
}

/**
 * Create the server-side scripts server.
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, caching, and configurable route mapping.
 *
 * @param options Server configuration
 * @returns A {@link ScriptServer} with `fetch()` and `preloads()` methods
 *
 * @example
 * ```ts
 * let scriptServer = createScriptServer({
 *   routes: [{ urlPattern: '/scripts/app/*path', filePattern: 'app/*path' }],
 *   allow: ['app/**'],
 * })
 *
 * route('/scripts/*path', ({ request }) => scriptServer.fetch(request))
 * ```
 */
export function createScriptServer(options: ScriptServerOptions): ScriptServer {
  let root = normalizeFilePath(fs.realpathSync(path.resolve(options.root ?? process.cwd())))
  let sourceMaps = options.sourceMaps
  let sourceMapSourcePaths = options.sourceMapSourcePaths ?? 'url'
  let watchOptions = normalizeWatchOptions(options.watch)
  let fingerprintOptions = normalizeFingerprintInternalModulesOptions({
    entryPoints: options.entryPoints,
    fingerprintInternalModules: options.fingerprintInternalModules,
    watch: options.watch,
  })
  let external = options.external ?? []
  let fingerprintInternalModules = fingerprintOptions.enabled
  let buildId = fingerprintOptions.buildId
  let internalModuleCacheControl = fingerprintInternalModules
    ? fingerprintOptions.cacheControl
    : 'no-cache'
  let minify = options.minify ?? false
  let onError = options.onError ?? defaultErrorHandler
  let routes = compileRoutes({
    root,
    routes: options.routes,
  })
  let entryPointMatchers = fingerprintOptions.entryPoints.map((entryPoint) =>
    createFileMatcher(entryPoint, root, { allowDirectories: false, allowMissing: false }),
  )
  let allowMatchers = options.allow.map((pattern) => createFileMatcher(pattern, root))
  let denyMatchers = (options.deny ?? []).map((pattern) => createFileMatcher(pattern, root))
  let moduleCompiler = createModuleCompiler({
    buildId,
    external,
    fingerprintInternalModules,
    isAllowed,
    isEntryPoint,
    minify,
    routes,
    sourceMapSourcePaths,
    sourceMaps,
  })
  let watchTargets = watchOptions ? getWatchTargets(root, options.routes) : []
  let watcher =
    watchOptions !== null
      ? chokidar.watch(watchTargets, {
          ignoreInitial: true,
          ignorePermissionErrors: true,
          ...watchOptions,
        })
      : null

  if (watcher) {
    watcher.on('add', (filePath) => {
      void handleWatchEvent(filePath, 'add')
    })
    watcher.on('change', (filePath) => {
      void handleWatchEvent(filePath, 'change')
    })
    watcher.on('unlink', (filePath) => {
      void handleWatchEvent(filePath, 'unlink')
    })
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

  async function responseForError(error: unknown): Promise<Response> {
    try {
      return (await onError(error)) ?? internalServerError()
    } catch (error) {
      console.error(`There was an error in the script server error handler: ${error}`)
      return internalServerError()
    }
  }

  async function handleWatchEvent(filePath: string, event: 'add' | 'change' | 'unlink') {
    try {
      await moduleCompiler.handleFileEvent(filePath, event)
    } catch (error) {
      console.error(`There was an error invalidating the script server cache: ${error}`)
    }
  }

  function isEntryPoint(filePath: string): boolean {
    return entryPointMatchers.some((matcher) => matcher(filePath))
  }

  function isAllowed(filePath: string): boolean {
    if (!allowMatchers.some((matcher) => matcher(filePath))) return false
    if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath))) return false
    return true
  }

  function createOutsideRoutesError(modulePathname: string) {
    return createScriptServerCompilationError(
      `Module "${modulePathname}" is outside all configured routes.`,
      {
        code: 'MODULE_OUTSIDE_ROUTES',
      },
    )
  }

  return {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let pathname = new URL(request.url).pathname
      let isSourceMapRequest = pathname.endsWith('.map')
      let withoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname
      let tokenMatch = withoutMap.match(/\.@([A-Za-z0-9_-]+)$/)
      let requestedToken = tokenMatch ? tokenMatch[1] : null
      let normalizedPath = tokenMatch ? withoutMap.slice(0, -tokenMatch[0].length) : withoutMap
      let resolvedPath = routes.resolveUrlPathname(normalizedPath)
      if (!resolvedPath) return null

      try {
        let resolvedModule = moduleCompiler.resolveServedPath(resolvedPath)
        let ifNoneMatch = request.headers.get('If-None-Match')
        let isEntry = isEntryPoint(resolvedModule.identityPath)

        if (!requestedToken && !isEntry && fingerprintInternalModules) {
          return null
        }

        let compiledModule = await moduleCompiler.compileModule(resolvedModule.resolvedPath)

        if (requestedToken !== null) {
          if (isEntry) return null
          if (compiledModule.fingerprint !== requestedToken) return null
        }

        return createResponseForModule(compiledModule, {
          cacheControl: isEntry ? 'no-cache' : internalModuleCacheControl,
          ifNoneMatch,
          isSourceMapRequest,
          method: request.method,
        })
      } catch (error) {
        // A direct request can race with the filesystem or fail a deeper allow check while
        // compiling imports. In this fetch context, both cases should fall through as "not
        // handled here" so the outer router can continue to its own 404 behavior.
        if (
          isScriptServerCompilationError(error) &&
          (error.code === 'MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_ALLOWED')
        ) {
          return null
        }

        return responseForError(error)
      }
    },

    async preloads(modulePathname) {
      let modulePathnames = Array.isArray(modulePathname) ? modulePathname : [modulePathname]
      if (modulePathnames.length === 0) return []

      let resolvedPaths = modulePathnames.map((pathname) => {
        if (/\.@[A-Za-z0-9_-]+(?:\.map)?$/.test(pathname)) {
          throw new Error(
            `Preload URLs must use stable non-fingerprinted module paths, received "${pathname}"`,
          )
        }

        let resolvedPath = routes.resolveUrlPathname(pathname)
        if (!resolvedPath) throw createOutsideRoutesError(pathname)
        return resolvedPath
      })

      return moduleCompiler.getPreloadUrls(resolvedPaths)
    },
    async close() {
      await watcher?.close()
    },
  }
}

type FileMatcher = (filePath: string) => boolean

function createFileMatcher(
  pattern: string,
  root: string,
  options: {
    allowDirectories?: boolean
    allowMissing?: boolean
  } = {},
): FileMatcher {
  let resolvedPatternPath = resolveFilePath(root, pattern)
  let allowDirectories = options.allowDirectories ?? true
  let allowMissing = options.allowMissing ?? true

  if (!containsGlobSyntax(pattern)) {
    try {
      resolvedPatternPath = normalizeFilePath(fs.realpathSync(resolvedPatternPath))
    } catch (error) {
      if (!allowMissing || !isPathNotFoundError(error)) throw error
      // Keep unresolved exact paths when the target is not on disk yet.
    }

    if (allowDirectories) {
      try {
        if (fs.statSync(resolveFilePath(root, pattern)).isDirectory()) {
          return (filePath) => isSameOrDescendantPath(filePath, resolvedPatternPath)
        }
      } catch {
        // Missing exact paths fall back to exact-file matching until they exist on disk.
      }
    }

    return (filePath) => filePath === resolvedPatternPath
  }

  return (filePath) => path.posix.matchesGlob(filePath, resolvedPatternPath)
}

function isSameOrDescendantPath(filePath: string, directoryPath: string): boolean {
  let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '')

  return filePath === normalizedDirectoryPath || filePath.startsWith(`${normalizedDirectoryPath}/`)
}

function containsGlobSyntax(pattern: string): boolean {
  return /[*?[\]{}()!+@]/.test(pattern)
}

function isPathNotFoundError(
  error: unknown,
): error is NodeJS.ErrnoException & { code: 'ENOENT' | 'ENOTDIR' } {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  )
}

function normalizeFingerprintInternalModulesOptions(options: {
  entryPoints: ScriptServerOptions['entryPoints']
  fingerprintInternalModules: ScriptServerOptions['fingerprintInternalModules']
  watch: ScriptServerOptions['watch']
}):
  | {
      enabled: false
      buildId?: string
      cacheControl: string
      entryPoints: readonly string[]
    }
  | {
      enabled: true
      buildId: string
      cacheControl: string
      entryPoints: readonly string[]
    } {
  if (!options.fingerprintInternalModules) {
    return {
      enabled: false,
      cacheControl: 'no-cache',
      entryPoints: [],
    }
  }

  if (typeof options.fingerprintInternalModules.buildId !== 'string') {
    throw new TypeError('fingerprintInternalModules.buildId must be a string')
  }

  if (options.fingerprintInternalModules.buildId.length === 0) {
    throw new TypeError('fingerprintInternalModules.buildId must be a non-empty string')
  }

  if (!Array.isArray(options.entryPoints) || options.entryPoints.length === 0) {
    throw new TypeError(
      'entryPoints must be a non-empty array when fingerprintInternalModules is enabled',
    )
  }

  if (options.watch) {
    throw new TypeError('fingerprintInternalModules cannot be used with watch mode')
  }

  return {
    enabled: true,
    buildId: options.fingerprintInternalModules.buildId,
    cacheControl: options.fingerprintInternalModules.cacheControl ?? fingerprintedCacheControl,
    entryPoints: options.entryPoints,
  }
}

function normalizeWatchOptions(
  options: boolean | ScriptServerWatchOptions | undefined,
): Exclude<Parameters<typeof chokidar.watch>[1], undefined> | null {
  if (!options) return null
  if (options === true) return {}
  return {
    ignored: options.ignore ? [...options.ignore] : undefined,
    interval: options.pollInterval ?? defaultWatchPollInterval,
    usePolling: options.poll ?? defaultWatchPoll,
  }
}

function getWatchTargets(root: string, routes: readonly ScriptRouteDefinition[]): string[] {
  let targets = new Set<string>()
  let configRoots = new Set<string>()

  for (let route of routes) {
    let resolvedPatternPath = resolveFilePath(root, route.filePattern)
    let watchTarget = containsGlobSyntax(route.filePattern)
      ? getGlobParentPath(resolvedPatternPath)
      : resolvedPatternPath
    targets.add(watchTarget)

    let configRoot = getWatchConfigRoot(watchTarget)
    if (configRoot) {
      configRoots.add(configRoot)
    }
  }

  for (let configRoot of configRoots) {
    for (let ancestor of getAncestorPaths(configRoot, root)) {
      for (let configPath of getExistingConfigFileTargets(ancestor)) {
        targets.add(configPath)
      }
    }
  }

  return [...targets]
}

function getAncestorPaths(directoryPath: string, root: string): string[] {
  let ancestors: string[] = []
  let currentDirectory = directoryPath

  while (isSameOrDescendantPath(currentDirectory, root)) {
    ancestors.push(currentDirectory)
    if (currentDirectory === root) break
    let parentDirectory = path.posix.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) break
    currentDirectory = parentDirectory
  }

  return ancestors
}

function getGlobParentPath(pattern: string): string {
  let firstGlobIndex = pattern.search(/[*?[\]{}()!+@]/)
  if (firstGlobIndex === -1) return pattern

  let prefix = pattern.slice(0, firstGlobIndex)
  return prefix.replace(/\/+$/, '') || '/'
}

function getWatchConfigRoot(filePath: string): string | null {
  try {
    if (fs.statSync(filePath).isDirectory()) {
      return filePath
    }
  } catch {
    // Missing exact paths fall back to parent directory watch roots.
  }

  return path.posix.dirname(filePath)
}

function getExistingConfigFileTargets(directoryPath: string): string[] {
  let targets: string[] = []

  try {
    let entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    for (let entry of entries) {
      if (!entry.isFile()) continue
      if (entry.name === 'package.json' || /^tsconfig(?:\..+)?\.json$/.test(entry.name)) {
        targets.push(`${directoryPath}/${entry.name}`)
      }
    }
  } catch {
    // Ignore missing or unreadable directories when building watch targets.
  }

  return targets
}
