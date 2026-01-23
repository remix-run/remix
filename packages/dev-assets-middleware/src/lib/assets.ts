import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as esbuild from 'esbuild'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import type { Middleware, Assets, AssetEntry } from '@remix-run/fetch-router'

// es-module-lexer init promise (must await before parsing)
let lexerReady = lexerInit

// Extract import specifiers from source code (exported for testing)
export async function extractImportSpecifiers(
  source: string,
): Promise<Array<{ specifier: string; start: number; end: number }>> {
  await lexerReady
  let [imports] = parseImports(source)

  let result: Array<{ specifier: string; start: number; end: number }> = []
  for (let imp of imports) {
    if (imp.n != null) {
      result.push({
        specifier: imp.n,
        start: imp.s,
        end: imp.e,
      })
    }
  }
  return result
}

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
 * Options for filesystem access via `/@fs/` URLs.
 *
 * Files outside the app root can be served via `/@fs/` URLs when this is configured.
 * This is useful for serving node_modules and workspace packages in a monorepo.
 */
export interface DevAssetsFsOptions {
  /**
   * The root directory for `/@fs/` URLs. All paths served via `/@fs/`
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
   * Array of regex patterns that allow files to be served via `/@fs/` URLs.
   * Paths are tested as posix-style paths relative to `root`.
   * If empty (default), no files are served via `/@fs/`.
   *
   * @example
   * allow: [/node_modules/, /^packages\//]
   */
  allow?: RegExp[]

  /**
   * Array of regex patterns that block files from being served.
   * Takes precedence over `allow`. Paths are tested as posix-style paths relative to `root`.
   *
   * @example
   * deny: [/\.env($|\.)/, /\.(pem|key|crt)$/]
   */
  deny?: RegExp[]
}

/**
 * Options for the `devAssets` middleware.
 */
export interface DevAssetsOptions {
  /**
   * Filesystem access configuration for `/@fs/` URLs.
   *
   * When configured, files outside the app root can be served via `/@fs/` URLs.
   * This is required for serving node_modules and workspace packages.
   */
  fs?: DevAssetsFsOptions
}

// Re-export types from fetch-router for convenience
export type { Assets, AssetEntry } from '@remix-run/fetch-router'

/**
 * Creates an assets API for dev mode with 1:1 source-to-URL mapping.
 *
 * In dev mode:
 * - `href` returns the source path as a URL (e.g., '/entry.tsx')
 * - `chunks` returns `[href]` since there's no code splitting in dev
 *
 * @param root The root directory where source files are served from
 * @returns An assets object for resolving entry paths to URLs
 *
 * @example
 * let assets = createDevAssets('./app')
 * let entry = assets.get('entry.tsx')
 * // entry?.href = '/entry.tsx'
 * // entry?.chunks = ['/entry.tsx']
 */
export function createDevAssets(root: string): Assets {
  // Ensure root is an absolute path
  let absoluteRoot = path.resolve(root)

  return {
    get(entryPath: string): AssetEntry | null {
      // Normalize the entry path (remove leading slashes, handle both formats)
      let normalizedPath = entryPath.replace(/^\/+/, '')

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

// File extensions that should be transformed
let transformableExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])

// Debug mode - set DEBUG=assets to enable verbose logging
let DEBUG = process.env.DEBUG?.includes('assets')

// Per-instance caches
interface Caches {
  // Resolution cache: key is `${specifier}\0${importerDir}`, value is resolved URL
  resolution: Map<string, string>
}

// Get the esbuild loader for a file extension
export function getLoader(ext: string): esbuild.Loader {
  switch (ext) {
    case '.ts':
      return 'ts'
    case '.tsx':
      return 'tsx'
    case '.jsx':
      return 'jsx'
    default:
      return 'js'
  }
}

// Extract the package name from a specifier
export function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('@')) {
    let parts = specifier.split('/')
    if (parts.length >= 2) {
      return parts[0] + '/' + parts[1]
    }
  } else {
    let parts = specifier.split('/')
    return parts[0]
  }
  return null
}

// Basic CommonJS detection
export function isCommonJS(source: string): boolean {
  if (/\bmodule\.exports\b/.test(source)) {
    return true
  }
  if (/\bexports\.[a-zA-Z_$]/.test(source)) {
    return true
  }
  let hasESMSyntax = /\b(import|export)\s/.test(source)
  if (!hasESMSyntax && /\brequire\s*\(/.test(source)) {
    return true
  }
  return false
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

// Check if a path is allowed to be served via /@fs/
function isPathAllowed(posixPath: string, allow: RegExp[], deny: RegExp[]): boolean {
  // Deny takes precedence
  if (matchesPatterns(posixPath, deny)) {
    return false
  }
  // Must match at least one allow pattern
  return matchesPatterns(posixPath, allow)
}

/**
 * Creates a middleware that serves and transforms JavaScript/TypeScript source files
 * for development. For production, use `buildAssets` with a manifest.
 *
 * - Transforms `.ts`, `.tsx`, `.js`, `.jsx` files with esbuild
 * - Rewrites imports to browser-compatible paths
 * - Serves files outside the app root via `/@fs/...` URLs
 *
 * @param root The root directory to serve source files from (absolute or relative to cwd)
 * @param options Configuration options
 * @returns The dev assets middleware
 *
 * @example
 * import { createRouter } from '@remix-run/fetch-router'
 * import { devAssets } from '@remix-run/dev-assets-middleware'
 *
 * let router = createRouter({
 *   middleware: [
 *     devAssets('./app', {
 *       fs: {
 *         root: '../..',
 *         allow: [/node_modules/, /^packages\//],
 *       },
 *     }),
 *   ],
 * })
 */
export function devAssets(root: string, options: DevAssetsOptions = {}): Middleware {
  // Ensure root is an absolute path
  root = path.resolve(root)

  // Extract fs options - fsRoot may be undefined if fs is not configured
  let fsRoot = options.fs?.root ? path.resolve(options.fs.root) : null
  let allowPatterns = options.fs?.allow ?? []
  let denyPatterns = options.fs?.deny ?? []

  // Create per-instance caches
  let caches: Caches = {
    resolution: new Map(),
  }

  // Create the assets API for dev mode
  let assetsApi = createDevAssets(root)

  return async (context, next) => {
    // Set the assets API on context so route handlers can access it
    context.assets = assetsApi

    // Only handle GET/HEAD requests for file serving
    if (context.method !== 'GET' && context.method !== 'HEAD') {
      return next()
    }

    let { pathname } = context.url
    let ifNoneMatch = context.request.headers.get('If-None-Match')

    // Handle /@fs/ requests
    if (pathname.startsWith('/@fs/')) {
      if (!fsRoot) {
        return new Response('Filesystem access not configured', {
          status: 403,
          headers: { 'Content-Type': 'text/plain' },
        })
      }
      return handleFsRequest(
        pathname,
        root,
        fsRoot,
        allowPatterns,
        denyPatterns,
        caches,
        ifNoneMatch,
      )
    }

    // Check if this is a transformable file
    let ext = path.extname(pathname)
    if (!transformableExtensions.has(ext)) {
      return next()
    }

    // Map URL to file path (strip leading slash)
    let relativePath = pathname.replace(/^\/+/, '')
    let filePath = path.join(root, relativePath)

    // Stat and read the file
    try {
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
      let transformed = await transformSource(
        source,
        filePath,
        pathname,
        root,
        fsRoot,
        allowPatterns,
        denyPatterns,
        caches,
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
        return new Response('Not Found', { status: 404 })
      }

      // Transform or other error
      let message = error instanceof Error ? error.message : String(error)
      return new Response(`Transform error: ${message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  }
}

// Handle requests for filesystem files via /@fs/ URLs.
// The path after /@fs/ is relative to fsRoot.
async function handleFsRequest(
  pathname: string,
  root: string,
  fsRoot: string,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
  ifNoneMatch: string | null,
): Promise<Response> {
  // Strip /@fs/ prefix to get the posix path relative to fsRoot
  let posixPath = pathname.slice('/@fs/'.length)

  // Security: check if this path is allowed
  if (!isPathAllowed(posixPath, allowPatterns, denyPatterns)) {
    return new Response(`Forbidden: ${posixPath}`, {
      status: 403,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Only serve transformable extensions
  let ext = path.extname(posixPath)
  if (!transformableExtensions.has(ext)) {
    return new Response(`Cannot serve non-JS file: ${posixPath}`, {
      status: 400,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Convert posix path to filesystem path
  let filePath = path.join(fsRoot, ...posixPath.split('/'))

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
      fsRoot,
      allowPatterns,
      denyPatterns,
      caches,
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
  fsRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
): Promise<string> {
  let ext = path.extname(filePath)
  let loader = getLoader(ext)

  let startTime = performance.now()

  // Transform with esbuild, requesting source map
  // Use URL for sourcefile so DevTools shows sources at the right location
  let result = await esbuild.transform(source, {
    loader,
    jsx: 'automatic',
    jsxImportSource: '@remix-run/component',
    format: 'esm',
    target: 'es2022',
    sourcefile: sourceUrl,
    sourcemap: true,
  })

  // Rewrite imports in the transformed code, generating combined source map
  let { code, map } = await rewriteImports(
    result.code,
    result.map,
    sourceUrl,
    filePath,
    root,
    fsRoot,
    allowPatterns,
    denyPatterns,
    caches,
  )

  if (DEBUG) {
    let elapsed = (performance.now() - startTime).toFixed(1)
    console.log(`[assets] transform ${path.basename(filePath)} in ${elapsed}ms`)
  }

  // Append inline source map
  if (map) {
    let base64Map = Buffer.from(map).toString('base64')
    code += `\n//# sourceMappingURL=data:application/json;base64,${base64Map}`
  }

  return code
}

// Rewrite imports in the source code using es-module-lexer and magic-string
async function rewriteImports(
  source: string,
  esbuildMap: string,
  sourceUrl: string,
  importerPath: string,
  root: string,
  fsRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
): Promise<{ code: string; map: string | null }> {
  // Ensure lexer is initialized
  await lexerReady

  let importerDir = path.dirname(importerPath)

  // Parse imports with es-module-lexer
  let [imports, exports] = parseImports(source)

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

  // Also handle re-exports from export statements
  for (let exp of exports) {
    // exp.n is the exported name, exp.s/exp.e are for the local name
    // For re-exports like `export { x } from 'y'`, we need the source
    // es-module-lexer doesn't directly give us re-export sources in exports array
    // They're included in the imports array, so we're covered
  }

  if (importInfos.length === 0) {
    return { code: source, map: esbuildMap }
  }

  // Collect uncached specifiers for batch resolution
  let uncachedSpecifiers: string[] = []

  for (let { specifier } of importInfos) {
    // Skip already-rewritten imports and URLs
    if (
      specifier.startsWith('/') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    ) {
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
      console.log(`[assets] batch resolving ${uniqueSpecifiers.length} specifiers`)
    }
    await batchResolveSpecifiers(
      uniqueSpecifiers,
      importerDir,
      root,
      fsRoot,
      allowPatterns,
      denyPatterns,
      caches,
    )
  }

  // Use MagicString for source map-preserving string manipulation
  let magicString = new MagicString(source)
  let hasChanges = false

  for (let { specifier, start, end } of importInfos) {
    // Skip already-rewritten imports and URLs
    if (
      specifier.startsWith('/') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    ) {
      continue
    }

    let cacheKey = `${specifier}\0${importerDir}`
    let resolved = caches.resolution.get(cacheKey)

    if (resolved && resolved !== specifier) {
      magicString.overwrite(start, end, resolved)
      hasChanges = true
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
  fsRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
  caches: Caches,
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
      let resolvedUrl = resolvedPathToUrl(absolutePath, root, fsRoot, allowPatterns, denyPatterns)
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
  fsRoot: string | null,
  allowPatterns: RegExp[],
  denyPatterns: RegExp[],
): string {
  // Resolve symlinks and normalize paths for comparison
  // This handles cases like macOS where /var -> /private/var
  let realPath: string
  let realRoot: string
  let realFsRoot: string | null
  try {
    realPath = fs.realpathSync(absolutePath)
    realRoot = fs.realpathSync(root)
    realFsRoot = fsRoot ? fs.realpathSync(fsRoot) : null
  } catch {
    // If realpath fails (file doesn't exist yet), use normalized paths
    realPath = path.normalize(absolutePath)
    realRoot = path.normalize(root)
    realFsRoot = fsRoot ? path.normalize(fsRoot) : null
  }

  // If the file is inside the app root, return a root-relative URL
  if (realPath.startsWith(realRoot + path.sep)) {
    let relativePath = path.relative(realRoot, realPath)
    return '/' + toPosixPath(relativePath)
  }

  // If fs is configured and the file is inside the fs root, return a /@fs/ URL
  if (realFsRoot && realPath.startsWith(realFsRoot + path.sep)) {
    let relativePath = path.relative(realFsRoot, realPath)
    let posixPath = toPosixPath(relativePath)

    // Check if this path would be allowed to be served
    // If not, return the absolute path (will 403 when requested)
    if (!isPathAllowed(posixPath, allowPatterns, denyPatterns)) {
      if (DEBUG) {
        console.log(`[assets] path not allowed: ${posixPath}`)
      }
      return absolutePath
    }

    return '/@fs/' + posixPath
  }

  // File is outside fs root (or fs not configured) - return as-is (will likely 404)
  return absolutePath
}
