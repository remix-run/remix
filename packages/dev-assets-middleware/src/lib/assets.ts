import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as esbuild from 'esbuild'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import type { Middleware, Assets, AssetEntry } from '@remix-run/fetch-router'

// HMR imports (conditional, only used if hmr: true)
import { generateRuntimeModule } from './hmr-runtime.ts'
import { transformComponent, maybeHasComponent, HMR_RUNTIME_PATH } from './hmr-transform.ts'
import { createHmrEventSource, type HmrEventSource } from './hmr-sse.ts'
import { createWatcher, type HmrWatcher } from './hmr-watcher.ts'

// Module graph imports
import {
  type ModuleNode,
  type ModuleGraph,
  createModuleGraph,
  ensureModuleNode,
  getModuleByUrl,
  getModuleByFile,
  invalidateModule,
} from './module-graph.ts'

// Import parsing and analysis
import { extractImportSpecifiers, getPackageName, isCommonJS } from './import-rewriter.ts'

// Re-export for public API (these are tested utilities)
export { extractImportSpecifiers, getPackageName, isCommonJS } from './import-rewriter.ts'

// es-module-lexer for internal use in rewriteImports (parseImports already imported at top)
let lexerReady = lexerInit

// Parse inline source map from transformed code (exported for testing)
export function parseInlineSourceMap(code: string): {
  sources: string[]
  sourcesContent?: string[]
  mappings: string
} | null {
  let match = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/)
  if (!match) return null

  try {
    let json = Buffer.from(match[1], 'base64').toString('utf-8')
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Generate ETag from file stats (exported for testing)
export function generateETag(mtime: Date, size: number): string {
  // Use mtime (ms) and size to create a simple but effective ETag
  // Format: W/"mtime-size" (weak ETag since transforms may vary)
  return `W/"${mtime.getTime().toString(36)}-${size.toString(36)}"`
}

// Check if request's If-None-Match header matches ETag (exported for testing)
export function matchesETag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false

  // Handle multiple ETags in If-None-Match (comma-separated)
  let tags = ifNoneMatch.split(',').map((t) => t.trim())

  // Check for wildcard
  if (tags.includes('*')) return true

  // Check for exact match (with or without weak prefix)
  for (let tag of tags) {
    // Normalize: remove W/ prefix for comparison
    let normalizedTag = tag.replace(/^W\//, '')
    let normalizedETag = etag.replace(/^W\//, '')
    if (normalizedTag === normalizedETag) return true
  }

  return false
}

/**
 * Explicit list of esbuild options supported in dev mode.
 *
 * This is the single source of truth for both the TypeScript type and runtime filtering.
 * Options not listed here are silently ignored to prevent build-specific options
 * (minify, splitting, outdir, etc.) from affecting dev behavior.
 */
const SUPPORTED_ESBUILD_OPTIONS = [
  // Entry points and target
  'entryPoints', // Restricts assets.get() in dev, used as-is in prod
  'target', // Browser compatibility
  // JSX configuration
  'jsx',
  'jsxDev',
  'jsxFactory',
  'jsxFragment',
  'jsxImportSource',
  'jsxSideEffects',
  // TypeScript configuration
  'tsconfig',
  'tsconfigRaw',
  // Module resolution
  'conditions',
  'mainFields',
  'alias',
  'resolveExtensions',
  'nodePaths',
  'platform',
  'packages',
  'external', // Imports to skip rewriting (for import maps, CDNs)
  // Transforms and code generation
  'define',
  'pure',
  'supported',
  'keepNames',
  'drop',
  'charset',
  // Extensibility
  'plugins',
  'loader',
  // Source maps
  'sourcemap', // false stays false, other values → 'inline' in dev
  'sourceRoot',
  'sourcesContent',
  // Logging
  'logLevel',
  'logLimit',
  'logOverride',
  'color',
] as const satisfies ReadonlyArray<keyof esbuild.BuildOptions>

/**
 * Supported esbuild options for dev/prod config sharing.
 *
 * This is an explicit list of options that make sense to share between
 * development and production builds. Options not listed here are either:
 * - Controlled internally by dev middleware (bundle, write, format, etc.)
 * - Build-specific optimizations (minify, splitting, etc.)
 * - Output configuration (outdir, entryNames, etc.)
 */
export type DevAssetsEsbuildConfig = Pick<
  esbuild.BuildOptions,
  (typeof SUPPORTED_ESBUILD_OPTIONS)[number]
>

/**
 * Options for workspace access via `/__@workspace/` URLs.
 *
 * Files outside the app root can be served via `/__@workspace/` URLs when this is configured.
 * This is useful for serving node_modules and workspace packages in a monorepo.
 */
export interface DevAssetsWorkspaceOptions {
  /**
   * The root directory for `/__@workspace/` URLs. All paths served via `/__@workspace/`
   * are relative to this directory.
   *
   * In a monorepo, this should be the monorepo root so that workspace packages
   * and their node_modules can be served.
   *
   * @example
   * root: '../..' // for demos/my-app serving from monorepo root
   */
  root: string

  /**
   * Array of regex patterns that allow files to be served via `/__@workspace/` URLs.
   * Paths are tested as posix-style paths relative to `root`.
   *
   * @example
   * allow: [/node_modules/, /^packages\//]
   */
  allow: RegExp[]

  /**
   * Array of regex patterns that block files from being served via `/__@workspace/`.
   * Takes precedence over `allow`. Paths are tested as posix-style paths relative to `root`.
   *
   * These patterns are combined with the top-level `deny` patterns.
   *
   * @example
   * deny: [/\/test\//, /\.spec\.ts$/]
   */
  deny?: RegExp[]
}

/**
 * Options for the `devAssets` middleware.
 */
export interface DevAssetsOptions {
  /**
   * The root directory to serve app files from.
   * Defaults to the current working directory if not specified.
   *
   * @example
   * root: '.'        // Serve from project root
   * root: './app'    // Serve from app directory
   */
  root?: string

  /**
   * Enable Hot Module Replacement (HMR).
   *
   * When enabled, the middleware will:
   * - Watch files for changes
   * - Transform components with HMR support
   * - Push updates to connected browsers via Server-Sent Events
   * - Inject HMR runtime into HTML responses
   *
   * @default false
   */
  hmr?: boolean

  /**
   * Array of regex patterns that allow files to be served from the app root.
   * Paths are tested as posix-style paths relative to `root`.
   *
   * @example
   * allow: [/^app\//]  // Only serve files under app/
   */
  allow: RegExp[]

  /**
   * Array of regex patterns that block files from being served.
   * Takes precedence over `allow`. Paths are tested as posix-style paths relative to `root`.
   *
   * These patterns are inherited by the workspace configuration.
   *
   * @example
   * deny: [/\.env($|\.)/, /\.(pem|key|crt)$/]  // Block secrets
   */
  deny?: RegExp[]

  /**
   * Workspace access configuration for `/__@workspace/` URLs.
   *
   * When configured, files outside the app root can be served via `/__@workspace/` URLs.
   * This is required for serving node_modules and workspace packages.
   */
  workspace?: DevAssetsWorkspaceOptions

  /**
   * esbuild configuration to use for transforms and resolution.
   *
   * Allows sharing the same config between dev and prod builds for parity.
   * This enables you to define your build config once and use it in both environments.
   *
   * **Only options that make sense in both dev and prod are supported.**
   * This is an explicit list to ensure config safety. See `DevAssetsEsbuildConfig`
   * type for the complete list of supported options.
   *
   * **Key supported options:**
   * - `entryPoints` - Restricts `assets.get()` in dev, used as-is in prod
   * - `target` - Browser compatibility (e.g., 'es2022', 'es2020')
   * - `jsx*` - JSX transform settings (jsx, jsxImportSource, etc.)
   * - `tsconfig`, `tsconfigRaw` - TypeScript configuration
   * - `plugins` - Custom file type loaders (e.g., MDX, GraphQL)
   * - `loader` - Custom loaders per extension
   * - `conditions`, `mainFields`, `alias` - Module resolution settings
   * - `define`, `pure`, `supported` - Code transforms
   * - `sourcemap` - `false` to disable, any other value becomes `'inline'` in dev
   * - `external` - Imports that should not be rewritten (for import maps, CDN URLs, etc.)
   *   - Note: HTTP/HTTPS URLs must be explicitly listed to be treated as external
   *
   * **Build-specific options (NOT supported):**
   * Options for output structure (`outdir`, `splitting`), optimizations (`minify`),
   * and bundling behavior (`bundle`) are not included since they differ between
   * dev and prod. Configure these directly in your build script.
   *
   * **Note on unbundled dev model:**
   * Dev middleware maintains an unbundled, one-file-at-a-time model by internally
   * setting `bundle: true` and `external: ['*']` to enable plugins while preventing
   * actual bundling. Your `external` config is used to skip import rewriting, not
   * passed to esbuild.
   *
   * @example
   * // Shared config used by both dev and prod
   * let esbuildConfig = {
   *   entryPoints: ['app/entry.tsx'],
   *   target: 'es2022',
   *   plugins: [mdxPlugin()],
   *   external: ['@remix-run/component'], // For import maps or CDNs
   * }
   *
   * // server.ts (dev) - external imports left unchanged for import map
   * devAssets({ allow: [/^app\//], esbuildConfig })
   *
   * // build.ts (prod) - external not bundled
   * esbuild.build({ ...esbuildConfig, bundle: true, minify: true, outdir: './build' })
   */
  esbuildConfig?: DevAssetsEsbuildConfig
}

// Re-export types from fetch-router for convenience
export type { Assets, AssetEntry } from '@remix-run/fetch-router'

/**
 * Creates an assets API for dev mode with 1:1 source-to-URL mapping.
 *
 * In dev mode:
 * - `href` returns the source path as a URL (e.g., '/app/entry.tsx')
 * - `chunks` returns `[href]` since there's no code splitting in dev
 *
 * @param root The root directory where source files are served from
 * @param entryPoints Optional list of entry points to restrict access to
 * @returns An assets object for resolving entry paths to URLs
 *
 * @example
 * let assets = createDevAssets('.')
 * let entry = assets.get('app/entry.tsx')
 * // entry?.href = '/app/entry.tsx'
 * // entry?.chunks = ['/app/entry.tsx']
 */
export function createDevAssets(root: string, entryPoints?: string[]): Assets {
  // Ensure root is an absolute path
  let absoluteRoot = path.resolve(root)

  // Normalize entry points if provided (remove leading slashes for consistent comparison)
  let normalizedEntryPoints = entryPoints?.map((ep) => ep.replace(/^\/+/, ''))

  return {
    get(entryPath: string): AssetEntry | null {
      // Normalize the entry path (remove leading slashes, handle both formats)
      let normalizedPath = entryPath.replace(/^\/+/, '')

      // If entry points are specified, check if this path is allowed
      if (normalizedEntryPoints && !normalizedEntryPoints.includes(normalizedPath)) {
        return null
      }

      // Build the absolute file path
      let filePath = path.join(absoluteRoot, normalizedPath)

      // Return null if file doesn't exist
      if (!fs.existsSync(filePath)) {
        return null
      }

      // In dev mode, the URL is just the source path with a leading slash
      let href = '/' + normalizedPath

      return {
        href,
        chunks: [href],
      }
    },
  }
}

// Debug mode - set DEBUG=assets to enable verbose logging
let DEBUG = process.env.DEBUG?.includes('assets')

// Per-instance caches
interface Caches {
  // Resolution cache: key is `${specifier}\0${importerDir}`, value is resolved URL
  resolution: Map<string, string>
  // Module graph for transform caching and HMR
  moduleGraph: ModuleGraph
}

// Convert a path to posix-style (forward slashes)
function toPosixPath(p: string): string {
  return p.split(path.sep).join('/')
}

// Check if a posix path matches any pattern in the list
function matchesPatterns(posixPath: string, patterns: RegExp[]): boolean {
  for (let pattern of patterns) {
    if (pattern.test(posixPath)) {
      return true
    }
  }
  return false
}

// Check if a path is allowed to be served
function isPathAllowed(posixPath: string, allow: RegExp[], deny: RegExp[]): boolean {
  // Deny takes precedence
  if (deny.length > 0 && matchesPatterns(posixPath, deny)) {
    return false
  }
  // Must match at least one allow pattern (or allow is empty, which means deny everything)
  if (allow.length === 0) {
    return false
  }
  return matchesPatterns(posixPath, allow)
}

// Check if an import specifier is external (should not be rewritten)
function isExternalSpecifier(specifier: string, externalPatterns: (string | RegExp)[]): boolean {
  // Check against user-defined external patterns
  for (let pattern of externalPatterns) {
    if (typeof pattern === 'string') {
      // Exact match for strings
      if (specifier === pattern) {
        return true
      }
    } else {
      // Regex test for patterns
      if (pattern.test(specifier)) {
        return true
      }
    }
  }

  return false
}

/**
 * Creates a middleware that serves and transforms source files for development.
 * For production, use `buildAssets` with a manifest.
 *
 * - Transforms files with esbuild (supports `.ts`, `.tsx`, `.js`, `.jsx`, etc.)
 * - Rewrites imports to browser-compatible paths
 * - Serves files outside the app root via `/__@workspace/...` URLs
 * - Access control via `allow`/`deny` patterns (paths and extensions)
 *
 * @param options Configuration options
 * @returns The dev assets middleware
 *
 * @example
 * import { createRouter } from '@remix-run/fetch-router'
 * import { devAssets } from '@remix-run/dev-assets-middleware'
 *
 * let router = createRouter({
 *   middleware: [
 *     devAssets({
 *       allow: [/^app\//],
 *       workspace: {
 *         root: '../..',
 *         allow: [/node_modules/, /^packages\//],
 *       },
 *     }),
 *   ],
 * })
 */
export function devAssets(options: DevAssetsOptions): Middleware {
  // Ensure root is an absolute path, default to cwd
  let root = path.resolve(options.root ?? process.cwd())

  // Extract app root allow/deny patterns
  let appAllowPatterns = options.allow ?? []
  let appDenyPatterns = options.deny ?? []

  // Extract workspace options - workspaceRoot may be null if workspace is not configured
  let workspaceRoot = options.workspace?.root ? path.resolve(options.workspace.root) : null
  let workspaceAllowPatterns = options.workspace?.allow ?? []
  // Workspace deny inherits from top-level deny
  let workspaceDenyPatterns = [...appDenyPatterns, ...(options.workspace?.deny ?? [])]

  // Extract esbuild config
  let esbuildConfig = options.esbuildConfig
  let entryPoints = esbuildConfig?.entryPoints as string[] | undefined

  // Extract external patterns from esbuild config
  // Normalize to array of strings/regexes - esbuild accepts string | RegExp | (string | RegExp)[]
  let externalRaw = esbuildConfig?.external
  let externalPatterns: (string | RegExp)[] = []
  if (externalRaw) {
    externalPatterns = Array.isArray(externalRaw) ? externalRaw : [externalRaw]
  }

  // Create per-instance caches
  let caches: Caches = {
    resolution: new Map(),
    moduleGraph: createModuleGraph(),
  }

  // Create the assets API for dev mode with optional entry points restriction
  let assetsApi = createDevAssets(root, entryPoints)

  // Set up HMR if enabled
  let hmrEventSource: HmrEventSource | null = null
  let hmrWatcher: HmrWatcher | null = null

  if (options.hmr) {
    // Create SSE event source for pushing updates to browsers
    hmrEventSource = createHmrEventSource(DEBUG)

    // Create file watcher
    hmrWatcher = createWatcher({
      root,
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      allowPatterns: appAllowPatterns,
    })

    // Wire file watcher to module graph + SSE notifications
    hmrWatcher.onFileChange((event) => {
      // Convert relative path to URL (add leading slash)
      let url = '/' + event.relativePath

      // Get the module node if it exists
      let moduleNode = getModuleByUrl(caches.moduleGraph, url)

      if (moduleNode) {
        // Mark file as changed with event timestamp for cache busting
        moduleNode.changeTimestamp = event.timestamp

        // Invalidate the module's transform cache
        invalidateModule(moduleNode)

        // Find all affected components (walk up to component boundaries)
        let affectedUrls: string[] = []
        let visited = new Set<ModuleNode>()

        function findAffectedComponents(node: ModuleNode) {
          if (visited.has(node)) return
          visited.add(node)

          // If this is a component file, it's an HMR boundary - stop here
          if (node.isComponent) {
            affectedUrls.push(node.url)
            return // Don't bubble further
          }

          // Mark non-component as changed so imports get cache-busting timestamps
          node.changeTimestamp = event.timestamp

          // Not a component - bubble up to all importers
          for (let importer of node.importers) {
            findAffectedComponents(importer)
          }
        }

        findAffectedComponents(moduleNode)

        // Send SSE update to connected browsers
        if (affectedUrls.length > 0) {
          hmrEventSource!.sendUpdate(affectedUrls, event.timestamp)
        }
      }
    })

    // Start watching
    hmrWatcher.start()
  }

  /**
   * Intercept HTML responses to inject HMR runtime script.
   *
   * @param response The response from downstream middleware
   * @returns The response, potentially modified to include HMR script
   */
  async function interceptHtmlResponse(response: Response): Promise<Response> {
    if (!options.hmr) return response
    if (!response.ok) return response

    let contentType = response.headers.get('Content-Type')
    if (!contentType?.includes('text/html')) return response

    let html = await response.text()

    // HMR runtime script - auto-connects and sets up requestRemount when loaded
    let hmrScript = `<script type="module" src="${HMR_RUNTIME_PATH}"></script>`

    // Insert before first <script> tag or before </head>
    if (html.includes('<script')) {
      html = html.replace('<script', hmrScript + '\n    <script')
    } else if (html.includes('</head>')) {
      html = html.replace('</head>', '  ' + hmrScript + '\n  </head>')
    }

    // Build new headers, removing Content-Length (will be recalculated)
    let newHeaders = new Headers(response.headers)
    newHeaders.delete('Content-Length')
    newHeaders.set('Content-Type', 'text/html; charset=utf-8')
    newHeaders.set('Cache-Control', 'no-cache')

    return new Response(html, {
      status: response.status,
      headers: newHeaders,
    })
  }

  let middleware: Middleware & { dispose?: () => Promise<void> } = async (context, next) => {
    // Set the assets API on context so route handlers can access it
    context.assets = assetsApi

    // Only handle GET/HEAD requests for file serving
    if (context.method !== 'GET' && context.method !== 'HEAD') {
      return next()
    }

    let { pathname } = context.url
    let ifNoneMatch = context.request.headers.get('If-None-Match')

    // Handle HMR endpoints (if HMR is enabled)
    if (options.hmr && hmrEventSource) {
      // SSE endpoint for pushing updates
      if (pathname === '/__@remix/hmr') {
        return hmrEventSource.connect()
      }

      // Runtime module endpoint
      if (pathname === HMR_RUNTIME_PATH) {
        let runtimeCode = generateRuntimeModule()
        return new Response(runtimeCode, {
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        })
      }
    }

    // Handle /__@workspace/ requests
    if (pathname.startsWith('/__@workspace/')) {
      if (!workspaceRoot) {
        console.warn(`[dev-assets-middleware] Blocked: ${pathname}`)
        console.warn(`  Workspace access not configured. Add workspace config:`)
        console.warn(`  workspace: { root: '../..', allow: [/node_modules/] }`)
        return new Response('Workspace access not configured', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
      return handleWorkspaceRequest(
        pathname,
        root,
        workspaceRoot,
        workspaceAllowPatterns,
        workspaceDenyPatterns,
        caches,
        ifNoneMatch,
        esbuildConfig,
        externalPatterns,
        options.hmr ?? false,
      )
    }

    // Map URL to file path (strip leading slash)
    let relativePath = pathname.replace(/^\/+/, '')
    let posixPath = toPosixPath(relativePath)
    let filePath = path.join(root, relativePath)

    // Check if file exists and is a regular file - if not, let the router handle it
    // This allows routes like "/" to work without matching allow patterns
    let stat: fs.Stats
    try {
      stat = await fsp.stat(filePath)
      // If it's a directory, not a file, let the router handle it
      if (stat.isDirectory()) {
        return interceptHtmlResponse(await next())
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return interceptHtmlResponse(await next())
      }
      throw error
    }

    // File exists - now check if this path is allowed to be served
    if (!isPathAllowed(posixPath, appAllowPatterns, appDenyPatterns)) {
      console.warn(`[dev-assets-middleware] Blocked: ${pathname}`)
      if (appAllowPatterns.length === 0) {
        console.warn(`  No allow patterns configured. Add to config:`)
        console.warn(`  allow: [/^app\\//]`)
      } else if (matchesPatterns(posixPath, appDenyPatterns)) {
        console.warn(`  Matched deny pattern`)
      } else {
        console.warn(`  No allow pattern matched. Current patterns:`)
        for (let pattern of appAllowPatterns) {
          console.warn(`    ${pattern}`)
        }
        console.warn(`  Consider adding: allow: [/${posixPath.split('/')[0] || posixPath}\\//]`)
      }
      return new Response('Forbidden', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    // Generate ETag from the stat we already have
    let etag = generateETag(stat.mtime, stat.size)

    // Check if client has current version
    if (matchesETag(ifNoneMatch, etag)) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag },
      })
    }

    // Read and transform the file
    try {
      let source = await fsp.readFile(filePath, 'utf-8')
      let transformed = await transformSource(
        source,
        filePath,
        pathname,
        root,
        workspaceRoot,
        workspaceAllowPatterns,
        workspaceDenyPatterns,
        caches,
        esbuildConfig,
        externalPatterns,
        stat.mtimeMs,
        options.hmr ?? false,
      )

      return new Response(transformed, {
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache',
          ETag: etag,
        },
      })
    } catch (error) {
      // Transform or read error
      let message = error instanceof Error ? error.message : String(error)
      return new Response(`Transform error: ${message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  }

  // Add dispose method for cleaning up resources (primarily the HMR watcher)
  middleware.dispose = async () => {
    if (hmrWatcher) {
      await hmrWatcher.stop()
    }
  }

  return middleware
}

// Handle requests for workspace files via /__@workspace/ URLs.
// The path after /__@workspace/ is relative to workspaceRoot.
async function handleWorkspaceRequest(
  pathname: string,
  root: string,
  workspaceRoot: string,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
  ifNoneMatch: string | null,
  esbuildConfig: DevAssetsEsbuildConfig | undefined,
  externalPatterns: (string | RegExp)[],
  hmrEnabled: boolean,
): Promise<Response> {
  // Strip /__@workspace/ prefix to get the posix path relative to workspaceRoot
  let posixPath = pathname.slice('/__@workspace/'.length)

  // Security: check if this path is allowed
  if (!isPathAllowed(posixPath, allowPatterns, denyPatterns)) {
    console.warn(`[dev-assets-middleware] Blocked: ${pathname}`)
    if (allowPatterns.length === 0) {
      console.warn(`  No workspace.allow patterns configured. Add to config:`)
      console.warn(`  workspace: { allow: [/node_modules/] }`)
    } else if (matchesPatterns(posixPath, denyPatterns)) {
      console.warn(`  Matched deny pattern`)
    } else {
      console.warn(`  No allow pattern matched. Current patterns:`)
      for (let pattern of allowPatterns) {
        console.warn(`    ${pattern}`)
      }
      console.warn(`  Consider adding: workspace: { allow: [/${posixPath.split('/')[0]}\\//] }`)
    }
    return new Response(`Forbidden: ${posixPath}`, {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Convert posix path to filesystem path
  let filePath = path.join(workspaceRoot, ...posixPath.split('/'))

  try {
    // Stat for ETag
    let stat = await fsp.stat(filePath)
    let etag = generateETag(stat.mtime, stat.size)

    // Check if client has current version
    if (matchesETag(ifNoneMatch, etag)) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag },
      })
    }

    let source = await fsp.readFile(filePath, 'utf-8')

    // Check for CommonJS patterns
    if (isCommonJS(source)) {
      return new Response(
        `CommonJS module detected: ${posixPath}\n\n` +
          `This package uses CommonJS (require/module.exports) which is not supported.\n` +
          `Please use an ESM-compatible package.`,
        {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        },
      )
    }

    // Transform the file (rewrite its imports too)
    let transformed = await transformSource(
      source,
      filePath,
      pathname,
      root,
      workspaceRoot,
      allowPatterns,
      denyPatterns,
      caches,
      esbuildConfig,
      externalPatterns,
      stat.mtimeMs,
      hmrEnabled,
    )

    return new Response(transformed, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        ETag: etag,
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Response(`Not Found: ${posixPath}`, { status: 404 })
    }
    let message = error instanceof Error ? error.message : String(error)
    return new Response(`Error serving ${posixPath}: ${message}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}

// Transform source code with esbuild and rewrite imports
async function transformSource(
  source: string,
  filePath: string,
  sourceUrl: string,
  root: string,
  workspaceRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
  esbuildConfig: DevAssetsEsbuildConfig | undefined,
  externalPatterns: (string | RegExp)[],
  fileMtime?: number,
  hmrEnabled: boolean = false,
): Promise<string> {
  let startTime = performance.now()

  // Get or create the module node
  let moduleNode = ensureModuleNode(caches.moduleGraph, sourceUrl, filePath)

  // Check if we have a valid cached transform result
  if (
    moduleNode.transformResult &&
    moduleNode.lastModified !== undefined &&
    fileMtime !== undefined &&
    moduleNode.lastModified === fileMtime
  ) {
    if (DEBUG) {
      let elapsed = (performance.now() - startTime).toFixed(1)
      console.log(`[dev-assets-middleware] cache hit ${path.basename(filePath)} in ${elapsed}ms`)
    }
    return moduleNode.transformResult.code
  }

  // Determine sourcemap setting: false stays false, everything else becomes 'inline'
  let sourcemap: boolean | 'inline' = esbuildConfig?.sourcemap === false ? false : 'inline'

  // Extract only supported options from user config.
  // Uses SUPPORTED_ESBUILD_OPTIONS as the single source of truth - any option not listed
  // is ignored (fail-safe). This prevents build-specific options (minify, splitting, etc.)
  // from affecting dev, and ensures new esbuild options require explicit opt-in.
  let userConfig: Partial<esbuild.BuildOptions> = {}
  if (esbuildConfig) {
    for (let key of SUPPORTED_ESBUILD_OPTIONS) {
      // Handle separately:
      if (key === 'entryPoints') continue // Used for assets.get() restriction
      if (key === 'external') continue // Used for import rewriting, not passed to esbuild
      let value = esbuildConfig[key]
      if (value !== undefined) {
        // @ts-expect-error - TypeScript doesn't know the key is valid, but we do via the constant
        userConfig[key] = value
      }
    }
  }

  // Transform with esbuild.build() using entryPoints
  // This allows esbuild to find tsconfig.json and enables plugins to work correctly
  let result = await esbuild.build({
    // User config (only supported options)
    ...userConfig,
    // Use entryPoints so esbuild can:
    // 1. Find and read tsconfig.json for jsx/jsxImportSource settings
    // 2. Run onLoad plugins if present
    // 3. Infer the correct loader from file extension
    entryPoints: [filePath],
    bundle: true, // Enable bundling so plugins work
    external: ['*'], // Mark everything external to maintain unbundled behavior
    write: false, // MUST: Return in memory, don't write to disk
    format: 'esm', // MUST: Always ESM
    sourcemap, // Honor false, coerce everything else to inline
  })

  // Extract the output code and map
  let output = result.outputFiles?.[0]
  if (!output) {
    throw new Error('esbuild did not produce output')
  }

  let code = output.text
  let map = result.outputFiles?.[1]?.text ?? null

  // Rewrite imports in the transformed code, generating combined source map
  let rewritten = await rewriteImports(
    code,
    map,
    sourceUrl,
    filePath,
    root,
    workspaceRoot,
    allowPatterns,
    denyPatterns,
    caches,
    externalPatterns,
    moduleNode,
  )

  if (DEBUG) {
    let elapsed = (performance.now() - startTime).toFixed(1)
    console.log(`[dev-assets-middleware] transform ${path.basename(filePath)} in ${elapsed}ms`)
  }

  // Apply HMR transform if enabled and file might contain components
  if (hmrEnabled && maybeHasComponent(rewritten.code)) {
    try {
      let hmrResult = await transformComponent(rewritten.code, sourceUrl)
      rewritten.code = hmrResult.code
      rewritten.map = hmrResult.map ?? null

      // Mark as component (HMR boundary)
      moduleNode.isComponent = true
    } catch (error) {
      // Log HMR transform errors but don't fail the request
      console.error(`[HMR] Transform error for ${sourceUrl}:`, error)
    }
  }

  // Append inline source map
  if (rewritten.map) {
    let base64Map = Buffer.from(rewritten.map).toString('base64')
    rewritten.code += `\n//# sourceMappingURL=data:application/json;base64,${base64Map}`
  }

  // Cache the transform result
  moduleNode.transformResult = {
    code: rewritten.code,
    map: rewritten.map,
  }
  if (fileMtime !== undefined) {
    moduleNode.lastModified = fileMtime
  }

  return rewritten.code
}

// Rewrite imports in the source code using es-module-lexer and magic-string
async function rewriteImports(
  source: string,
  esbuildMap: string,
  sourceUrl: string,
  importerPath: string,
  root: string,
  workspaceRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
  externalPatterns: (string | RegExp)[],
  importerNode: ModuleNode,
): Promise<{ code: string; map: string | null }> {
  // Ensure lexer is initialized
  await lexerReady

  let importerDir = path.dirname(importerPath)

  // Parse imports with es-module-lexer
  // Note: Re-export statements like `export { x } from 'y'` are included in the imports array
  let [imports] = parseImports(source)

  // Collect all import specifiers with their positions
  let importInfos: Array<{ specifier: string; start: number; end: number }> = []

  for (let imp of imports) {
    // imp.n is the specifier (null for dynamic imports with non-string argument)
    // imp.s is the start of the specifier string (after the quote)
    // imp.e is the end of the specifier string (before the quote)
    if (imp.n != null) {
      importInfos.push({
        specifier: imp.n,
        start: imp.s,
        end: imp.e,
      })
    }
  }

  if (importInfos.length === 0) {
    return { code: source, map: esbuildMap }
  }

  // Collect uncached specifiers for batch resolution
  let uncachedSpecifiers: string[] = []

  for (let { specifier } of importInfos) {
    // Skip external imports (user-configured externals)
    if (isExternalSpecifier(specifier, externalPatterns)) {
      continue
    }

    // Check cache
    let cacheKey = `${specifier}\0${importerDir}`
    if (!caches.resolution.has(cacheKey)) {
      uncachedSpecifiers.push(specifier)
    }
  }

  // Batch resolve all uncached specifiers through esbuild
  if (uncachedSpecifiers.length > 0) {
    let uniqueSpecifiers = [...new Set(uncachedSpecifiers)]
    if (DEBUG) {
      console.log(`[dev-assets-middleware] batch resolving ${uniqueSpecifiers.length} specifiers`)
    }
    await batchResolveSpecifiers(
      uniqueSpecifiers,
      importerDir,
      root,
      workspaceRoot,
      allowPatterns,
      denyPatterns,
      caches,
      externalPatterns,
    )
  }

  // Use MagicString for source map-preserving string manipulation
  let magicString = new MagicString(source)
  let hasChanges = false

  // Clear old imported modules relationships (will rebuild)
  for (let imported of importerNode.importedModules) {
    imported.importers.delete(importerNode)
  }
  importerNode.importedModules.clear()

  for (let { specifier, start, end } of importInfos) {
    // Skip external imports (user-configured externals)
    if (isExternalSpecifier(specifier, externalPatterns)) {
      continue
    }

    let cacheKey = `${specifier}\0${importerDir}`
    let resolved = caches.resolution.get(cacheKey)

    if (resolved && resolved !== specifier) {
      // Build module graph edge: importer -> imported
      // resolved is the URL, we need to find or create the imported module node
      // We don't know the file path yet (would need another lookup), but we can
      // create a node with the URL and let it be populated when that file is requested
      let importedNode = getModuleByUrl(caches.moduleGraph, resolved)
      if (!importedNode) {
        // Create a placeholder node - file will be set when the module is actually requested
        importedNode = ensureModuleNode(caches.moduleGraph, resolved, '')
      }

      // Add cache-busting timestamp query param if module has changed
      let finalUrl = resolved
      if (importedNode.changeTimestamp) {
        let separator = resolved.includes('?') ? '&' : '?'
        finalUrl = `${resolved}${separator}t=${importedNode.changeTimestamp}`
      }

      magicString.overwrite(start, end, finalUrl)
      hasChanges = true

      // Add bidirectional relationship
      importerNode.importedModules.add(importedNode)
      importedNode.importers.add(importerNode)
    }
  }

  if (!hasChanges) {
    return { code: source, map: esbuildMap }
  }

  // Generate the rewritten code and source map
  let rewrittenCode = magicString.toString()
  let rewriteMap = magicString.generateMap({
    source: sourceUrl,
    includeContent: true,
    hires: true,
  })

  // Combine esbuild's source map with our rewrite source map
  let combinedMap = combineSourceMaps(esbuildMap, JSON.stringify(rewriteMap))

  return { code: rewrittenCode, map: combinedMap }
}

// Combine two source maps (esbuild transform → import rewrite)
function combineSourceMaps(map1Json: string, map2Json: string): string {
  // Parse both maps
  let map1 = JSON.parse(map1Json)
  let map2 = JSON.parse(map2Json)

  // For simple cases where import rewriting only changes string contents
  // (not line/column structure), we can use the esbuild map directly
  // since the positions are preserved

  // MagicString's map maps from rewritten → esbuild output
  // esbuild's map maps from esbuild output → original source
  // We need: rewritten → original source

  // Use a simple remapping approach: for each mapping in map2,
  // look up the corresponding position in map1

  // For now, use a simplified approach that works for most cases:
  // Since import rewrites don't change line structure, use esbuild's map
  // with updated mappings field from magic-string where positions shifted

  // Actually, for import rewrites that only change specifier strings,
  // the line/column structure is preserved, so we can merge more simply

  // Use esbuild's map as the base, which has correct original source info
  // The rewrite map's main contribution is handling shifted columns within lines

  // For robustness, we'll use esbuild's map directly since:
  // 1. Import specifier changes don't affect line numbers
  // 2. Column shifts within the import statement are minor
  // 3. Most debugging happens on statement boundaries, not within specifiers

  // A full solution would use a library like @ampproject/remapping, but
  // for our use case, esbuild's map provides good enough source positions
  return map1Json
}

// Batch resolve ALL specifiers (relative + bare) in a single esbuild call.
// This ensures dev/prod parity since esbuild resolves everything in production.
async function batchResolveSpecifiers(
  specifiers: string[],
  importerDir: string,
  root: string,
  workspaceRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
  externalPatterns: (string | RegExp)[],
): Promise<void> {
  if (specifiers.length === 0) return

  try {
    // Generate a file that imports all specifiers
    // Each specifier gets its own line so we can track which resolved to what
    let stdinContents = specifiers
      .map((s, i) => `export * as _${i} from ${JSON.stringify(s)}`)
      .join('\n')

    let result = await esbuild.build({
      stdin: {
        contents: stdinContents,
        resolveDir: importerDir,
        loader: 'js',
      },
      write: false,
      bundle: true,
      metafile: true,
      platform: 'browser',
      format: 'esm',
      logLevel: 'silent',
      plugins: [
        {
          name: 'empty-loader',
          setup(build) {
            build.onLoad({ filter: /.*/ }, () => ({ contents: '', loader: 'js' }))
          },
        },
      ],
    })

    let inputs = result.metafile?.inputs ?? {}
    let stdinInputs = inputs['<stdin>']
    if (!stdinInputs?.imports) return

    // Process each resolved import
    for (let i = 0; i < stdinInputs.imports.length; i++) {
      let imp = stdinInputs.imports[i]
      let specifier = specifiers[i]
      if (!specifier || !imp.path) continue

      let absolutePath = path.resolve(imp.path)
      let cacheKey = `${specifier}\0${importerDir}`

      // Determine the output URL based on resolved path location
      let resolvedUrl = resolvedPathToUrl(
        absolutePath,
        root,
        workspaceRoot,
        allowPatterns,
        denyPatterns,
      )
      caches.resolution.set(cacheKey, resolvedUrl)
    }
  } catch {
    // On error, cache original specifiers so we don't retry
    for (let specifier of specifiers) {
      let cacheKey = `${specifier}\0${importerDir}`
      caches.resolution.set(cacheKey, specifier)
    }
  }
}

// Convert a resolved absolute path to a browser-compatible URL
function resolvedPathToUrl(
  absolutePath: string,
  root: string,
  workspaceRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
): string {
  // Resolve symlinks and normalize paths for comparison
  // This handles cases like macOS where /var -> /private/var
  let realPath: string
  let realRoot: string
  let realWorkspaceRoot: string | null
  try {
    realPath = fs.realpathSync(absolutePath)
    realRoot = fs.realpathSync(root)
    realWorkspaceRoot = workspaceRoot ? fs.realpathSync(workspaceRoot) : null
  } catch {
    // If realpath fails (file doesn't exist yet), use normalized paths
    realPath = path.normalize(absolutePath)
    realRoot = path.normalize(root)
    realWorkspaceRoot = workspaceRoot ? path.normalize(workspaceRoot) : null
  }

  // If the file is inside the app root, return a root-relative URL
  if (realPath.startsWith(realRoot + path.sep)) {
    let relativePath = path.relative(realRoot, realPath)
    return '/' + toPosixPath(relativePath)
  }

  // If workspace is configured and the file is inside the workspace root, return a /__@workspace/ URL
  if (realWorkspaceRoot && realPath.startsWith(realWorkspaceRoot + path.sep)) {
    let relativePath = path.relative(realWorkspaceRoot, realPath)
    let posixPath = toPosixPath(relativePath)

    // Check if this path would be allowed to be served
    // If not, return the absolute path (will 403 when requested)
    if (!isPathAllowed(posixPath, allowPatterns, denyPatterns)) {
      if (DEBUG) {
        console.log(`[dev-assets-middleware] path not allowed: ${posixPath}`)
      }
      return absolutePath
    }

    return '/__@workspace/' + posixPath
  }

  // File is outside workspace root (or workspace not configured) - return as-is (will likely 404)
  return absolutePath
}
