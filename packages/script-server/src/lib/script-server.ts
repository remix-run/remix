import * as path from 'node:path'
import * as fs from 'node:fs'
import { isScriptServerCompilationError } from './compilation-error.ts'
import { createAccessPolicy } from './access.ts'
import { createModuleCompiler, createResponseForModule } from './compiler.ts'
import { normalizeFilePath } from './paths.ts'
import { compileRoutes } from './routes.ts'
import type { CompiledRoutes, ScriptRouteDefinition } from './routes.ts'
import { createScriptServerWatcher } from './watch.ts'
import type { ScriptServerWatcher } from './watch.ts'

interface ScriptServerWatchOptions {
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

interface ScriptServerFingerprintOptions {
  /**
   * Per-build invalidation token that must change whenever fingerprinted module URLs
   * should be invalidated together.
   */
  buildId: string
}

const scriptServerTargets = [
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
const scriptServerTargetSet = new Set<string>(scriptServerTargets)

export type ScriptServerTarget = (typeof scriptServerTargets)[number]

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
   * Controls optional source-based URL fingerprinting for rewritten import URLs.
   *
   * When omitted, all served modules use stable non-fingerprinted URLs with `Cache-Control: no-cache`.
   * Cannot be used together with `watch`.
   */
  fingerprint?: ScriptServerFingerprintOptions
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
  target?: ScriptServerTarget
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

type ScriptServerInternals = {
  watcher: ScriptServerWatcher | null
}

const internalStateByScriptServer = new WeakMap<ScriptServer, ScriptServerInternals>()

type ResolvedScriptServerOptions = {
  allow: readonly string[]
  buildId?: string
  define?: Record<string, string>
  deny?: readonly string[]
  external: string[]
  fingerprintModules: boolean
  minify: boolean
  onError: NonNullable<ScriptServerOptions['onError']>
  root: string
  routeDefinitions: readonly ScriptRouteDefinition[]
  routes: CompiledRoutes
  sourceMapSourcePaths: 'url' | 'absolute'
  sourceMaps?: 'inline' | 'external'
  target?: ScriptServerTarget
  watchOptions: ScriptServerWatchOptions | null
}

// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function getInternalScriptServerWatchedDirectories(scriptServer: ScriptServer): string[] {
  return internalStateByScriptServer.get(scriptServer)?.watcher?.getWatchedDirectories() ?? []
}

// Internal-only test hook. This is intentionally not re-exported from the package entrypoint.
export function waitForInternalScriptServerWatcher(scriptServer: ScriptServer): Promise<void> {
  return internalStateByScriptServer.get(scriptServer)?.watcher?.whenReady() ?? Promise.resolve()
}

/**
 * Create the server-side scripts server.
 *
 * Compiles TypeScript/JavaScript modules on demand with optional source-based URL
 * fingerprinting, caching, and configurable route mapping.
 *
 * @param options Server configuration
 * @returns A {@link ScriptServer} with `fetch()`, `getHref()`, and `getPreloads()` methods
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
  let resolvedOptions = resolveScriptServerOptions(options)
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
    target: resolvedOptions.target,
  })
  let watcher = resolvedOptions.watchOptions
    ? createScriptServerWatcher({
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

  let scriptServer: ScriptServer = {
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
          isScriptServerCompilationError(error) &&
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

  internalStateByScriptServer.set(scriptServer, {
    watcher,
  })

  return scriptServer
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

function resolveScriptServerOptions(options: ScriptServerOptions): ResolvedScriptServerOptions {
  let root = normalizeFilePath(fs.realpathSync(path.resolve(options.root ?? process.cwd())))
  let fingerprintOptions = normalizeFingerprintOptions({
    fingerprint: options.fingerprint,
    watch: options.watch,
  })

  return {
    allow: options.allow,
    buildId: fingerprintOptions.buildId,
    define: options.define,
    deny: options.deny,
    external: options.external ?? [],
    fingerprintModules: fingerprintOptions.enabled,
    minify: options.minify ?? false,
    onError: options.onError ?? defaultErrorHandler,
    root,
    routeDefinitions: options.routes,
    routes: compileRoutes({
      root,
      routes: options.routes,
    }),
    sourceMapSourcePaths: options.sourceMapSourcePaths ?? 'url',
    sourceMaps: options.sourceMaps,
    target: normalizeTarget(options.target),
    watchOptions: normalizeWatchOptions(options.watch),
  }
}

function normalizeTarget(target: ScriptServerOptions['target']): ScriptServerTarget | undefined {
  if (target == null) return undefined

  if (typeof target !== 'string' || !scriptServerTargetSet.has(target)) {
    throw new TypeError(
      `Expected target to be one of ${scriptServerTargets.map((value) => `"${value}"`).join(', ')}. Received "${target}".`,
    )
  }

  return target as ScriptServerTarget
}

function normalizeFingerprintOptions(options: {
  fingerprint: ScriptServerOptions['fingerprint']
  watch: ScriptServerOptions['watch']
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
  options: ScriptServerOptions['watch'],
): ScriptServerWatchOptions | null {
  if (!options) return null
  return options === true ? {} : options
}
