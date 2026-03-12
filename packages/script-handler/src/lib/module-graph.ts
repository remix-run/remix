import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as esbuild from 'esbuild'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import MagicString from 'magic-string'
import { hashContent } from './hash.ts'
import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'
import { resolveAbsolutePathFromResolvedRoots, type ResolvedScriptRoot } from './path-utils.ts'

let lexerReady = lexerInit

export interface ModuleCompileResult {
  compiledCode: string
  // URL token AND ETag fingerprint.
  // For non-cycle modules: hash of compiled code plus sourcemap mode/content inputs.
  // For cycle modules: shared cycleHash (hash of all cycle sources + external dep hashes
  // + sourcemap mode/content inputs).
  compiledHash: string
  sourceStamp: string
  sourcemap: string | null
  deps: string[]
}

// Pass 1 result: transpiled but not yet URL-rewritten.
interface RawModule {
  absolutePath: string
  rawCode: string
  sourcemap: string | null
  sourceMapHash: string
  sourceStamp: string
  // Original source text, used when computing cycleHash for circular dep groups.
  sourceText: string
  deps: string[]
  imports: Array<{ start: number; end: number; depPath: string; specifier: string }>
}

interface ModuleGraphOptions {
  base: string
  roots: readonly ResolvedScriptRoot[]
  external: string[]
  sourceMaps: 'inline' | 'external' | undefined
  sourceMapSourcePaths: 'virtual' | 'absolute'
  /** Returns true if the given absolute path is a configured entry point */
  isEntryPoint: (absolutePath: string) => boolean
}

export interface ModuleGraphStore {
  raw: Map<string, RawModule>
  rawInFlight: Map<string, Promise<RawModule>>
  compiled: Map<string, ModuleCompileResult>
  publicPaths: Map<string, string | null>
  clear(): void
  get(p: string): ModuleCompileResult | undefined
}

export function createModuleGraphStore(): ModuleGraphStore {
  let raw = new Map<string, RawModule>()
  let rawInFlight = new Map<string, Promise<RawModule>>()
  let compiled = new Map<string, ModuleCompileResult>()
  let publicPaths = new Map<string, string | null>()
  return {
    raw,
    rawInFlight,
    compiled,
    publicPaths,
    clear() {
      raw.clear()
      rawInFlight.clear()
      compiled.clear()
      publicPaths.clear()
    },
    get(p) {
      return compiled.get(p)
    },
  }
}

function joinBasePath(base: string, relativePath: string): string {
  return base === '/' ? `/${relativePath}` : `${base}/${relativePath}`
}

function sourceStampFromStat(stat: { size: number; mtimeMs: number }): string {
  return `${stat.size}:${stat.mtimeMs}`
}

// Pass 1: transpile a single module without URL rewriting.
async function compileRaw(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): Promise<RawModule> {
  let existing = store.rawInFlight.get(absolutePath)
  if (existing) return existing

  let promise = _compileRaw(absolutePath, store, opts)
  store.rawInFlight.set(absolutePath, promise)
  try {
    return await promise
  } finally {
    store.rawInFlight.delete(absolutePath)
  }
}

async function _compileRaw(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): Promise<RawModule> {
  let stat = await fsp.stat(absolutePath)
  let sourceStamp = sourceStampFromStat(stat)

  let cachedRaw = store.raw.get(absolutePath)
  if (cachedRaw?.sourceStamp === sourceStamp) return cachedRaw

  let sourceText = await fsp.readFile(absolutePath, 'utf-8')
  let mayContainCommonJS = mayContainCommonJSModuleGlobals(sourceText)

  let buildResult = await esbuild.build({
    entryPoints: [absolutePath],
    bundle: false,
    write: false,
    outfile: absolutePath,
    // Preserve authored module syntax so we can reject CommonJS before esbuild adapts it.
    sourcemap: opts.sourceMaps ? 'external' : false,
    logLevel: 'silent',
  })

  let outputFile = buildResult.outputFiles.find((file) => !file.path.endsWith('.map'))
  if (!outputFile) throw new Error(`esbuild produced no output for ${absolutePath}`)

  let rawCode = outputFile.text.replace(/^\/\/# sourceMappingURL=.+$/m, '').trimEnd()
  if (mayContainCommonJS && isCommonJS(rawCode))
    throw new Error(getCommonJsModuleErrorMessage(absolutePath))
  let rawSourcemap = opts.sourceMaps
    ? (buildResult.outputFiles.find((file) => file.path.endsWith('.map'))?.text ?? null)
    : null

  await lexerReady
  let [imports] = parseImports(rawCode)

  let toResolve: Array<{ specifier: string; start: number; end: number }> = []
  for (let imp of imports) {
    if (imp.n == null) continue
    let specifier = imp.n
    if (opts.external.includes(specifier)) continue
    if (
      specifier.startsWith('data:') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    )
      continue
    toResolve.push({ specifier, start: imp.s, end: imp.e })
  }

  let importerDir = path.dirname(absolutePath)
  let resolvedPaths =
    toResolve.length > 0
      ? await batchResolveSpecifiers(
          toResolve.map((s) => s.specifier),
          importerDir,
        )
      : new Map<string, string>()

  let rawImports: Array<{ start: number; end: number; depPath: string; specifier: string }> = []
  let depsSet = new Set<string>()

  for (let { specifier, start, end } of toResolve) {
    let depPath = resolvedPaths.get(specifier)
    if (!depPath) {
      throw new Error(getUnresolvedImportErrorMessage(absolutePath, specifier))
    }
    if (resolveAbsolutePathFromResolvedRoots(depPath, opts.roots) == null) {
      throw new Error(getUnconfiguredRootErrorMessage(absolutePath, specifier, depPath))
    }
    rawImports.push({ start, end, depPath, specifier })
    depsSet.add(depPath)
  }

  let finalSourcemap: string | null = null
  if (opts.sourceMaps && rawSourcemap) {
    try {
      let sm = JSON.parse(rawSourcemap)
      sm.sources = [getSourceMapSourcePath(absolutePath, opts)]
      finalSourcemap = JSON.stringify(sm)
    } catch {
      finalSourcemap = rawSourcemap
    }
  }

  let sourceMapHash = finalSourcemap ? await hashContent(finalSourcemap) : ''

  let rawModule: RawModule = {
    absolutePath,
    rawCode,
    sourcemap: finalSourcemap,
    sourceMapHash,
    sourceStamp,
    sourceText,
    deps: [...depsSet],
    imports: rawImports,
  }

  store.raw.set(absolutePath, rawModule)
  return rawModule
}

function getSourceMapSourcePath(absolutePath: string, opts: ModuleGraphOptions): string {
  if (opts.sourceMapSourcePaths === 'absolute') return absolutePath

  let publicPath = resolveAbsolutePathFromResolvedRoots(absolutePath, opts.roots)?.publicPath
  if (!publicPath) return absolutePath
  return joinBasePath(opts.base, publicPath)
}

function getSourceMapModeSentinel(opts: ModuleGraphOptions): string {
  return opts.sourceMaps === 'inline'
    ? '\0sm:inline'
    : opts.sourceMaps === 'external'
      ? '\0sm:external'
      : ''
}

// Build the full raw dep graph (Pass 1 for all transitive deps).
async function buildRawGraph(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
  visited = new Set<string>(),
): Promise<void> {
  if (visited.has(absolutePath)) return
  visited.add(absolutePath)

  let raw = await compileRaw(absolutePath, store, opts)
  await Promise.all(raw.deps.map((dep) => buildRawGraph(dep, store, opts, visited)))
}

function collectRawTransitiveDeps(
  absolutePath: string,
  store: ModuleGraphStore,
): Array<[string, RawModule]> {
  let visited = new Set<string>()
  let result: Array<[string, RawModule]> = []
  let queue = [absolutePath]

  while (queue.length > 0) {
    let current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    let raw = store.raw.get(current)
    if (!raw) continue

    result.push([current, raw])
    for (let dep of raw.deps) {
      if (!visited.has(dep)) queue.push(dep)
    }
  }

  return result
}

// Tarjan's SCC algorithm. Returns SCCs in topological order: leaf dependencies come
// first, the entry point SCC comes last. This lets us compute hashes bottom-up.
function tarjanSCC(nodes: string[], edges: Map<string, string[]>): string[][] {
  let index = 0
  let stack: string[] = []
  let onStack = new Set<string>()
  let indices = new Map<string, number>()
  let lowlink = new Map<string, number>()
  let sccs: string[][] = []

  function strongconnect(v: string) {
    indices.set(v, index)
    lowlink.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)

    for (let w of edges.get(v) ?? []) {
      if (!indices.has(w)) {
        strongconnect(w)
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!))
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      let scc: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)
      sccs.push(scc)
    }
  }

  for (let v of nodes) {
    if (!indices.has(v)) strongconnect(v)
  }

  return sccs
}

function getPublicPath(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): string | null {
  if (store.publicPaths.has(absolutePath)) {
    return store.publicPaths.get(absolutePath) ?? null
  }

  let publicPath =
    resolveAbsolutePathFromResolvedRoots(absolutePath, opts.roots)?.publicPath ?? null
  store.publicPaths.set(absolutePath, publicPath)
  return publicPath
}

// Pass 2 for a singleton (no cycle): rewrite imports with dep hashes, compute compiledHash.
async function finalizeModule(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): Promise<void> {
  let raw = store.raw.get(absolutePath)!

  let ms = new MagicString(raw.rawCode)

  for (let { start, end, depPath } of raw.imports) {
    let depResult = store.compiled.get(depPath)
    if (!depResult) continue

    let publicPath = getPublicPath(depPath, store, opts)
    if (!publicPath) continue

    // Entry point deps use their stable no-hash URL so the browser's module map
    // deduplicates them correctly against the <script> tag reference in HTML.
    let urlPath = opts.isEntryPoint(depPath)
      ? joinBasePath(opts.base, publicPath)
      : joinBasePath(opts.base, `${publicPath}.@${depResult.compiledHash}`)

    ms.overwrite(start, end, urlPath)
  }

  let compiledCode = ms.toString()
  let smSentinel = getSourceMapModeSentinel(opts)
  let compiledHash = await hashContent(compiledCode + smSentinel + '\0' + raw.sourceMapHash)

  let finalCode = compiledCode
  if (raw.sourcemap) {
    if (opts.sourceMaps === 'inline') {
      let encoded = Buffer.from(raw.sourcemap).toString('base64')
      finalCode = compiledCode + `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
    } else if (opts.sourceMaps === 'external') {
      let publicPath = getPublicPath(absolutePath, store, opts)
      if (publicPath) {
        let tokenSuffix = opts.isEntryPoint(absolutePath) ? '' : `.@${compiledHash}`
        let mapPath = joinBasePath(opts.base, `${publicPath}${tokenSuffix}.map`)
        finalCode = compiledCode + `\n//# sourceMappingURL=${mapPath}`
      }
    }
  }

  store.compiled.set(absolutePath, {
    compiledCode: finalCode,
    compiledHash,
    sourceStamp: raw.sourceStamp,
    sourcemap: raw.sourcemap,
    deps: raw.deps,
  })
}

// Pass 2 for a cycle SCC: all modules share a deterministic cycleHash, computed from
// their source texts + the compiled hashes of their external (non-cycle) dependencies.
// This means: if any cycle source changes OR any external dep changes, cycleHash changes,
// invalidating all URLs for modules in the cycle and all their importers.
async function finalizeCycle(
  scc: string[],
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): Promise<void> {
  let sccSet = new Set(scc)

  // Compute cycleHash from:
  // 1. Sorted source texts of all cycle modules (alphabetical by path for determinism)
  // 2. Sorted compiled hashes of all external deps (already computed in topological order)
  let sortedSources = scc
    .slice()
    .sort()
    .map((p) => store.raw.get(p)!.sourceText)
    .join('\0')

  let externalDepHashes = new Set<string>()
  for (let p of scc) {
    for (let dep of store.raw.get(p)!.deps) {
      if (!sccSet.has(dep)) {
        let depResult = store.compiled.get(dep)
        if (depResult) externalDepHashes.add(depResult.compiledHash)
      }
    }
  }

  let sortedSourceMapHashes = scc
    .slice()
    .sort()
    .map((p) => store.raw.get(p)!.sourceMapHash)
    .join('\0')

  let smSentinel = getSourceMapModeSentinel(opts)
  let cycleHash = await hashContent(
    sortedSources +
      '\0\0' +
      [...externalDepHashes].sort().join('\0') +
      smSentinel +
      '\0\0' +
      sortedSourceMapHashes,
  )

  // Rewrite imports in each cycle module, then store with the shared cycleHash.
  for (let absolutePath of scc) {
    let raw = store.raw.get(absolutePath)!
    let ms = new MagicString(raw.rawCode)

    for (let { start, end, depPath } of raw.imports) {
      let publicPath = getPublicPath(depPath, store, opts)
      if (!publicPath) continue

      let urlPath: string
      if (opts.isEntryPoint(depPath)) {
        urlPath = joinBasePath(opts.base, publicPath)
      } else {
        // Deps within the cycle share the cycleHash; external deps use their own hash.
        let token = sccSet.has(depPath) ? cycleHash : store.compiled.get(depPath)?.compiledHash
        if (!token) continue
        urlPath = joinBasePath(opts.base, `${publicPath}.@${token}`)
      }

      ms.overwrite(start, end, urlPath)
    }

    let compiledCode = ms.toString()

    let finalCode = compiledCode
    if (raw.sourcemap) {
      if (opts.sourceMaps === 'inline') {
        let encoded = Buffer.from(raw.sourcemap).toString('base64')
        finalCode = compiledCode + `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (opts.sourceMaps === 'external') {
        let publicPath = getPublicPath(absolutePath, store, opts)
        if (publicPath) {
          let tokenSuffix = opts.isEntryPoint(absolutePath) ? '' : `.@${cycleHash}`
          let mapPath = joinBasePath(opts.base, `${publicPath}${tokenSuffix}.map`)
          finalCode = compiledCode + `\n//# sourceMappingURL=${mapPath}`
        }
      }
    }

    store.compiled.set(absolutePath, {
      compiledCode: finalCode,
      compiledHash: cycleHash,
      sourceStamp: raw.sourceStamp,
      sourcemap: raw.sourcemap,
      deps: raw.deps,
    })
  }
}

// Two-pass build with SCC-aware content hashing.
// Pass 1 transpiles all transitive deps; Tarjan's SCC detects cycles; Pass 2 assigns
// content-addressed hashes — deterministic regardless of entry point or traversal order.
export async function buildGraph(
  absolutePath: string,
  store: ModuleGraphStore,
  opts: ModuleGraphOptions,
): Promise<ModuleCompileResult> {
  absolutePath = fs.realpathSync(absolutePath)

  // Pass 1: transpile the full transitive closure.
  await buildRawGraph(absolutePath, store, opts)

  // Build the dep graph from raw results.
  let rawDeps = collectRawTransitiveDeps(absolutePath, store)
  let nodes = rawDeps.map(([p]) => p)
  let edges = new Map(rawDeps.map(([p, raw]) => [p, raw.deps]))

  // Find SCCs in topological order (Tarjan's: leaves first, entry point last).
  let sccs = tarjanSCC(nodes, edges)

  // Pass 2: finalize each SCC bottom-up so dep hashes are always available when needed.
  for (let scc of sccs) {
    // A cycle is an SCC with 2+ modules, or a singleton with a self-loop.
    let isCycle = scc.length > 1 || (scc.length === 1 && (edges.get(scc[0]) ?? []).includes(scc[0]))
    if (isCycle) {
      await finalizeCycle(scc, store, opts)
    } else {
      await finalizeModule(scc[0], store, opts)
    }
  }

  return store.compiled.get(absolutePath)!
}

// BFS traversal of compiled results, entry point first.
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

    let node = store.compiled.get(current)
    if (!node) continue

    result.push([current, node])
    for (let dep of node.deps) {
      if (!visited.has(dep)) queue.push(dep)
    }
  }

  return result
}

export async function isCompiledGraphFresh(
  absolutePath: string,
  store: ModuleGraphStore,
): Promise<boolean> {
  let visited = new Set<string>()
  let queue = [absolutePath]

  while (queue.length > 0) {
    let current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    let node = store.compiled.get(current)
    if (!node) return false

    let stat: Awaited<ReturnType<typeof fsp.stat>>
    try {
      stat = await fsp.stat(current)
    } catch {
      return false
    }

    if (sourceStampFromStat(stat) !== node.sourceStamp) {
      return false
    }

    for (let dep of node.deps) {
      if (!visited.has(dep)) queue.push(dep)
    }
  }

  return true
}

function getCommonJsModuleErrorMessage(absolutePath: string): string {
  return (
    `CommonJS module detected: ${absolutePath}\n\n` +
    `This module uses CommonJS (require/module.exports) which is not supported.\n` +
    `Please use an ESM-compatible module.`
  )
}

function getUnconfiguredRootErrorMessage(
  importerPath: string,
  specifier: string,
  absolutePath: string,
): string {
  return (
    `Resolved import "${specifier}" in ${importerPath} points to ${absolutePath}, which is outside all configured roots.\n\n` +
    `Add a matching script-handler root, or mark this import as external.`
  )
}

function getUnresolvedImportErrorMessage(importerPath: string, specifier: string): string {
  return (
    `Failed to resolve import "${specifier}" in ${importerPath}.\n\n` +
    `Ensure it resolves to a file within a configured root, or mark this import as external.`
  )
}

async function batchResolveSpecifiers(
  specifiers: string[],
  importerDir: string,
): Promise<Map<string, string>> {
  let result = new Map<string, string>()
  if (specifiers.length === 0) return result

  let resolved = await resolveWithEsbuild(specifiers, importerDir)
  for (let { specifier, absolutePath } of resolved) {
    if (absolutePath) {
      result.set(specifier, fs.realpathSync(absolutePath))
    }
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
              if (r?.errors.length) {
                throw new Error(getUnresolvedImportErrorMessage(importerDir, specifiers[i]))
              }
              let absolutePath =
                r && !r.external && r.path && path.isAbsolute(r.path) ? r.path : null
              resolved.push({ specifier: specifiers[i], absolutePath })
            }
          })
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
