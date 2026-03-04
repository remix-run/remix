import * as path from 'node:path'
import * as fsp from 'node:fs/promises'
import * as esbuild from 'esbuild'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import { hashContent } from './hash.ts'
import { isCommonJS } from './cjs-check.ts'
import { absolutePathToUrlSegment } from './path-utils.ts'

let lexerReady = lexerInit

export interface ModuleCompileResult {
  compiledCode: string
  // Hash of the source file content (used in `?v=` URLs for immutable caching).
  // Stable across server restarts for the same source content.
  hash: string
  sourceStamp: string
  sourcemap: string | null
  // Absolute paths of direct dependencies (for preload traversal)
  deps: string[]
}

export interface ModuleGraphOptions {
  base: string
  root: string
  workspaceRoot: string | null
  external: string[]
  sourceMaps: boolean
}

// Maps absolute file path → cached compile result.
export type ModuleGraphStore = Map<string, ModuleCompileResult>

export function createModuleGraphStore(): ModuleGraphStore {
  return new Map()
}

// Compile a single module: transpile it with esbuild, resolve imports to URL paths
// (embedding source-content hashes for immutable caching), and cache the result.
//
// The hash is computed from the SOURCE CONTENT of the file (not compiled output).
// This allows the server to serve any module at `?v=hash` without needing to compile
// transitive deps upfront — each dep is compiled lazily when it is actually requested.
export async function buildModule(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
  // Tracks in-progress builds to deduplicate concurrent requests for the same file
  inFlight: Map<string, Promise<ModuleCompileResult>>,
): Promise<ModuleCompileResult> {
  let existing = inFlight.get(absolutePath)
  if (existing) return existing

  let promise = _buildModule(absolutePath, store, opts)
  inFlight.set(absolutePath, promise)
  try {
    let result = await promise
    return result
  } finally {
    inFlight.delete(absolutePath)
  }
}

async function _buildModule(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): Promise<ModuleCompileResult> {
  let stat = await fsp.stat(absolutePath)
  let sourceStamp = `${stat.size}:${stat.mtimeMs}`

  // Check in-memory cache first (fast path)
  let cached = store.get(absolutePath)
  if (cached && cached.sourceStamp === sourceStamp) {
    return cached
  }

  let sourceText = await fsp.readFile(absolutePath, 'utf-8')

  if (isCommonJS(sourceText)) {
    throw new CjsModuleError(absolutePath)
  }

  // Hash the source content — this is the stable `?v=` token for this file.
  let hash = await hashContent(sourceText)

  // Compile with esbuild (no bundling — just transpile TSX/TS to JS)
  let esbuildResult = await esbuild.build({
    entryPoints: [absolutePath],
    bundle: false,
    write: false,
    format: 'esm',
    sourcemap: opts.sourceMaps ? 'external' : false,
    logLevel: 'silent',
  })

  let outputFile = esbuildResult.outputFiles?.[0]
  if (!outputFile) throw new Error(`esbuild produced no output for ${absolutePath}`)
  // Strip esbuild's sourceMappingURL — we re-add the correct URL at serve time
  let compiledCode = outputFile.text.replace(/^\/\/# sourceMappingURL=.+$/m, '').trimEnd()
  let sourcemapFile = opts.sourceMaps ? esbuildResult.outputFiles?.[1] : undefined
  let rawSourcemap = sourcemapFile ? sourcemapFile.text : null

  // Extract import specifiers from the compiled output
  await lexerReady
  let [imports] = parseImports(compiledCode)

  let specifiers: Array<{ specifier: string; start: number; end: number }> = []
  for (let imp of imports) {
    if (imp.n != null) {
      specifiers.push({ specifier: imp.n, start: imp.s, end: imp.e })
    }
  }

  // Filter to only specifiers we need to resolve
  let toResolve = specifiers.filter(({ specifier }) => {
    if (opts.external.includes(specifier)) return false
    if (specifier.startsWith('data:')) return false
    if (specifier.startsWith('http://') || specifier.startsWith('https://')) return false
    return true
  })

  // Batch-resolve all specifiers in a single esbuild call (no per-import processes)
  let importerDir = path.dirname(absolutePath)
  let resolvedPaths =
    toResolve.length > 0
      ? await batchResolveSpecifiers(
          toResolve.map((s) => s.specifier),
          importerDir,
        )
      : new Map<string, string>()

  // Compute source hashes for each dep (fast — just hash the file content).
  // We do NOT compile deps here; they are compiled lazily on first request.
  let depHashes = new Map<string, string>()
  let deps: string[] = []

  await Promise.all(
    toResolve
      .filter(({ specifier }) => resolvedPaths.has(specifier))
      .map(async ({ specifier }) => {
        let depPath = resolvedPaths.get(specifier)!
        deps.push(depPath)
        // Use cached hash if available and source hasn't changed
        let depCached = store.get(depPath)
        if (depCached) {
          let depStat = await fsp.stat(depPath).catch(() => null)
          let depStamp = depStat ? `${depStat.size}:${depStat.mtimeMs}` : null
          if (depStamp && depCached.sourceStamp === depStamp) {
            depHashes.set(specifier, depCached.hash)
            return
          }
        }
        // Read and hash source file content
        try {
          let depSource = await fsp.readFile(depPath, 'utf-8')
          depHashes.set(specifier, await hashContent(depSource))
        } catch {
          // If we can't read the dep, skip rewriting its import
        }
      }),
  )

  // Rewrite imports to URL paths with source-content hashes
  let magicString = new MagicString(compiledCode)
  for (let { specifier, start, end } of toResolve) {
    let depPath = resolvedPaths.get(specifier)
    if (!depPath) continue
    let depHash = depHashes.get(specifier)
    if (!depHash) continue

    let urlSegment = absolutePathToUrlSegment(depPath, opts.root, opts.workspaceRoot)
    if (!urlSegment) continue

    let urlPath =
      urlSegment.namespace === 'workspace'
        ? `${opts.base}/__@workspace/${urlSegment.segment}?v=${depHash}`
        : `${opts.base}/${urlSegment.segment}?v=${depHash}`

    if (specifier !== urlPath) {
      magicString.overwrite(start, end, urlPath)
    }
  }

  let rewrittenCode = magicString.toString()

  // Update sourcemap sources to use absolute path for browser devtools
  let finalSourcemap: string | null = null
  if (opts.sourceMaps && rawSourcemap) {
    try {
      let sm = JSON.parse(rawSourcemap)
      sm.sources = [absolutePath]
      finalSourcemap = JSON.stringify(sm)
    } catch {
      finalSourcemap = rawSourcemap
    }
  }

  let result: ModuleCompileResult = {
    compiledCode: rewrittenCode,
    hash,
    sourceStamp,
    sourcemap: finalSourcemap,
    deps,
  }

  store.set(absolutePath, result)
  return result
}

// Collect all transitive dependencies of a module in BFS order (shallowest first).
// Returns array of [absolutePath, ModuleCompileResult] pairs.
// Note: this only includes modules that have been compiled (are in `store`).
// For preloads, we need to build all transitive deps first.
export function collectTransitiveDeps(
  absolutePath: string,
  store: ModuleGraphStore,
): Array<[string, ModuleCompileResult]> {
  let visited = new Set<string>()
  let result: Array<[string, ModuleCompileResult]> = []
  let queue = [absolutePath]

  while (queue.length > 0) {
    let current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    let node = store.get(current)
    if (!node) continue

    result.push([current, node])
    for (let dep of node.deps) {
      if (!visited.has(dep)) {
        queue.push(dep)
      }
    }
  }

  return result
}

// Build the full transitive module graph starting from a given entry point.
// Used by preloads() to ensure all deps are compiled before generating preload URLs.
// The `visited` set prevents infinite recursion when circular imports exist.
export async function buildModuleGraph(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
  inFlight: Map<string, Promise<ModuleCompileResult>>,
  visited: Set<string> = new Set(),
): Promise<void> {
  if (visited.has(absolutePath)) return
  visited.add(absolutePath)
  let result = await buildModule(absolutePath, store, opts, inFlight)
  // Recursively build all deps (in parallel)
  await Promise.all(
    result.deps.map((depPath) => buildModuleGraph(depPath, store, opts, inFlight, visited)),
  )
}

export class CjsModuleError extends Error {
  absolutePath: string

  constructor(absolutePath: string) {
    super(
      `CommonJS module detected: ${absolutePath}\n\n` +
        `This package uses CommonJS (require/module.exports) which is not supported.\n` +
        `Please use an ESM-compatible package.`,
    )
    this.name = 'CjsModuleError'
    this.absolutePath = absolutePath
  }
}

// Batch-resolve multiple import specifiers from the same importer directory
// using a single esbuild build invocation. Returns a map from specifier → absolute path.
async function batchResolveSpecifiers(
  specifiers: string[],
  importerDir: string,
): Promise<Map<string, string>> {
  let result = new Map<string, string>()
  if (specifiers.length === 0) return result

  try {
    let resolved = await resolveWithEsbuild(specifiers, importerDir)
    for (let { specifier, absolutePath } of resolved) {
      if (absolutePath) result.set(specifier, absolutePath)
    }
  } catch {
    // Resolution failed — return empty map, imports will be left unrewritten
  }

  return result
}

interface ResolvedSpec {
  specifier: string
  absolutePath: string | null
}

async function resolveWithEsbuild(
  specifiers: string[],
  importerDir: string,
): Promise<ResolvedSpec[]> {
  let resolved: ResolvedSpec[] = []

  await esbuild.build({
    stdin: { contents: '', loader: 'js', resolveDir: importerDir },
    write: false,
    bundle: true,
    platform: 'browser',
    format: 'esm',
    logLevel: 'silent',
    plugins: [
      {
        name: 'batch-resolver',
        setup(build) {
          build.onStart(async () => {
            // Resolve all specifiers in parallel within the single build
            let results = await Promise.all(
              specifiers.map((specifier) =>
                build.resolve(specifier, {
                  resolveDir: importerDir,
                  kind: 'import-statement',
                }),
              ),
            )
            for (let i = 0; i < specifiers.length; i++) {
              let r = results[i]
              let absolutePath =
                r && !r.external && r.path && path.isAbsolute(r.path) ? r.path : null
              resolved.push({ specifier: specifiers[i], absolutePath })
            }
          })
          // Mark everything external to avoid actual bundling
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.importer) return { external: true }
            return undefined
          })
        },
      },
    ],
  })

  return resolved
}
