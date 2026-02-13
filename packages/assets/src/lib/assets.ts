import { relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AssetsApi, FilesConfig } from './files.ts'
import type { AssetManifest } from './manifest-types.ts'

export interface CreateAssetsOptions {
  /**
   * URL prefix where built assets are served.
   * Use with locally-scoped manifests (output paths relative to outDir).
   * Omit when manifest uses root-relative paths (e.g. 'build/assets/entry.js').
   */
  baseUrl?: string
}

function outputPathToHref(outputPath: string, baseUrl: string | undefined): string {
  let segment = outputPath.replace(/^\.?\//, '')
  if (baseUrl != null && baseUrl !== '') {
    let base = baseUrl.replace(/\/+$/, '')
    return base ? base + '/' + segment : '/' + segment
  }
  return '/' + segment
}

/**
 * Creates an assets API from a compatible build manifest.
 *
 * - `href` returns the output file URL (with baseUrl prefix when provided)
 * - `chunks` includes all transitive static imports for modulepreload
 * - Dynamic imports are excluded from chunks (they load on-demand)
 *
 * @param manifest A compatible assets manifest
 * @param options Optional baseUrl for locally-scoped manifests
 * @returns An assets object for resolving entry paths to URLs
 */
export function createAssets<files extends FilesConfig = FilesConfig>(
  manifest: AssetManifest,
  options?: CreateAssetsOptions,
): AssetsApi<files> {
  let baseUrl = options?.baseUrl
  let scriptOutputs = manifest.scripts.outputs
  let fileOutputs = manifest.files.outputs

  // Build lookup tables from the manifest
  let entryToOutput = new Map<string, string>()
  let outputToImports = new Map<string, string[]>()

  for (let [outputPath, output] of Object.entries(scriptOutputs)) {
    // Map entry points to their output files
    if (output.entryPoint) {
      entryToOutput.set(output.entryPoint, outputPath)
    }

    // Collect static imports (excluding dynamic imports)
    let staticImports: string[] = []
    if (output.imports) {
      for (let importedPath of output.imports) {
        // Only include static imports (import-statement, require-call, etc.)
        // Exclude dynamic-import since those load on-demand
        if (importedPath.kind !== 'dynamic-import') {
          staticImports.push(importedPath.path)
        }
      }
    }
    outputToImports.set(outputPath, staticImports)
  }

  // Cache for resolved chunks (entryPath -> chunks array)
  let chunksCache = new Map<string, string[]>()

  return {
    get(entryPath: string, variant?: string) {
      // Convert file:// URLs to file paths
      let pathToNormalize = entryPath.startsWith('file://') ? fileURLToPath(entryPath) : entryPath

      // Root-relative paths (e.g. /app/entry.tsx) — strip leading slash; don't treat as filesystem absolute
      if (!entryPath.startsWith('file://') && pathToNormalize.startsWith('/')) {
        pathToNormalize = pathToNormalize.replace(/^\/+/, '')
      } else if (isAbsolute(pathToNormalize)) {
        pathToNormalize = relative(process.cwd(), pathToNormalize)
      }

      // Normalize the entry path (remove leading ./)
      let normalizedPath = pathToNormalize.replace(/^(\.\/)+/, '')

      let fileOutput = fileOutputs[normalizedPath]
      if (fileOutput) {
        if ('path' in fileOutput) {
          if (variant) return null
          let href = outputPathToHref(fileOutput.path, baseUrl)
          return { href, chunks: [href] }
        }

        let selectedVariant = variant ?? fileOutput.default
        if (!selectedVariant) return null
        let selectedOutput = fileOutput.variants[selectedVariant]
        if (!selectedOutput) return null
        let href = outputPathToHref(selectedOutput.path, baseUrl)
        return { href, chunks: [href] }
      }

      if (variant) return null

      // Look up the output file for this entry point
      let outputPath = entryToOutput.get(normalizedPath)
      if (!outputPath) {
        return null
      }

      let href = outputPathToHref(outputPath, baseUrl)

      // Get all chunks (cached)
      let chunks = chunksCache.get(normalizedPath)
      if (!chunks) {
        chunks = collectTransitiveChunks(outputPath, outputToImports, baseUrl)
        chunksCache.set(normalizedPath, chunks)
      }

      return { href, chunks }
    },
  }
}

// Collect all transitive static imports for an output file.
// Returns URLs for all chunks (with baseUrl prefix when provided).
function collectTransitiveChunks(
  outputPath: string,
  outputToImports: Map<string, string[]>,
  baseUrl: string | undefined,
): string[] {
  let visited = new Set<string>()
  let chunks: string[] = []

  function visit(path: string) {
    if (visited.has(path)) return
    visited.add(path)
    chunks.push(outputPathToHref(path, baseUrl))
    let imports = outputToImports.get(path)
    if (imports) {
      for (let importedPath of imports) {
        visit(importedPath)
      }
    }
  }

  visit(outputPath)
  return chunks
}
