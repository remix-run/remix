import { relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AssetResolver, FilesConfig } from './files.ts'
import type { AssetsManifest } from './manifest-types.ts'

export interface CreateAssetResolverOptions {
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
 * Creates an asset resolver from a compatible build manifest.
 *
 * - `href` returns the output file URL (with baseUrl prefix when provided)
 * - `preloads` includes all transitive static imports for modulepreload
 * - Dynamic imports are excluded from preloads (they load on-demand)
 *
 * @param manifest A compatible assets manifest
 * @param options Optional baseUrl for locally-scoped manifests
 * @returns A resolver function for resolving entry paths to URLs
 */
export function createAssetResolver<files extends FilesConfig = FilesConfig>(
  manifest: AssetsManifest,
  options?: CreateAssetResolverOptions,
): AssetResolver<files> {
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

  let overlappingPaths = Object.keys(fileOutputs).filter((sourcePath) =>
    entryToOutput.has(sourcePath),
  )
  if (overlappingPaths.length > 0) {
    console.warn(
      `[assets] ${overlappingPaths.length} source path(s) are configured as both file and script entries. ` +
        `File entries take precedence: ${overlappingPaths.slice(0, 5).join(', ')}`,
    )
  }

  // Cache for resolved preloads (entryPath -> preloads array)
  let preloadsCache = new Map<string, string[]>()

  return (entryPath: string, variant?: string) => {
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
        return { href, preloads: [] }
      }

      let selectedVariant = variant ?? fileOutput.defaultVariant
      if (!selectedVariant) return null
      let selectedOutput = fileOutput.variants[selectedVariant]
      if (!selectedOutput) return null
      let href = outputPathToHref(selectedOutput.path, baseUrl)
      return { href, preloads: [] }
    }

    if (variant) return null

    // Look up the output file for this entry point
    let outputPath = entryToOutput.get(normalizedPath)
    if (!outputPath) {
      return null
    }

    let href = outputPathToHref(outputPath, baseUrl)

    // Get all preloads (cached)
    let preloads = preloadsCache.get(normalizedPath)
    if (!preloads) {
      preloads = collectTransitivePreloads(outputPath, outputToImports, baseUrl)
      preloadsCache.set(normalizedPath, preloads)
    }

    return { href, preloads }
  }
}

// Collect all transitive static imports for an output file.
// Returns URLs for all preloads (with baseUrl prefix when provided).
function collectTransitivePreloads(
  outputPath: string,
  outputToImports: Map<string, string[]>,
  baseUrl: string | undefined,
): string[] {
  let visited = new Set<string>()
  let preloads: string[] = []

  function visit(path: string) {
    if (visited.has(path)) return
    visited.add(path)
    preloads.push(outputPathToHref(path, baseUrl))
    let imports = outputToImports.get(path)
    if (imports) {
      for (let importedPath of imports) {
        visit(importedPath)
      }
    }
  }

  visit(outputPath)
  return preloads
}
