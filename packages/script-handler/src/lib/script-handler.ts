import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import picomatch from 'picomatch'
import type { ModuleCompileResult, ModuleGraphStore } from './module-graph.ts'
import {
  buildModule,
  buildModuleGraph,
  collectTransitiveDeps,
  createModuleGraphStore,
  CjsModuleError,
} from './module-graph.ts'
import { absolutePathToUrlSegment } from './path-utils.ts'
import { generateETag, matchesETag } from './etag.ts'

export interface ScriptHandlerOptions {
  /** Declared entry point paths or glob patterns */
  entryPoints: readonly string[]
  /** Project root directory — module paths are resolved relative to this */
  root: string
  /**
   * URL base path where the handler is mounted (e.g. `'/scripts'` or `'/assets'`).
   * All rewritten import URLs in compiled modules will be relative to this base.
   *
   * When omitted, the base is inferred from the first incoming request, which
   * works correctly as long as `preloads()` is not called before `handle()`.
   * It's recommended to set this explicitly to avoid subtle ordering issues.
   */
  base?: string
  /** Enable source maps (off by default) */
  sourceMaps?: boolean
  /** Import specifiers to leave unrewritten (CDN URLs, import map entries, etc.) */
  external?: string | string[]
  /** Monorepo root for packages outside `root` (e.g. `'../..'`) */
  workspaceRoot?: string
}

export interface ScriptHandler {
  /**
   * Handles a request for a script module path. Returns `Response | null` — null means the request
   * was not handled by this handler (e.g. path not recognised), letting the
   * router fall through to a 404 or next route.
   */
  handle(request: Request, path: string): Promise<Response | null>
  /**
   * Returns an array of module preload URLs for the given entry point, ordered
   * shallowest-first (entry point first, deepest transitive deps last).
   *
   * Blocks until the module graph is fully built. Call this when rendering HTML
   * to generate `<link rel="modulepreload">` tags.
   *
   * Not calling preloads() is valid — the page renders without preloads on
   * first request and the graph builds lazily in the background.
   */
  preloads(entryPoint: string): Promise<string[]>
}

/**
 * Create the server-side scripts handler.
 *
 * Handles on-demand compilation of TypeScript/JavaScript modules with:
 * - Entry points served with `Cache-Control: no-cache` + ETag
 * - Internal modules served with `Cache-Control: immutable` (hash in URL)
 * - Module graph built eagerly on first entry point request
 * - CommonJS detection with clear error messages
 * - GET and HEAD request support
 *
 * @param options Server-side handler options (entryPoints, root, sourceMaps, external, workspaceRoot)
 * @returns A ScriptHandler with a handle() function and preloads() method
 *
 * @example
 * ```ts
 * // server.ts
 * import { createScriptHandler } from '@remix-run/script-handler'
 *
 * const scripts = createScriptHandler({
 *   entryPoints: ['app/entry.tsx'],
 *   root: import.meta.dirname,
 *   base: '/scripts',
 * })
 *
 * // Mount in your router:
 * route('/scripts/*path', ({ request, params }) => scripts.handle(request, params.path))
 * ```
 */
export function createScriptHandler(options: ScriptHandlerOptions): ScriptHandler {
  let root = path.resolve(process.cwd(), options.root)
  let workspaceRoot = options.workspaceRoot ? path.resolve(root, options.workspaceRoot) : null
  let sourceMaps = options.sourceMaps ?? false
  let externalRaw = options.external
  let external: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []

  let entryPointPatterns = options.entryPoints
  let explicitBase = options.base != null ? options.base.replace(/\/+$/, '') || '/' : null
  let base = explicitBase ?? '/scripts'

  // Compile entry point patterns into matchers
  let entryPointMatchers = entryPointPatterns.map((p) => picomatch(p, { dot: true }))

  function isEntryPoint(relativePath: string): boolean {
    return entryPointMatchers.some((m) => m(relativePath))
  }

  let store: ModuleGraphStore = createModuleGraphStore()
  // In-flight build promises for deduplication
  let inFlight = new Map<string, Promise<ModuleCompileResult>>()
  // Deduplication for entry point graph builds
  let entryPointBuilds = new Map<string, Promise<ModuleCompileResult>>()
  // Deduplication for in-flight preload requests
  let preloadsInFlight = new Map<string, Promise<string[]>>()

  function createModuleGraphOptions() {
    return {
      base,
      root,
      workspaceRoot,
      external,
      sourceMaps,
    }
  }

  function updateBase(nextBase: string) {
    // When an explicit base was provided, trust it — don't infer from requests.
    if (explicitBase != null) return
    if (base === nextBase) return
    base = nextBase
    // Compiled code includes rewritten import URLs with base paths.
    // Clear caches if mount base changes so rewritten URLs stay correct.
    store.clear()
    inFlight.clear()
    entryPointBuilds.clear()
    preloadsInFlight.clear()
  }

  function inferBase(pathname: string, modulePath: string): string {
    let normalizedModulePath = modulePath.replace(/^\/+/, '')
    if (normalizedModulePath.length === 0) return pathname
    let suffix = `/${normalizedModulePath}`
    if (!pathname.endsWith(suffix)) return pathname
    return pathname.slice(0, -suffix.length) || '/'
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

  async function buildEntryPoint(absolutePath: string): Promise<ModuleCompileResult> {
    let existing = entryPointBuilds.get(absolutePath)
    if (existing) return existing
    let promise = buildModule(absolutePath, store, createModuleGraphOptions(), inFlight)
    entryPointBuilds.set(absolutePath, promise)
    try {
      let result = await promise
      return result
    } finally {
      entryPointBuilds.delete(absolutePath)
    }
  }

  async function handle(request: Request, modulePath: string): Promise<Response | null> {
    if (request.method !== 'GET' && request.method !== 'HEAD') return null

    let url = new URL(request.url)
    let requestedHash = url.searchParams.get('v')
    let normalizedModulePath = modulePath.replace(/^\/+/, '')
    let isSourceMapRequest = normalizedModulePath.endsWith('.map')

    // Strip .map suffix for source map requests
    let normalizedPath = isSourceMapRequest
      ? normalizedModulePath.slice(0, -4)
      : normalizedModulePath
    if (normalizedPath.length === 0) return null

    updateBase(inferBase(url.pathname, normalizedModulePath))

    let resolved = absolutePathFromModulePath(normalizedPath)
    if (!resolved) return null

    let { absolutePath, isWorkspace } = resolved
    let ifNoneMatch = request.headers.get('If-None-Match')

    if (requestedHash) {
      return handleInternalModuleRequest(
        absolutePath,
        requestedHash,
        isSourceMapRequest,
        request.method,
      )
    }

    // Entry point request (no hash)
    if (!isWorkspace) {
      let relative = path.relative(root, absolutePath)
      let posix = relative.split(path.sep).join('/')
      if (!isEntryPoint(posix)) return null
    }

    return handleEntryPointRequest(absolutePath, isSourceMapRequest, ifNoneMatch, request.method)
  }

  async function handleEntryPointRequest(
    absolutePath: string,
    isSourceMapRequest: boolean,
    ifNoneMatch: string | null,
    method: string,
  ): Promise<Response | null> {
    try {
      let result = await buildEntryPoint(absolutePath)

      if (isSourceMapRequest) {
        if (!sourceMaps || !result.sourcemap) return null
        let etag = generateETag(result.hash + ':map')
        if (matchesETag(ifNoneMatch, etag)) {
          return new Response(null, { status: 304, headers: { ETag: etag } })
        }
        let body = method === 'HEAD' ? null : result.sourcemap
        return new Response(body, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-cache',
            ETag: etag,
          },
        })
      }

      let etag = generateETag(result.hash)
      if (matchesETag(ifNoneMatch, etag)) {
        return new Response(null, { status: 304, headers: { ETag: etag } })
      }

      let code = result.compiledCode
      if (sourceMaps && result.sourcemap) {
        let urlSegment = absolutePathToUrlSegment(absolutePath, root, workspaceRoot)
        if (urlSegment) {
          let mapPath =
            urlSegment.namespace === 'workspace'
              ? `${base}/__@workspace/${urlSegment.segment}.map`
              : `${base}/${urlSegment.segment}.map`
          code = code + `\n//# sourceMappingURL=${mapPath}`
        }
      }

      let body = method === 'HEAD' ? null : code
      return new Response(body, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache',
          ETag: etag,
        },
      })
    } catch (error) {
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
  }

  async function handleInternalModuleRequest(
    absolutePath: string,
    requestedHash: string,
    isSourceMapRequest: boolean,
    method: string,
  ): Promise<Response | null> {
    try {
      let exists = await fsp
        .stat(absolutePath)
        .then(() => true)
        .catch(() => false)
      if (!exists) return null

      // Check cache first — fast path
      let cached = store.get(absolutePath)
      if (cached) {
        let stat = await fsp.stat(absolutePath)
        let currentStamp = `${stat.size}:${stat.mtimeMs}`
        if (cached.sourceStamp === currentStamp && cached.hash === requestedHash) {
          return serveInternalModule(
            cached,
            isSourceMapRequest,
            method,
            absolutePath,
            requestedHash,
          )
        }
        if (cached.sourceStamp !== currentStamp) {
          // File has changed; rebuild from this point
          let result = await buildModule(absolutePath, store, createModuleGraphOptions(), inFlight)
          if (result.hash !== requestedHash) return null
          return serveInternalModule(
            result,
            isSourceMapRequest,
            method,
            absolutePath,
            requestedHash,
          )
        }
        // Same source stamp but different hash — hash is from a prior build; it's invalid
        return null
      }

      // Not in cache — treat as a new entry point, eagerly build the subgraph
      let result = await buildModule(absolutePath, store, createModuleGraphOptions(), inFlight)
      if (result.hash !== requestedHash) return null
      return serveInternalModule(result, isSourceMapRequest, method, absolutePath, requestedHash)
    } catch (error) {
      if (error instanceof CjsModuleError) {
        return new Response(error.message, {
          status: 500,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      return null
    }
  }

  function serveInternalModule(
    result: ModuleCompileResult,
    isSourceMapRequest: boolean,
    method: string,
    absolutePath: string,
    hash: string,
  ): Response | null {
    if (isSourceMapRequest) {
      if (!sourceMaps || !result.sourcemap) return null
      let body = method === 'HEAD' ? null : result.sourcemap
      return new Response(body, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    let code = result.compiledCode
    if (sourceMaps && result.sourcemap) {
      let urlSegment = absolutePathToUrlSegment(absolutePath, root, workspaceRoot)
      if (urlSegment) {
        let mapPath =
          urlSegment.namespace === 'workspace'
            ? `${base}/__@workspace/${urlSegment.segment}.map?v=${hash}`
            : `${base}/${urlSegment.segment}.map?v=${hash}`
        code = code + `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let body = method === 'HEAD' ? null : code
    return new Response(body, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  async function preloads(entryPoint: string): Promise<string[]> {
    let existing = preloadsInFlight.get(entryPoint)
    if (existing) return existing

    let next = (async (): Promise<string[]> => {
    let absolutePath = path.join(root, ...entryPoint.split('/'))
    // Build the full transitive module graph (compiles all deps lazily but completely)
    await buildModuleGraph(absolutePath, store, createModuleGraphOptions(), inFlight)

    // Collect all modules in BFS order (shallowest first = entry point first)
    let allModules = collectTransitiveDeps(absolutePath, store)

    let urls: string[] = []
    for (let [modulePath, moduleResult] of allModules) {
      let urlSegment = absolutePathToUrlSegment(modulePath, root, workspaceRoot)
      if (!urlSegment) continue

      let isEntryPointModule = modulePath === absolutePath
      let url = isEntryPointModule
        ? urlSegment.namespace === 'workspace'
          ? `${base}/__@workspace/${urlSegment.segment}`
          : `${base}/${urlSegment.segment}`
        : urlSegment.namespace === 'workspace'
          ? `${base}/__@workspace/${urlSegment.segment}?v=${moduleResult.hash}`
          : `${base}/${urlSegment.segment}?v=${moduleResult.hash}`

      urls.push(url)
    }

    return urls
    })()

    preloadsInFlight.set(entryPoint, next)

    try {
      return await next
    } finally {
      preloadsInFlight.delete(entryPoint)
    }
  }

  return { handle, preloads }
}
