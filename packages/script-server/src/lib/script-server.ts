import * as path from 'node:path'
import * as fs from 'node:fs'
import type { FileStorage } from '@remix-run/file-storage'
import { createModuleCompiler, createResponseForModule } from './modules.ts'
import { compileRoutes, normalizeFilePath } from './routes.ts'
import type { ScriptRouteDefinition } from './routes.ts'

let fingerprintedCacheControl = 'public, max-age=31536000, immutable'

export type CacheStrategyOptions =
  | ({
      /**
       * Serve all modules at stable non-fingerprinted URLs with `Cache-Control: no-cache`.
       */
      fingerprint?: false
      entryPoints?: never
    } & (
      | {
          buildId?: never
          fileStorage?: never
        }
      | {
          /**
           * Per-build cache namespace used for shared transform artifacts.
           *
           * When present, cached modules are treated as immutable for that build.
           */
          buildId: string
          /**
           * Optional shared storage backend for compiled artifact persistence.
           *
           * Requires `buildId` so stored artifacts are isolated per build.
           */
          fileStorage: FileStorage
        }
    ))
  | {
      /**
       * Rewrite non-entry modules to `.@fingerprint` URLs based on source text and `buildId`.
       * Modules matching `entryPoints` keep their stable non-fingerprinted URLs.
       */
      fingerprint: 'source'
      /**
       * File-space paths or glob patterns for modules that should keep stable non-fingerprinted URLs.
       * Relative values are resolved from `root`.
       */
      entryPoints: readonly string[]
      /**
       * Per-build invalidation token that must change whenever fingerprinted module URLs
       * and cached transform artifacts should be invalidated together.
       */
      buildId: string
      /**
       * Optional shared storage backend for compiled artifact persistence.
       *
       * When provided, cached modules are treated as immutable for this build.
       */
      fileStorage?: FileStorage
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
   * Controls how served modules are cached and whether compiled artifacts are reused across
   * server restarts for a specific build.
   *
   * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
   */
  cacheStrategy?: CacheStrategyOptions
  /**
   * Minify emitted modules.
   */
  minify?: boolean
  /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
  external?: string | string[]
  /**
   * Handles unexpected compilation errors. Return a `Response` to override the default
   * `500 Internal Server Error` response, or return nothing to use the default.
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
   * Returns preload URLs for the given module request path, ordered shallowest-first.
   */
  preloads(moduleUrl: string): Promise<string[]>
}

/**
 * Create the server-side scripts server.
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, ETag revalidation, and configurable route/file-space mapping.
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
  let root = fs.realpathSync(path.resolve(options.root ?? process.cwd()))
  let sourceMaps = options.sourceMaps
  let sourceMapSourcePaths = options.sourceMapSourcePaths ?? 'url'
  let externalRaw = options.external
  let cacheStrategy = normalizeCacheStrategyOptions(options.cacheStrategy)
  let external: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []
  let fingerprintInternalModules = cacheStrategy.fingerprint === 'source'
  let buildId = cacheStrategy.buildId
  let internalModuleCacheControl = fingerprintInternalModules
    ? fingerprintedCacheControl
    : 'no-cache'
  let minify = options.minify ?? false
  let onError = options.onError ?? defaultErrorHandler
  let routes = compileRoutes({
    root,
    routes: options.routes,
  })
  let entryPointMatchers = createEntryPointMatchers(
    cacheStrategy.fingerprint === 'source' ? cacheStrategy.entryPoints : [],
    root,
  )
  let allowMatchers = createFileMatchers(options.allow, root)
  let denyMatchers = createFileMatchers(options.deny ?? [], root)
  let moduleCompiler = createModuleCompiler({
    buildId,
    external,
    fileStorage: cacheStrategy.fileStorage,
    fingerprintInternalModules,
    isAllowed,
    isEntryPoint,
    minify,
    routes,
    sourceMapSourcePaths,
    sourceMaps,
  })

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

  function isNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
  }

  function isEntryPoint(filePath: string): boolean {
    let normalized = normalizeFilePath(filePath)
    return entryPointMatchers.some((matcher) => matcher(normalized))
  }

  function isAllowed(filePath: string): boolean {
    let normalized = normalizeFilePath(filePath)
    if (!allowMatchers.some((matcher) => matcher(normalized))) return false
    if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(normalized))) return false
    return true
  }

  return {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let pathname = new URL(request.url).pathname
      let isSourceMapRequest = pathname.endsWith('.map')
      let withoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname
      let tokenMatch = withoutMap.match(/\.@([a-z0-9]+)$/)
      let requestedToken = tokenMatch ? tokenMatch[1] : null
      let normalizedPath = tokenMatch ? withoutMap.slice(0, -tokenMatch[0].length) : withoutMap
      let resolvedPath = routes.resolveUrlPathname(normalizedPath)
      if (!resolvedPath) return null

      let resolved = moduleCompiler.resolveRequestPath(resolvedPath)
      if (!resolved || !isAllowed(resolved.identityPath)) return null
      let ifNoneMatch = request.headers.get('If-None-Match')
      let isEntry = isEntryPoint(resolved.identityPath)

      if (!requestedToken && !isEntry && fingerprintInternalModules) {
        return null
      }

      try {
        let result = await moduleCompiler.compileModule(resolved.resolvedPath)

        if (requestedToken !== null) {
          if (isEntry) {
            return new Response('Not found', { status: 404 })
          }
          if (result.fingerprint !== requestedToken) {
            return new Response('Not found', { status: 404 })
          }
        }

        return createResponseForModule(result, {
          cacheControl: isEntry ? 'no-cache' : internalModuleCacheControl,
          ifNoneMatch,
          isSourceMapRequest,
          method: request.method,
        })
      } catch (error) {
        if (isNotFoundError(error)) return null
        return responseForError(error)
      }
    },

    async preloads(moduleUrl) {
      if (/\.@[a-z0-9]+(?:\.map)?$/.test(moduleUrl)) {
        throw new Error(
          `Preload URLs must use stable non-fingerprinted module paths, received "${moduleUrl}"`,
        )
      }

      return moduleCompiler.getPreloadUrls(moduleUrl)
    },
  }
}

type FileMatcher = (filePath: string) => boolean

function createEntryPointMatchers(entryPoints: readonly string[], root: string) {
  return entryPoints.map((entryPoint) =>
    createFileMatcher(entryPoint, root, { allowDirectories: false }),
  )
}

function createFileMatchers(patterns: readonly string[], root: string): FileMatcher[] {
  return patterns.map((pattern) => createFileMatcher(pattern, root))
}

function createFileMatcher(
  pattern: string,
  root: string,
  options: { allowDirectories?: boolean } = {},
): FileMatcher {
  let resolved = path.isAbsolute(pattern) ? pattern : path.join(root, pattern)
  let allowDirectories = options.allowDirectories ?? true

  if (!containsGlobSyntax(pattern)) {
    try {
      resolved = fs.realpathSync(resolved)
    } catch {
      // Keep unresolved exact paths so matcher behavior stays deterministic.
    }

    let normalized = normalizeFilePath(resolved)
    if (allowDirectories && isDirectoryPattern(pattern, root)) {
      return (filePath) => isSameOrDescendantPath(filePath, normalized)
    }

    return (filePath) => normalizeFilePath(filePath) === normalized
  }

  let normalizedPattern = normalizeFilePath(resolved)
  return (filePath) => path.posix.matchesGlob(normalizeFilePath(filePath), normalizedPattern)
}

function isDirectoryPattern(pattern: string, root: string): boolean {
  let resolved = path.isAbsolute(pattern) ? pattern : path.join(root, pattern)
  try {
    return fs.statSync(resolved).isDirectory()
  } catch {
    return false
  }
}

function isSameOrDescendantPath(filePath: string, directoryPath: string): boolean {
  let normalizedFilePath = normalizeFilePath(filePath)
  let normalizedDirectoryPath = directoryPath.replace(/\/+$/, '')

  return (
    normalizedFilePath === normalizedDirectoryPath ||
    normalizedFilePath.startsWith(`${normalizedDirectoryPath}/`)
  )
}

function containsGlobSyntax(pattern: string): boolean {
  return /[*?[\]{}()!+@]/.test(pattern)
}

function normalizeCacheStrategyOptions(options: CacheStrategyOptions | undefined):
  | { fingerprint: false; buildId?: undefined; fileStorage?: undefined }
  | { fingerprint: false; buildId: string; fileStorage: FileStorage }
  | {
      buildId: string
      entryPoints: readonly string[]
      fileStorage?: FileStorage
      fingerprint: 'source'
    } {
  if (!options) {
    return { fingerprint: false }
  }

  if (
    options.fingerprint !== undefined &&
    options.fingerprint !== false &&
    options.fingerprint !== 'source'
  ) {
    throw new TypeError(
      `Invalid cacheStrategy.fingerprint "${String(options.fingerprint)}". Expected false or "source".`,
    )
  }

  if (options.fingerprint === 'source') {
    if (typeof options.buildId !== 'string' || options.buildId.length === 0) {
      throw new TypeError('cacheStrategy.buildId must be a non-empty string')
    }

    if (!Array.isArray(options.entryPoints) || options.entryPoints.length === 0) {
      throw new TypeError('cacheStrategy.entryPoints must be a non-empty array')
    }

    return {
      buildId: options.buildId,
      entryPoints: options.entryPoints,
      fileStorage: options.fileStorage,
      fingerprint: 'source',
    }
  }

  if (options.entryPoints !== undefined) {
    throw new TypeError(
      'cacheStrategy.entryPoints is only supported when cacheStrategy.fingerprint is "source"',
    )
  }

  if (options.fileStorage === undefined && options.buildId === undefined) {
    return { fingerprint: false }
  }

  if (options.fileStorage === undefined) {
    throw new TypeError('cacheStrategy.fileStorage is required when cacheStrategy.buildId is set')
  }

  if (options.buildId === undefined) {
    throw new TypeError('cacheStrategy.buildId is required when cacheStrategy.fileStorage is set')
  }

  if (typeof options.buildId !== 'string' || options.buildId.length === 0) {
    throw new TypeError('cacheStrategy.buildId must be a non-empty string')
  }

  return {
    buildId: options.buildId,
    fileStorage: options.fileStorage,
    fingerprint: false,
  }
}
