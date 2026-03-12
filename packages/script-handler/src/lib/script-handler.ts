import * as path from 'node:path'
import * as fs from 'node:fs'
import picomatch from 'picomatch'
import {
  normalizeRootPrefix,
  resolveAbsolutePathFromResolvedRoots,
  resolvePublicPathFromResolvedRoots,
} from './path-utils.ts'
import {
  buildGraph,
  collectTransitiveDeps,
  createModuleGraphStore,
  CjsModuleError,
  isCompiledGraphFresh,
} from './module-graph.ts'
import type { ResolvedScriptRoot } from './path-utils.ts'
import type { ModuleCompileResult, ModuleGraphStore } from './module-graph.ts'
import { generateETag, matchesETag } from './etag.ts'

export interface ScriptHandlerRoot {
  /** Public URL prefix under `base` (e.g. `'packages'`) */
  prefix?: string
  /** Filesystem directory for this served tree */
  directory: string
  /** Declared entry point paths or glob patterns relative to this directory */
  entryPoints?: readonly string[]
}

export interface ScriptHandlerOptions {
  /** Configured source roots that may be served by this handler */
  roots: readonly ScriptHandlerRoot[]
  /**
   * URL base path where the handler is mounted (e.g. `'/scripts'`).
   * All rewritten import URLs in compiled modules will be relative to this base.
   */
  base: string
  /**
   * Source map mode (disabled when omitted).
   * - `'external'`: serve source maps as separate `.map` files; adds `//# sourceMappingURL=` comment
   * - `'inline'`: embed source maps as a base64 data URL directly in the JS; no separate `.map` file
   */
  sourceMaps?: 'inline' | 'external'
  /**
   * Controls the source paths written into sourcemap `sources`.
   * - `'virtual'` (default): use the stable handler path (e.g. `'/scripts/app/entry.ts'`)
   * - `'absolute'`: use the original filesystem path on disk
   */
  sourceMapSourcePaths?: 'virtual' | 'absolute'
  /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
  external?: string | string[]
}

export interface ScriptHandler {
  /**
   * Handles a request for a script module path. Returns `Response | null` — null means
   * the request was not handled by this handler, letting the router fall through to a 404.
   */
  handle(request: Request, path: string): Promise<Response | null>
  /**
   * Returns preload URLs for all transitive deps of the given entry point, ordered
   * shallowest-first. Pass either the public entry-point path relative to `base` or an
   * absolute file path for a configured entry point. Call this when rendering HTML to
   * populate `<link rel="modulepreload">`.
   *
   * Blocks until the module graph is fully built. Not calling `preloads()` is valid —
   * modules are compiled on-demand as the browser requests them.
   */
  preloads(entryPoint: string): Promise<string[]>
}

interface PreloadCacheEntry {
  compiledHash: string
  promise: Promise<string[]>
}

interface NormalizedScriptRoot extends ResolvedScriptRoot {
  entryPoints: readonly string[]
  entryPointMatchers: Array<ReturnType<typeof picomatch>>
}

/**
 * Create the server-side scripts handler.
 *
 * Compiles TypeScript/JavaScript modules on demand with content-addressed URLs:
 * - Internal modules served at `.@hash` URLs with `Cache-Control: immutable`
 * - Entry points served with `Cache-Control: no-cache` + ETags
 * - Circular dependencies handled via Tarjan's SCC algorithm — modules in a cycle
 *   share a deterministic hash derived from their combined sources and external deps
 * - CommonJS detection with clear error messages
 * - GET and HEAD support
 *
 * @param options Handler configuration
 * @returns A {@link ScriptHandler} with `handle()` and `preloads()` methods
 *
 * @example
 * ```ts
 * let scripts = createScriptHandler({
 *   base: '/scripts',
 *   roots: [{ directory: import.meta.dirname, entryPoints: ['app/entry.tsx'] }],
 * })
 *
 * route('/scripts/*path', ({ request, params }) => scripts.handle(request, params.path))
 * ```
 */
export function createScriptHandler(options: ScriptHandlerOptions): ScriptHandler {
  function realpathOrFallback(p: string): string {
    try {
      return fs.realpathSync(p)
    } catch {
      return p
    }
  }

  function normalizeBase(base: string): string {
    let normalized = `/${base}`.replace(/^\/+/, '/').replace(/\/+$/, '')
    return normalized || '/'
  }

  function toAbsolutePath(directory: string, relativePath: string): string {
    return relativePath === '' ? directory : path.join(directory, ...relativePath.split('/'))
  }

  function normalizeRoots(configuredRoots: readonly ScriptHandlerRoot[]): NormalizedScriptRoot[] {
    if (configuredRoots.length === 0) {
      throw new Error('createScriptHandler() requires at least one configured root.')
    }

    let seenPrefixes = new Set<string>()
    let fallbackRoots = 0

    return configuredRoots.map((configuredRoot) => {
      let prefix = normalizeRootPrefix(configuredRoot.prefix)
      if (prefix == null) {
        fallbackRoots++
        if (fallbackRoots > 1) {
          throw new Error('Only one configured root may omit prefix.')
        }
      } else if (seenPrefixes.has(prefix)) {
        throw new Error(`Duplicate configured root prefix "${prefix}".`)
      } else {
        seenPrefixes.add(prefix)
      }

      let directory = realpathOrFallback(path.resolve(process.cwd(), configuredRoot.directory))
      let entryPoints = configuredRoot.entryPoints ?? []

      return {
        prefix,
        directory,
        entryPoints,
        entryPointMatchers: entryPoints.map((entryPoint) => picomatch(entryPoint, { dot: true })),
      }
    })
  }

  let roots = normalizeRoots(options.roots)
  let sourceMaps = options.sourceMaps
  let sourceMapSourcePaths = options.sourceMapSourcePaths ?? 'virtual'
  let externalRaw = options.external
  let external: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []
  let base = normalizeBase(options.base)

  let store: ModuleGraphStore = createModuleGraphStore()
  let graphBuilds = new Map<string, Promise<ModuleCompileResult>>()
  let preloadCache = new Map<string, PreloadCacheEntry>()
  let publicPathCache = new Map<string, string | null>()

  function isEntryPointInRoot(resolvedRoot: NormalizedScriptRoot, relativePath: string): boolean {
    return resolvedRoot.entryPointMatchers.some((matcher) => matcher(relativePath))
  }

  function resolveAbsolutePath(absolutePath: string) {
    return resolveAbsolutePathFromResolvedRoots(absolutePath, roots)
  }

  function resolvePublicPath(modulePath: string) {
    return resolvePublicPathFromResolvedRoots(modulePath, roots)
  }

  function isEntryPointAbsolute(absolutePath: string): boolean {
    let resolved = resolveAbsolutePath(absolutePath)
    if (!resolved) return false
    return isEntryPointInRoot(resolved.resolvedRoot, resolved.relativePath)
  }

  function toModuleUrl(relativePath: string): string {
    return base === '/' ? `/${relativePath}` : `${base}/${relativePath}`
  }

  function createModuleGraphOptions() {
    return {
      base,
      roots,
      external,
      sourceMaps,
      sourceMapSourcePaths,
      isEntryPoint: isEntryPointAbsolute,
    }
  }

  function getPublicPath(absolutePath: string) {
    if (publicPathCache.has(absolutePath)) {
      return publicPathCache.get(absolutePath) ?? null
    }

    let publicPath = resolveAbsolutePath(absolutePath)?.publicPath ?? null
    publicPathCache.set(absolutePath, publicPath)
    return publicPath
  }

  function getPreloadUrls(absolutePath: string): string[] {
    let allDeps = collectTransitiveDeps(absolutePath, store)
    let urls: string[] = []

    for (let [depPath, depResult] of allDeps) {
      let publicPath = getPublicPath(depPath)
      if (!publicPath) {
        throw new Error(`Compiled module ${depPath} is outside all configured roots.`)
      }

      let url = isEntryPointAbsolute(depPath)
        ? toModuleUrl(publicPath)
        : toModuleUrl(`${publicPath}.@${depResult.compiledHash}`)

      urls.push(url)
    }

    return urls
  }

  function resolvePreloadEntryPoint(entryPoint: string): {
    absolutePath: string
    resolvedRoot: NormalizedScriptRoot
    relativePath: string
  } {
    let resolved = path.isAbsolute(entryPoint)
      ? resolveAbsolutePath(realpathOrFallback(entryPoint))
      : resolvePublicPath(entryPoint)

    if (!resolved) {
      throw new Error(`Entry point "${entryPoint}" is outside all configured roots.`)
    }

    if (!isEntryPointInRoot(resolved.resolvedRoot, resolved.relativePath)) {
      throw new Error(`Entry point "${entryPoint}" does not match any configured entry points.`)
    }

    return {
      absolutePath: toAbsolutePath(resolved.resolvedRoot.directory, resolved.relativePath),
      resolvedRoot: resolved.resolvedRoot,
      relativePath: resolved.relativePath,
    }
  }

  async function buildGraphCached(absolutePath: string): Promise<ModuleCompileResult> {
    let existing = graphBuilds.get(absolutePath)
    if (existing) return existing
    let promise = buildGraph(absolutePath, store, createModuleGraphOptions())
    graphBuilds.set(absolutePath, promise)
    try {
      return await promise
    } finally {
      graphBuilds.delete(absolutePath)
    }
  }

  function serveModule(
    result: ModuleCompileResult,
    opts: {
      isSourceMapRequest: boolean
      method: string
      ifNoneMatch: string | null
      immutable: boolean
    },
  ): Response {
    let etag = generateETag(result.compiledHash)

    if (opts.isSourceMapRequest) {
      if (sourceMaps !== 'external' || !result.sourcemap) {
        return new Response('Not found', { status: 404 })
      }
      if (matchesETag(opts.ifNoneMatch, etag)) {
        return new Response(null, { status: 304, headers: { ETag: etag } })
      }
      let body = opts.method === 'HEAD' ? null : result.sourcemap
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': opts.immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
          ...(opts.immutable ? {} : { ETag: etag }),
        },
      })
    }

    if (matchesETag(opts.ifNoneMatch, etag)) {
      return new Response(null, { status: 304, headers: { ETag: etag } })
    }

    let body = opts.method === 'HEAD' ? null : result.compiledCode
    return new Response(body, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': opts.immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...(opts.immutable ? {} : { ETag: etag }),
      },
    })
  }

  function responseForCompileError(error: unknown): Response {
    if (error instanceof CjsModuleError) {
      return new Response(error.message, {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    let message = error instanceof Error ? error.message : String(error)
    return new Response(`Compilation error: ${message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  function isNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
  }

  async function handleInternalModuleRequest(
    absolutePath: string,
    requestedToken: string,
    isSourceMapRequest: boolean,
    method: string,
  ): Promise<Response | null> {
    try {
      let cached = store.get(absolutePath)
      if (cached && (await isCompiledGraphFresh(absolutePath, store))) {
        if (cached.compiledHash !== requestedToken) return null

        return serveModule(cached, {
          isSourceMapRequest,
          method,
          ifNoneMatch: null, // immutable — browser never revalidates
          immutable: true,
        })
      }

      let result = await buildGraphCached(absolutePath)
      if (result.compiledHash !== requestedToken) return null

      return serveModule(result, {
        isSourceMapRequest,
        method,
        ifNoneMatch: null, // immutable — browser never revalidates
        immutable: true,
      })
    } catch (error) {
      if (isNotFoundError(error)) return null
      return responseForCompileError(error)
    }
  }

  async function handleEntryPointRequest(
    absolutePath: string,
    isSourceMapRequest: boolean,
    ifNoneMatch: string | null,
    method: string,
  ): Promise<Response | null> {
    try {
      let cached = store.get(absolutePath)
      if (cached && (await isCompiledGraphFresh(absolutePath, store))) {
        return serveModule(cached, {
          isSourceMapRequest,
          method,
          ifNoneMatch,
          immutable: false,
        })
      }

      let result = await buildGraphCached(absolutePath)

      return serveModule(result, {
        isSourceMapRequest,
        method,
        ifNoneMatch,
        immutable: false,
      })
    } catch (error) {
      return responseForCompileError(error)
    }
  }

  return {
    async handle(request, modulePath) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let normalizedModulePath = modulePath.replace(/^\/+/, '')
      let isSourceMapRequest = normalizedModulePath.endsWith('.map')

      let withoutMap = isSourceMapRequest ? normalizedModulePath.slice(0, -4) : normalizedModulePath
      let tokenMatch = withoutMap.match(/\.@([a-z0-9]+)$/)
      let requestedToken = tokenMatch ? tokenMatch[1] : null
      let normalizedPath = tokenMatch ? withoutMap.slice(0, -tokenMatch[0].length) : withoutMap
      if (normalizedPath.length === 0) return null

      let resolved = resolvePublicPath(normalizedPath)
      if (!resolved) return null

      let absolutePath = toAbsolutePath(resolved.resolvedRoot.directory, resolved.relativePath)
      let ifNoneMatch = request.headers.get('If-None-Match')

      if (requestedToken !== null) {
        return handleInternalModuleRequest(
          absolutePath,
          requestedToken,
          isSourceMapRequest,
          request.method,
        )
      }

      if (!isEntryPointInRoot(resolved.resolvedRoot, resolved.relativePath)) return null

      return handleEntryPointRequest(absolutePath, isSourceMapRequest, ifNoneMatch, request.method)
    },

    async preloads(entryPoint) {
      let { absolutePath } = resolvePreloadEntryPoint(entryPoint)
      let existing = preloadCache.get(absolutePath)
      let cached = store.get(absolutePath)
      if (
        existing &&
        cached?.compiledHash === existing.compiledHash &&
        (await isCompiledGraphFresh(absolutePath, store))
      ) {
        return [...(await existing.promise)]
      }

      let result = await buildGraphCached(absolutePath)

      let nextEntry: PreloadCacheEntry = {
        compiledHash: result.compiledHash,
        promise: Promise.resolve(getPreloadUrls(absolutePath)),
      }

      preloadCache.set(absolutePath, nextEntry)

      try {
        await nextEntry.promise
      } catch (error) {
        if (preloadCache.get(absolutePath) === nextEntry) {
          preloadCache.delete(absolutePath)
        }
        throw error
      }

      let current = preloadCache.get(absolutePath)
      let urls = current && current !== nextEntry ? await current.promise : await nextEntry.promise
      return [...urls]
    },
  }
}
