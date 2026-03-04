import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import picomatch from 'picomatch'
import type { ModuleCompileResult, ModuleGraphStore } from './module-graph.ts'
import {
  buildGraph,
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
   * URL base path where the handler is mounted (e.g. `'/scripts'`).
   * All rewritten import URLs in compiled modules will be relative to this base.
   *
   * When omitted, the base is inferred from the first incoming request.
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
 *   entryPoints: ['app/entry.tsx'],
 *   root: import.meta.dirname,
 *   base: '/scripts',
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

  let root = realpathOrFallback(path.resolve(process.cwd(), options.root))
  let workspaceRoot = options.workspaceRoot
    ? realpathOrFallback(path.resolve(options.root, options.workspaceRoot))
    : null
  let sourceMaps = options.sourceMaps ?? false
  let externalRaw = options.external
  let external: string[] = Array.isArray(externalRaw)
    ? externalRaw
    : externalRaw
      ? [externalRaw]
      : []

  let entryPointPatterns = options.entryPoints
  let explicitBase = options.base != null ? options.base.replace(/\/+$/, '') || '/' : null
  let base: string | null = explicitBase

  let entryPointMatchers = entryPointPatterns.map((p) => picomatch(p, { dot: true }))

  function isEntryPoint(relativePath: string): boolean {
    return entryPointMatchers.some((m) => m(relativePath))
  }

  let store: ModuleGraphStore = createModuleGraphStore()
  let graphBuilds = new Map<string, Promise<ModuleCompileResult>>()
  let preloadsInFlight = new Map<string, Promise<string[]>>()

  function createModuleGraphOptions() {
    return { base: base!, root, workspaceRoot, external, sourceMaps }
  }

  function updateBase(nextBase: string) {
    if (explicitBase != null) return
    if (base === nextBase) return
    base = nextBase
    store.clear()
    graphBuilds.clear()
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
      absolutePath: string
      // URL token for the source map URL suffix. null for entry points (no token).
      token: string | null
      ifNoneMatch: string | null
      immutable: boolean
    },
  ): Response {
    let etag = generateETag(result.compiledHash)

    if (opts.isSourceMapRequest) {
      if (!sourceMaps || !result.sourcemap) {
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

    let code = result.compiledCode
    if (sourceMaps && result.sourcemap) {
      let urlSegment = absolutePathToUrlSegment(opts.absolutePath, root, workspaceRoot)
      if (urlSegment) {
        let tokenSuffix = opts.token ? `.@${opts.token}` : ''
        let mapPath =
          urlSegment.namespace === 'workspace'
            ? `${base}/__@workspace/${urlSegment.segment}${tokenSuffix}.map`
            : `${base}/${urlSegment.segment}${tokenSuffix}.map`
        code = code + `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let body = opts.method === 'HEAD' ? null : code
    return new Response(body, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': opts.immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        ...(opts.immutable ? {} : { ETag: etag }),
      },
    })
  }

  async function handleInternalModuleRequest(
    absolutePath: string,
    requestedToken: string,
    isSourceMapRequest: boolean,
    ifNoneMatch: string | null,
    method: string,
  ): Promise<Response | null> {
    try {
      let exists = await fsp
        .stat(absolutePath)
        .then(() => true)
        .catch(() => false)
      if (!exists) return null

      let result = await buildGraphCached(absolutePath)
      if (result.compiledHash !== requestedToken) return null

      return serveModule(result, {
        isSourceMapRequest,
        method,
        absolutePath,
        token: result.compiledHash,
        ifNoneMatch: null, // immutable — browser never revalidates
        immutable: true,
      })
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

  async function handleEntryPointRequest(
    absolutePath: string,
    isSourceMapRequest: boolean,
    ifNoneMatch: string | null,
    method: string,
  ): Promise<Response | null> {
    try {
      let result = await buildGraphCached(absolutePath)

      return serveModule(result, {
        isSourceMapRequest,
        method,
        absolutePath,
        token: null,
        ifNoneMatch,
        immutable: false,
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

  return {
    async handle(request, modulePath) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return null

      let url = new URL(request.url)
      let normalizedModulePath = modulePath.replace(/^\/+/, '')
      let isSourceMapRequest = normalizedModulePath.endsWith('.map')

      let withoutMap = isSourceMapRequest ? normalizedModulePath.slice(0, -4) : normalizedModulePath
      let tokenMatch = withoutMap.match(/\.@([a-z0-9]+)$/)
      let requestedToken = tokenMatch ? tokenMatch[1] : null
      let normalizedPath = tokenMatch ? withoutMap.slice(0, -tokenMatch[0].length) : withoutMap
      if (normalizedPath.length === 0) return null

      updateBase(inferBase(url.pathname, normalizedModulePath))
      if (!base) return null

      let resolved = absolutePathFromModulePath(normalizedPath)
      if (!resolved) return null

      let { absolutePath, isWorkspace } = resolved
      let ifNoneMatch = request.headers.get('If-None-Match')

      if (requestedToken !== null) {
        return handleInternalModuleRequest(
          absolutePath,
          requestedToken,
          isSourceMapRequest,
          ifNoneMatch,
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
      let existing = preloadsInFlight.get(entryPoint)
      if (existing) return existing

      let next = (async (): Promise<string[]> => {
        if (!base) return []

        let absolutePath = path.join(root, ...entryPoint.split('/'))

        try {
          await buildGraphCached(absolutePath)
        } catch {
          return []
        }

        let allDeps = collectTransitiveDeps(absolutePath, store)
        let urls: string[] = []

        for (let [depPath, depResult] of allDeps) {
          let urlSegment = absolutePathToUrlSegment(depPath, root, workspaceRoot)
          if (!urlSegment) continue

          let isEntryPointModule = depPath === absolutePath

          let url = isEntryPointModule
            ? urlSegment.namespace === 'workspace'
              ? `${base}/__@workspace/${urlSegment.segment}`
              : `${base}/${urlSegment.segment}`
            : urlSegment.namespace === 'workspace'
              ? `${base}/__@workspace/${urlSegment.segment}.@${depResult.compiledHash}`
              : `${base}/${urlSegment.segment}.@${depResult.compiledHash}`

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
    },
  }
}
