import * as path from 'node:path'
import * as fs from 'node:fs'
import picomatch from 'picomatch'
import { absolutePathToUrlSegmentFromResolvedRoots } from './path-utils.ts'
import type { ModuleCompileResult, ModuleGraphStore } from './module-graph.ts'
import {
  buildGraph,
  collectTransitiveDeps,
  createModuleGraphStore,
  CjsModuleError,
  isCompiledGraphFresh,
} from './module-graph.ts'
import { generateETag, matchesETag } from './etag.ts'

export interface ScriptHandlerOptions {
  /** Declared entry point paths or glob patterns */
  entryPoints: readonly string[]
  /** Project root directory — module paths are resolved relative to this */
  root: string
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
  /** Monorepo root for packages outside `root` (e.g. `'../..'`) */
  workspaceRoot?: string
}

export interface ScriptHandler {
  /**
   * Handles a request for a script module path. Returns `Response | null` — null means
   * the request was not handled by this handler, letting the router fall through to a 404.
   */
  handle(request: Request, path: string): Promise<Response | null>
  /**
   * Returns preload URLs for all transitive deps of the given entry point, ordered
   * shallowest-first. Call this when rendering HTML to populate `<link rel="modulepreload">`.
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
 * const scripts = createScriptHandler({
 *   base: '/scripts',
 *   root: import.meta.dirname,
 *   entryPoints: ['app/entry.tsx'],
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

  let root = realpathOrFallback(path.resolve(process.cwd(), options.root))
  let workspaceRoot = options.workspaceRoot
    ? realpathOrFallback(path.resolve(options.root, options.workspaceRoot))
    : null
  let sourceMaps = options.sourceMaps
  let sourceMapSourcePaths = options.sourceMapSourcePaths ?? 'virtual'
  let externalRaw = options.external
  let external: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []

  let entryPointPatterns = options.entryPoints
  let base = normalizeBase(options.base)

  let entryPointMatchers = entryPointPatterns.map((p) => picomatch(p, { dot: true }))

  function isEntryPoint(relativePath: string): boolean {
    return entryPointMatchers.some((m) => m(relativePath))
  }

  let store: ModuleGraphStore = createModuleGraphStore()
  let graphBuilds = new Map<string, Promise<ModuleCompileResult>>()
  let preloadCache = new Map<string, PreloadCacheEntry>()
  let urlSegmentCache = new Map<
    string,
    { segment: string; namespace: 'root' | 'workspace' } | null
  >()

  function isEntryPointAbsolute(absolutePath: string): boolean {
    let relative = path.relative(root, absolutePath)
    if (relative.startsWith('..')) return false
    return isEntryPoint(relative.split(path.sep).join('/'))
  }

  function toModuleUrl(relativePath: string): string {
    return base === '/' ? `/${relativePath}` : `${base}/${relativePath}`
  }

  function createModuleGraphOptions() {
    return {
      base,
      root,
      workspaceRoot,
      external,
      sourceMaps,
      sourceMapSourcePaths,
      isEntryPoint: isEntryPointAbsolute,
    }
  }

  function getUrlSegment(absolutePath: string) {
    if (urlSegmentCache.has(absolutePath)) {
      return urlSegmentCache.get(absolutePath) ?? null
    }

    let urlSegment = absolutePathToUrlSegmentFromResolvedRoots(absolutePath, root, workspaceRoot)
    urlSegmentCache.set(absolutePath, urlSegment)
    return urlSegment
  }

  function getPreloadUrls(absolutePath: string): string[] {
    let allDeps = collectTransitiveDeps(absolutePath, store)
    let urls: string[] = []

    for (let [depPath, depResult] of allDeps) {
      let urlSegment = getUrlSegment(depPath)
      if (!urlSegment) continue

      let relativePath =
        urlSegment.namespace === 'workspace'
          ? `__@workspace/${urlSegment.segment}`
          : urlSegment.segment

      let url = isEntryPointAbsolute(depPath)
        ? toModuleUrl(relativePath)
        : toModuleUrl(`${relativePath}.@${depResult.compiledHash}`)

      urls.push(url)
    }

    return urls
  }

  function absolutePathFromModulePath(
    modulePath: string,
  ): { absolutePath: string; isWorkspace: boolean } | null {
    let rest = modulePath.replace(/^\/+/, '')
    if (rest.length === 0) return null

    if (rest.startsWith('__@workspace/')) {
      if (!workspaceRoot) return null
      let relative = rest.slice('__@workspace/'.length)
      return { absolutePath: path.join(workspaceRoot, ...relative.split('/')), isWorkspace: true }
    }

    return { absolutePath: path.join(root, ...rest.split('/')), isWorkspace: false }
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

      let resolved = absolutePathFromModulePath(normalizedPath)
      if (!resolved) return null

      let { absolutePath, isWorkspace } = resolved
      let ifNoneMatch = request.headers.get('If-None-Match')

      if (requestedToken !== null) {
        return handleInternalModuleRequest(
          absolutePath,
          requestedToken,
          isSourceMapRequest,
          request.method,
        )
      }

      // Entry point request (no .@token) — must match a configured entry point.
      // Workspace modules are never entry points; they always require a token.
      if (isWorkspace) return null
      let relative = path.relative(root, absolutePath)
      let posix = relative.split(path.sep).join('/')
      if (!isEntryPoint(posix)) return null

      return handleEntryPointRequest(absolutePath, isSourceMapRequest, ifNoneMatch, request.method)
    },

    async preloads(entryPoint) {
      let absolutePath = path.join(root, ...entryPoint.split('/'))
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
