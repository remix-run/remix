import { relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Middleware, Assets, AssetEntry } from '@remix-run/fetch-router'

/**
 * A subset of esbuild's metafile format containing only the information needed
 * for asset resolution. This is compatible with the full esbuild metafile, so
 * you can pass the metafile directly without transformation.
 */
export interface AssetManifest {
  outputs: {
    [outputPath: string]: {
      /**
       * The original entry point path (e.g., 'app/entry.tsx').
       * Only present for entry point outputs.
       */
      entryPoint?: string
      /**
       * Imports from this output file.
       */
      imports?: Array<{
        /** The path to the imported file */
        path: string
        /** The kind of import (e.g., 'import-statement', 'dynamic-import') */
        kind: string
      }>
    }
  }
}

// Re-export types from fetch-router for convenience
export type { Assets, AssetEntry } from '@remix-run/fetch-router'

/**
 * Creates an assets API from an esbuild metafile.
 *
 * - `href` returns the hashed output file path (e.g., '/entry-ABC123.js')
 * - `chunks` includes all transitive static imports for modulepreload
 * - Dynamic imports are excluded from chunks (they load on-demand)
 *
 * @param manifest An esbuild metafile or compatible AssetManifest
 * @returns An assets object for resolving entry paths to URLs
 */
function createAssets(manifest: AssetManifest): Assets {
  // Build lookup tables from the manifest
  let entryToOutput = new Map<string, string>()
  let outputToImports = new Map<string, string[]>()

  for (let [outputPath, output] of Object.entries(manifest.outputs)) {
    // Map entry points to their output files
    if (output.entryPoint) {
      entryToOutput.set(output.entryPoint, outputPath)
    }

    // Collect static imports (excluding dynamic imports)
    let staticImports: string[] = []
    if (output.imports) {
      for (let imp of output.imports) {
        // Only include static imports (import-statement, require-call, etc.)
        // Exclude dynamic-import since those load on-demand
        if (imp.kind !== 'dynamic-import') {
          staticImports.push(imp.path)
        }
      }
    }
    outputToImports.set(outputPath, staticImports)
  }

  // Cache for resolved chunks (entryPath -> chunks array)
  let chunksCache = new Map<string, string[]>()

  return {
    /**
     * Resolves an entry point path to its built asset information.
     *
     * Accepts multiple path formats:
     * - `file://` URLs: `file:///path/to/project/app/entry.tsx`
     * - Absolute paths: `/path/to/project/app/entry.tsx`
     * - Relative paths (to project root): `app/entry.tsx` or `./app/entry.tsx`
     *
     * All formats are normalized to match the entry points in the asset manifest.
     *
     * @param entryPath Entry point path in any supported format
     * @returns Asset information (href and chunks) or null if not found
     */
    get(entryPath: string): AssetEntry | null {
      // Convert file:// URLs to file paths
      let pathToNormalize = entryPath.startsWith('file://') ? fileURLToPath(entryPath) : entryPath

      // Convert absolute paths to relative (from cwd)
      pathToNormalize = isAbsolute(pathToNormalize)
        ? relative(process.cwd(), pathToNormalize)
        : pathToNormalize

      // Normalize the entry path (remove leading ./ or /)
      let normalizedPath = pathToNormalize.replace(/^(\.\/|\/)+/, '')

      // Look up the output file for this entry point
      let outputPath = entryToOutput.get(normalizedPath)
      if (!outputPath) {
        return null
      }

      // Convert output path to URL (ensure leading slash, strip any ./ prefix)
      let href = '/' + outputPath.replace(/^\.?\//, '')

      // Get all chunks (cached)
      let chunks = chunksCache.get(normalizedPath)
      if (!chunks) {
        chunks = collectTransitiveChunks(outputPath, outputToImports)
        chunksCache.set(normalizedPath, chunks)
      }

      return { href, chunks }
    },
  }
}

// Collect all transitive static imports for an output file.
// Returns URLs (with leading slashes) for all chunks.
function collectTransitiveChunks(
  outputPath: string,
  outputToImports: Map<string, string[]>,
): string[] {
  let visited = new Set<string>()
  let chunks: string[] = []

  function visit(path: string) {
    if (visited.has(path)) return
    visited.add(path)

    // Add this chunk to the list (convert to URL)
    let url = '/' + path.replace(/^\.?\//, '')
    chunks.push(url)

    // Recursively visit static imports
    let imports = outputToImports.get(path)
    if (imports) {
      for (let imp of imports) {
        visit(imp)
      }
    }
  }

  visit(outputPath)
  return chunks
}

/**
 * Middleware returned by assets() - standard middleware without dispose
 */
export type AssetsMiddleware = Middleware & { dispose?: never }

/**
 * Creates middleware that provides asset resolution from an esbuild metafile.
 *
 * Makes `context.assets` available to route handlers for resolving entry points
 * to their built output files and chunks.
 *
 * @param manifest An esbuild metafile or compatible AssetManifest
 * @returns Middleware that sets `context.assets`
 *
 * @example
 * import { assets } from '@remix-run/assets-middleware'
 * import { staticFiles } from '@remix-run/static-middleware'
 * import manifest from './build/metafile.json' with { type: 'json' }
 *
 * let router = createRouter({
 *   middleware: [
 *     assets(manifest),
 *     staticFiles('./build'),
 *   ],
 * })
 *
 * router.get('/', ({ assets }) => {
 *   let entry = assets.get('app/entry.tsx')
 *   // entry.href = '/build/entry-ABC123.js'
 *   // entry.chunks = ['/build/entry-ABC123.js', ...]
 * })
 */
export function assets(manifest: AssetManifest): AssetsMiddleware {
  let assetsApi = createAssets(manifest)
  return (context, next) => {
    context.assets = assetsApi
    return next()
  }
}
