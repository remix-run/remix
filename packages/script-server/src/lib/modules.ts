import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as esbuild from 'esbuild'
import { getTsconfig } from 'get-tsconfig'
import { IfNoneMatch } from '@remix-run/headers'
import { init as lexerInit, parse as parseImports } from 'es-module-lexer'
import type { Cache, TsConfigJsonResolved } from 'get-tsconfig'
import MagicString from 'magic-string'
import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js'

import { isCommonJS, mayContainCommonJSModuleGlobals } from './cjs-check.ts'
import {
  createScriptServerCompilationError,
  isScriptServerCompilationError,
} from './compilation-error.ts'
import { normalizeFilePath } from './paths.ts'
import type { CompiledRoutes } from './routes.ts'

let lexerReady = lexerInit
let preloadTraversalConcurrency = getPreloadTraversalConcurrency()
let scriptModuleTypes = [
  { extension: '.js', loader: 'js' },
  { extension: '.jsx', loader: 'jsx' },
  { extension: '.mjs', loader: 'js' },
  { extension: '.mts', loader: 'ts' },
  { extension: '.ts', loader: 'ts' },
  { extension: '.tsx', loader: 'tsx' },
] as const satisfies ReadonlyArray<{ extension: string; loader: esbuild.Loader }>
let supportedScriptExtensions = scriptModuleTypes.map(({ extension }) => extension)
let supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)
let transformLoaderByExtension = new Map<string, esbuild.Loader>(
  scriptModuleTypes.map(({ extension, loader }) => [extension, loader] as const),
)

export type ModuleCompileResult = {
  compiledCode: string
  compiledHash: string
  fingerprint: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type TransformedModule = {
  fingerprint: string
  identityPath: string
  importerDir: string
  rawCode: string
  resolvedPath: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
  unresolvedImports: UnresolvedImport[]
}

type ResolvedModule = {
  deps: string[]
  fingerprint: string
  identityPath: string
  imports: ResolvedImport[]
  rawCode: string
  resolvedPath: string
  sourceStamp: string
  sourcemap: string | null
  stableUrlPathname: string
}

type EmittedModule = {
  compiledCode: string
  compiledHash: string
  importUrls: string[]
  sourceStamp: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type ModuleCompilerOptions = {
  buildId?: string
  external: string[]
  fingerprintInternalModules: boolean
  isAllowed(absolutePath: string): boolean
  isEntryPoint(absolutePath: string): boolean
  minify: boolean
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
}

type ResolvedOptions = ModuleCompilerOptions & {
  cacheMode: 'immutable' | 'live'
  externalSet: Set<string>
}

type ModuleCacheEntry = {
  compileInFlight?: Promise<ModuleCompileResult>
  emitted?: EmittedModule
  resolved?: ResolvedModule
  resolvedPath?: string
  resolveInFlight?: Promise<ResolvedModule>
  sourceStamp?: string
  transformed?: TransformedModule
}

type ResolveModuleResult = {
  identityPath: string
  resolvedPath: string
}

type ResolvedImport = {
  depPath: string
  end: number
  quote?: '"' | "'" | '`'
  start: number
}

type UnresolvedImport = {
  end: number
  quote?: '"' | "'" | '`'
  specifier: string
  start: number
}

export type ModuleCompiler = {
  compileModule(absolutePath: string): Promise<ModuleCompileResult>
  getPreloadUrls(absolutePath: string | readonly string[]): Promise<string[]>
  resolveRequestPath(absolutePath: string): ResolveModuleResult | null
  resolveServedPath(absolutePath: string): ResolveModuleResult
}

export function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler {
  let resolvedOptions = resolveOptions(options)
  let moduleCache = new Map<string, ModuleCacheEntry>()
  let getTsconfigTransformOptions = createTsconfigTransformOptionsResolver()

  return {
    resolveServedPath(absolutePath) {
      return resolveServedPathOrThrow(absolutePath)
    },
    async compileModule(absolutePath) {
      let resolvedModule = resolveServedPathOrThrow(absolutePath)
      let entry = getModuleCacheEntry(resolvedModule.identityPath)

      let existing = entry.compileInFlight
      if (existing) return existing

      let compilePromise = compileResolvedModule(resolvedModule)
      entry.compileInFlight = compilePromise

      try {
        return await compilePromise
      } finally {
        if (entry.compileInFlight === compilePromise) {
          entry.compileInFlight = undefined
        }
      }
    },
    async getPreloadUrls(absolutePath) {
      let resolvedEntries = dedupeIdentityPaths(
        (Array.isArray(absolutePath) ? absolutePath : [absolutePath]).map((path) =>
          resolveServedPathOrThrow(path),
        ),
      )

      let visited = new Set(resolvedEntries)
      let queue = [...resolvedEntries]
      let urls: string[] = []

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let transformedModules = await mapWithConcurrency(
          frontier,
          preloadTraversalConcurrency,
          (identityPath) => getTransformedModule(identityPath),
        )
        let resolvedModules = await resolveTransformedModules(transformedModules)

        for (let resolvedModule of resolvedModules) {
          urls.push(getServedUrlForResolvedModule(resolvedModule))

          for (let dep of resolvedModule.deps) {
            if (visited.has(dep)) continue
            visited.add(dep)
            queue.push(dep)
          }
        }
      }

      return urls
    },
    resolveRequestPath(absolutePath) {
      return resolveModulePath(absolutePath)
    },
  }

  function resolveServedPathOrThrow(absolutePath: string): ResolveModuleResult {
    let resolvedModule = resolveModulePath(absolutePath)
    if (!resolvedModule) {
      throw createScriptServerCompilationError(`Module not found: ${absolutePath}`, {
        code: 'MODULE_NOT_FOUND',
      })
    }

    if (!resolvedOptions.isAllowed(resolvedModule.identityPath)) {
      throw createScriptServerCompilationError(
        `Module is not allowed: ${resolvedModule.identityPath}`,
        {
          code: 'MODULE_NOT_ALLOWED',
        },
      )
    }

    return resolvedModule
  }

  async function compileResolvedModule(
    resolvedModule: ResolveModuleResult,
  ): Promise<ModuleCompileResult> {
    let resolvedSourceModule = await getResolvedModuleByIdentity(
      resolvedModule.identityPath,
      resolvedModule.resolvedPath,
    )
    let existing = getCachedEmittedModule(resolvedSourceModule.identityPath)
    if (existing && resolvedOptions.cacheMode === 'immutable') {
      return toModuleCompileResult(resolvedSourceModule, existing)
    }

    let importUrls = await Promise.all(
      resolvedSourceModule.deps.map((depPath) => getServedUrl(depPath)),
    )
    if (existing && canReuseEmittedModule(existing, resolvedSourceModule.sourceStamp, importUrls)) {
      return toModuleCompileResult(resolvedSourceModule, existing)
    }

    let rewriteResult = await rewriteImports(resolvedSourceModule)
    let finalCode = rewriteResult.code
    if (rewriteResult.sourcemap) {
      if (resolvedOptions.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourcemap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (resolvedOptions.sourceMaps === 'external') {
        let mapPath = resolvedOptions.isEntryPoint(resolvedSourceModule.identityPath)
          ? `${resolvedSourceModule.stableUrlPathname}.map`
          : resolvedOptions.fingerprintInternalModules
            ? `${resolvedSourceModule.stableUrlPathname}.@${resolvedSourceModule.fingerprint}.map`
            : `${resolvedSourceModule.stableUrlPathname}.map`
        finalCode += `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let emittedModule: EmittedModule = {
      compiledCode: finalCode,
      compiledHash: await hashContent(finalCode),
      importUrls,
      sourceStamp: resolvedSourceModule.sourceStamp,
      sourcemap: rewriteResult.sourcemap,
      sourcemapHash: rewriteResult.sourcemap ? await hashContent(rewriteResult.sourcemap) : null,
    }

    cacheEmittedModule(resolvedSourceModule.identityPath, emittedModule)
    return toModuleCompileResult(resolvedSourceModule, emittedModule)
  }

  async function rewriteImports(
    resolvedModule: ResolvedModule,
  ): Promise<{ code: string; sourcemap: string | null }> {
    let rewrittenSource = new MagicString(resolvedModule.rawCode)

    for (let imported of resolvedModule.imports) {
      let url = await getServedUrl(imported.depPath)
      rewrittenSource.overwrite(
        imported.start,
        imported.end,
        imported.quote ? `${imported.quote}${url}${imported.quote}` : url,
      )
    }

    let code = rewrittenSource.toString()
    let sourcemap =
      resolvedModule.sourcemap && resolvedModule.imports.length > 0
        ? composeSourceMaps(
            rewrittenSource.generateMap({ hires: true }).toString(),
            resolvedModule.sourcemap,
          )
        : resolvedModule.sourcemap

    return { code, sourcemap }
  }

  async function getServedUrl(identityPath: string): Promise<string> {
    let resolvedModule = await getResolvedModuleByIdentity(identityPath)
    return getServedUrlForResolvedModule(resolvedModule)
  }

  function getServedUrlForResolvedModule(resolvedModule: ResolvedModule): string {
    if (
      resolvedOptions.isEntryPoint(resolvedModule.identityPath) ||
      !resolvedOptions.fingerprintInternalModules
    ) {
      return resolvedModule.stableUrlPathname
    }
    return `${resolvedModule.stableUrlPathname}.@${resolvedModule.fingerprint}`
  }

  async function getResolvedModuleByIdentity(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<ResolvedModule> {
    let entry = getModuleCacheEntry(identityPath)
    let existing = entry.resolveInFlight
    if (existing) return existing

    let promise = (async () => {
      let transformedModule = await getTransformedModule(identityPath, resolvedPath)
      return resolveTransformedModule(transformedModule)
    })()
    entry.resolveInFlight = promise

    try {
      return await promise
    } finally {
      if (entry.resolveInFlight === promise) {
        entry.resolveInFlight = undefined
      }
    }
  }

  async function getTransformedModule(
    identityPath: string,
    resolvedPath?: string,
  ): Promise<ResolvedModule | TransformedModule> {
    let entry = getModuleCacheEntry(identityPath)
    let cachedResolvedModule = getCachedResolvedModule(identityPath)
    if (cachedResolvedModule) {
      return cachedResolvedModule
    }

    let nextResolvedPath = resolvedPath ?? entry.resolvedPath ?? resolveActualPath(identityPath)
    if (!nextResolvedPath) {
      throw createScriptServerCompilationError(`Module not found: ${identityPath}`, {
        code: 'MODULE_NOT_FOUND',
      })
    }

    let stat
    try {
      stat = await fsp.stat(nextResolvedPath)
    } catch (error) {
      if (isNoEntityError(error)) {
        throw createScriptServerCompilationError(`Module not found: ${nextResolvedPath}`, {
          cause: error,
          code: 'MODULE_NOT_FOUND',
        })
      }
      throw error
    }

    let sourceStamp = `${stat.size}:${stat.mtimeMs}`
    syncModuleCacheEntry(identityPath, nextResolvedPath, sourceStamp)

    if (entry.resolved) return entry.resolved
    if (entry.transformed) return entry.transformed

    let transformOptions = getTsconfigTransformOptions(nextResolvedPath)
    let sourceText: string
    try {
      sourceText = await fsp.readFile(nextResolvedPath, 'utf-8')
    } catch (error) {
      if (isNoEntityError(error)) {
        throw createScriptServerCompilationError(`Module not found: ${nextResolvedPath}`, {
          cause: error,
          code: 'MODULE_NOT_FOUND',
        })
      }
      throw error
    }

    let mayContainCommonJS = mayContainCommonJSModuleGlobals(sourceText)
    let analysis = await analyzeModuleSource(sourceText, nextResolvedPath, transformOptions, {
      minify: resolvedOptions.minify,
      sourceMaps: resolvedOptions.sourceMaps,
    })
    analysis.unresolvedImports = analysis.unresolvedImports.filter(
      (unresolved) => !resolvedOptions.externalSet.has(unresolved.specifier),
    )

    if (mayContainCommonJS && isCommonJS(analysis.rawCode)) {
      throw createScriptServerCompilationError(
        `CommonJS module detected: ${nextResolvedPath}\n\n` +
          `This module uses CommonJS (require/module.exports) which is not supported.\n` +
          `Please use an ESM-compatible module.`,
        {
          code: 'MODULE_COMMONJS_NOT_SUPPORTED',
        },
      )
    }

    let stableUrlPathname = resolvedOptions.routes.toUrlPathname(identityPath)
    if (!stableUrlPathname) {
      throw createScriptServerCompilationError(
        `Module ${identityPath} is outside all configured routes.`,
        {
          code: 'MODULE_OUTSIDE_ROUTES',
        },
      )
    }
    let sourcemap = analysis.sourcemap
      ? rewriteSourceMap(analysis.sourcemap, nextResolvedPath, stableUrlPathname)
      : null

    return cacheTransformedModule({
      fingerprint: await hashContent(sourceText + '\0' + (resolvedOptions.buildId ?? '')),
      identityPath,
      importerDir: path.dirname(nextResolvedPath),
      rawCode: analysis.rawCode,
      resolvedPath: nextResolvedPath,
      sourceStamp,
      sourcemap,
      stableUrlPathname,
      unresolvedImports: analysis.unresolvedImports,
    })
  }

  async function resolveTransformedModule(
    transformedModule: ResolvedModule | TransformedModule,
  ): Promise<ResolvedModule> {
    if (isResolvedModule(transformedModule)) return transformedModule

    let resolvedImports =
      transformedModule.unresolvedImports.length > 0
        ? await batchResolveSpecifiers(
            getUniqueSpecifiers(transformedModule.unresolvedImports),
            transformedModule.importerDir,
          )
        : new Map<string, string>()
    return buildResolvedModule(transformedModule, resolvedImports)
  }

  async function resolveTransformedModules(
    transformedModules: Array<ResolvedModule | TransformedModule>,
  ): Promise<ResolvedModule[]> {
    let groupedSpecifiers = new Map<string, Set<string>>()

    for (let transformedModule of transformedModules) {
      if (isResolvedModule(transformedModule) || transformedModule.unresolvedImports.length === 0) {
        continue
      }

      let existing = groupedSpecifiers.get(transformedModule.importerDir) ?? new Set<string>()
      for (let specifier of getUniqueSpecifiers(transformedModule.unresolvedImports)) {
        existing.add(specifier)
      }
      groupedSpecifiers.set(transformedModule.importerDir, existing)
    }

    let resolvedByDirectory = new Map<string, Map<string, string>>()
    await mapWithConcurrency(
      [...groupedSpecifiers.entries()],
      preloadTraversalConcurrency,
      async ([importerDir, specifiers]) => {
        resolvedByDirectory.set(
          importerDir,
          await batchResolveSpecifiers([...specifiers], importerDir),
        )
      },
    )

    return Promise.all(
      transformedModules.map((transformedModule) => {
        if (isResolvedModule(transformedModule)) return transformedModule
        return buildResolvedModule(
          transformedModule,
          resolvedByDirectory.get(transformedModule.importerDir) ?? new Map<string, string>(),
        )
      }),
    )
  }

  async function buildResolvedModule(
    transformedModule: TransformedModule,
    resolvedImports: Map<string, string>,
  ): Promise<ResolvedModule> {
    let importsWithPaths: ResolvedImport[] = []
    let deps = new Set<string>()

    for (let unresolved of transformedModule.unresolvedImports) {
      let resolvedImportPath = resolvedImports.get(unresolved.specifier)
      if (!resolvedImportPath) {
        throw createScriptServerCompilationError(
          `Failed to resolve import "${unresolved.specifier}" in ${transformedModule.resolvedPath}.\n\n` +
            `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
          {
            code: 'IMPORT_RESOLUTION_FAILED',
          },
        )
      }

      let resolvedImport = resolveModulePath(resolvedImportPath)
      if (!resolvedImport) {
        throw createScriptServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformedModule.resolvedPath} is not a supported script module.\n\n` +
            `Supported extensions are ${supportedScriptExtensions.join(', ')}.`,
          {
            code: 'IMPORT_NOT_SUPPORTED',
          },
        )
      }
      if (!resolvedOptions.isAllowed(resolvedImport.identityPath)) {
        throw createScriptServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformedModule.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
            `Add a matching route and allow rule, or mark this import as external.`,
          {
            code: 'IMPORT_NOT_ALLOWED',
          },
        )
      }

      let stableUrlPathname = resolvedOptions.routes.toUrlPathname(resolvedImport.identityPath)
      if (!stableUrlPathname) {
        throw createScriptServerCompilationError(
          `Resolved import "${unresolved.specifier}" in ${transformedModule.resolvedPath} points outside the script-server routing/allow configuration.\n\n` +
            `Add a matching route and allow rule, or mark this import as external.`,
          {
            code: 'IMPORT_NOT_ALLOWED',
          },
        )
      }

      deps.add(resolvedImport.identityPath)
      importsWithPaths.push({
        depPath: resolvedImport.identityPath,
        end: unresolved.end,
        quote: unresolved.quote,
        start: unresolved.start,
      })
    }

    let resolvedModule: ResolvedModule = {
      deps: [...deps],
      fingerprint: transformedModule.fingerprint,
      identityPath: transformedModule.identityPath,
      imports: importsWithPaths,
      rawCode: transformedModule.rawCode,
      resolvedPath: transformedModule.resolvedPath,
      sourceStamp: transformedModule.sourceStamp,
      sourcemap: transformedModule.sourcemap,
      stableUrlPathname: transformedModule.stableUrlPathname,
    }

    cacheResolvedModule(resolvedModule)
    return resolvedModule
  }

  function getModuleCacheEntry(identityPath: string): ModuleCacheEntry {
    let entry = moduleCache.get(identityPath)
    if (entry) return entry

    entry = {}
    moduleCache.set(identityPath, entry)
    return entry
  }

  function syncModuleCacheEntry(
    identityPath: string,
    resolvedPath: string,
    sourceStamp: string,
  ): ModuleCacheEntry {
    let entry = getModuleCacheEntry(identityPath)
    if (entry.resolvedPath === resolvedPath && entry.sourceStamp === sourceStamp) {
      return entry
    }

    entry.emitted = undefined
    entry.resolved = undefined
    entry.resolvedPath = resolvedPath
    entry.sourceStamp = sourceStamp
    entry.transformed = undefined
    return entry
  }

  function getCachedEmittedModule(identityPath: string): EmittedModule | null {
    let entry = getModuleCacheEntry(identityPath)
    if (entry.emitted) return entry.emitted
    return null
  }

  function getCachedResolvedModule(identityPath: string): ResolvedModule | null {
    let entry = getModuleCacheEntry(identityPath)
    if (resolvedOptions.cacheMode === 'immutable' && entry.resolved) {
      return entry.resolved
    }
    return null
  }

  function cacheEmittedModule(identityPath: string, emittedModule: EmittedModule): EmittedModule {
    let entry = getModuleCacheEntry(identityPath)
    entry.emitted = emittedModule
    return emittedModule
  }

  function canReuseEmittedModule(
    emittedModule: EmittedModule,
    sourceStamp: string,
    importUrls: string[],
  ): boolean {
    return (
      emittedModule.sourceStamp === sourceStamp && arraysEqual(emittedModule.importUrls, importUrls)
    )
  }

  function cacheTransformedModule(transformedModule: TransformedModule): TransformedModule {
    let entry = getModuleCacheEntry(transformedModule.identityPath)
    entry.resolvedPath = transformedModule.resolvedPath
    entry.sourceStamp = transformedModule.sourceStamp
    entry.transformed = transformedModule
    return transformedModule
  }

  function cacheResolvedModule(resolvedModule: ResolvedModule): ResolvedModule {
    let entry = getModuleCacheEntry(resolvedModule.identityPath)
    entry.resolved = resolvedModule
    entry.resolvedPath = resolvedModule.resolvedPath
    entry.sourceStamp = resolvedModule.sourceStamp
    return resolvedModule
  }

  function isResolvedModule(value: ResolvedModule | TransformedModule): value is ResolvedModule {
    return 'deps' in value
  }

  function rewriteSourceMap(
    sourcemap: string,
    resolvedPath: string,
    stableUrlPathname: string,
  ): string {
    let json = JSON.parse(sourcemap) as { sources?: string[] }
    json.sources = [
      resolvedOptions.sourceMapSourcePaths === 'absolute'
        ? normalizeFilePath(resolvedPath)
        : stableUrlPathname,
    ]
    return JSON.stringify(json)
  }

  function toModuleCompileResult(
    resolvedModule: ResolvedModule,
    emittedModule: EmittedModule,
  ): ModuleCompileResult {
    return {
      compiledCode: emittedModule.compiledCode,
      compiledHash: emittedModule.compiledHash,
      fingerprint: resolvedModule.fingerprint,
      sourcemap: emittedModule.sourcemap,
      sourcemapHash: emittedModule.sourcemapHash,
    }
  }
}

function dedupeIdentityPaths(resolvedModules: readonly ResolveModuleResult[]): string[] {
  let deduped: string[] = []
  let seen = new Set<string>()

  for (let resolvedModule of resolvedModules) {
    if (seen.has(resolvedModule.identityPath)) continue
    seen.add(resolvedModule.identityPath)
    deduped.push(resolvedModule.identityPath)
  }

  return deduped
}

function resolveOptions(options: ModuleCompilerOptions): ResolvedOptions {
  return {
    ...options,
    cacheMode: options.buildId === undefined ? 'live' : 'immutable',
    externalSet: new Set(options.external),
  }
}

function resolveModulePath(absolutePath: string): ResolveModuleResult | null {
  let resolvedPath: string

  try {
    resolvedPath = fs.realpathSync(normalizeFilePath(absolutePath))
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }

  if (!isSupportedScriptPath(resolvedPath)) {
    return null
  }

  return {
    identityPath: normalizeFilePath(resolvedPath),
    resolvedPath,
  }
}

function resolveActualPath(identityPath: string): string | null {
  try {
    return fs.realpathSync(identityPath)
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

function isSupportedScriptPath(filePath: string): boolean {
  return supportedScriptExtensionSet.has(path.extname(filePath).toLowerCase())
}

function composeSourceMaps(rewriteSourceMap: string, transformSourceMap: string): string {
  let rewriteConsumer = new SourceMapConsumer(JSON.parse(rewriteSourceMap))
  let transformConsumer = new SourceMapConsumer(JSON.parse(transformSourceMap))
  let generator = new SourceMapGenerator()

  rewriteConsumer.eachMapping((mapping) => {
    if (
      mapping.originalLine == null ||
      mapping.originalColumn == null ||
      mapping.generatedLine == null ||
      mapping.generatedColumn == null
    ) {
      return
    }

    let original = transformConsumer.originalPositionFor({
      line: mapping.originalLine,
      column: mapping.originalColumn,
    })
    if (original.line == null || original.column == null || original.source == null) return

    generator.addMapping({
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn,
      },
      original: {
        line: original.line,
        column: original.column,
      },
      source: original.source,
      name: original.name ?? mapping.name ?? undefined,
    })
  })

  for (let source of transformConsumer.sources) {
    let sourceContent = transformConsumer.sourceContentFor(source, true)
    if (sourceContent !== null) {
      generator.setSourceContent(source, sourceContent)
    }
  }

  return JSON.stringify(generator.toJSON())
}

type ModuleAnalysisResult = {
  rawCode: string
  sourcemap: string | null
  unresolvedImports: UnresolvedImport[]
}

type TsconfigTransformOptions = {
  tsconfigRaw?: TsConfigJsonResolved
}

async function hashContent(content: string): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(content)
  let hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(hashBuffer).toString('base64url').slice(0, 6)
}

function createTsconfigTransformOptionsResolver() {
  let fileSystemCache: Cache = new Map()
  let transformOptionsByDirectory = new Map<string, TsconfigTransformOptions>()

  return function getTsconfigTransformOptions(filePath: string): TsconfigTransformOptions {
    let directory = path.dirname(filePath)
    let cached = transformOptionsByDirectory.get(directory)
    if (cached) return cached

    let tsconfig = getTsconfig(directory, 'tsconfig.json', fileSystemCache)
    if (!tsconfig) {
      let transformOptions = {}
      transformOptionsByDirectory.set(directory, transformOptions)
      return transformOptions
    }

    let transformOptions: TsconfigTransformOptions = {
      tsconfigRaw: tsconfig.config,
    }

    transformOptionsByDirectory.set(directory, transformOptions)
    return transformOptions
  }
}

function arraysEqual<item>(first: item[] | undefined, second: item[]): boolean {
  if (first === undefined || first.length !== second.length) return false

  for (let index = 0; index < first.length; ++index) {
    if (first[index] !== second[index]) return false
  }

  return true
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: { minify: boolean; sourceMaps?: 'external' | 'inline' },
): Promise<ModuleAnalysisResult> {
  let transformResult: esbuild.TransformResult
  try {
    transformResult = await esbuild.transform(sourceText, {
      format: 'esm',
      loader: transformLoaderByExtension.get(path.extname(resolvedPath).toLowerCase()) ?? 'js',
      logLevel: 'silent',
      minify: options.minify,
      sourcefile: resolvedPath,
      sourcemap: options.sourceMaps ? 'external' : false,
      tsconfigRaw: transformOptions.tsconfigRaw,
    })
  } catch (error) {
    throw createScriptServerCompilationError(
      `Failed to transform module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'MODULE_TRANSFORM_FAILED',
      },
    )
  }

  let rawCode = transformResult.code.replace(/^\/\/# sourceMappingURL=.+$/m, '').trimEnd()
  let sourcemap = transformResult.map ?? null
  await lexerReady
  let unresolvedImports = getUnresolvedImportsFromCode(rawCode)

  return {
    rawCode,
    sourcemap,
    unresolvedImports,
  }
}

async function batchResolveSpecifiers(
  specifiers: string[],
  importerDir: string,
): Promise<Map<string, string>> {
  let resolvedPathsBySpecifier = new Map<string, string>()
  if (specifiers.length === 0) return resolvedPathsBySpecifier

  let resolvedSpecs = await resolveWithEsbuild(specifiers, importerDir)
  for (let resolvedSpec of resolvedSpecs) {
    if (resolvedSpec.absolutePath) {
      resolvedPathsBySpecifier.set(
        resolvedSpec.specifier,
        normalizeFilePath(resolvedSpec.absolutePath),
      )
    }
  }

  return resolvedPathsBySpecifier
}

type ResolvedSpec = {
  absolutePath: string | null
  specifier: string
}

function getPreloadTraversalConcurrency(): number {
  let override = process.env.SCRIPT_SERVER_PRELOAD_CONCURRENCY
  if (override !== undefined) {
    let parsed = Number.parseInt(override, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return Math.max(1, Math.min(8, os.availableParallelism() - 1))
}

function getUniqueSpecifiers(unresolvedImports: UnresolvedImport[]): string[] {
  return [...new Set(unresolvedImports.map((unresolved) => unresolved.specifier))]
}

type ParsedImportRecord = ReturnType<typeof parseImports>[0][number]

function getUnresolvedImportsFromCode(rawCode: string): UnresolvedImport[] {
  let [imports] = parseImports(rawCode)
  let unresolvedImports: UnresolvedImport[] = []

  for (let imported of imports) {
    let specifier = getStaticImportSpecifier(rawCode, imported)
    if (specifier == null) continue
    if (
      specifier.startsWith('data:') ||
      specifier.startsWith('http://') ||
      specifier.startsWith('https://')
    ) {
      continue
    }
    unresolvedImports.push({
      specifier,
      start: imported.s,
      end: imported.e,
      quote: getImportQuote(rawCode, imported.s),
    })
  }

  return unresolvedImports
}

function getStaticImportSpecifier(source: string, imported: ParsedImportRecord): string | null {
  if (imported.n != null) {
    return imported.n
  }

  if (imported.d < 0) {
    return null
  }

  let rawSpecifier = source.slice(imported.s, imported.e)
  if (!isStaticTemplateLiteral(rawSpecifier)) {
    return null
  }

  return rawSpecifier.slice(1, -1)
}

function isStaticTemplateLiteral(specifier: string): boolean {
  return specifier.startsWith('`') && specifier.endsWith('`') && !specifier.includes('${')
}

function getImportQuote(source: string, start: number): '"' | "'" | '`' | undefined {
  let firstCharacter = source[start]
  if (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === '`') {
    return firstCharacter
  }
  return undefined
}

async function mapWithConcurrency<item, result>(
  items: item[],
  concurrency: number,
  mapper: (item: item, index: number) => Promise<result>,
): Promise<result[]> {
  if (items.length === 0) return []

  let results = new Array<result>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      let index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

async function resolveWithEsbuild(
  specifiers: string[],
  importerDir: string,
): Promise<ResolvedSpec[]> {
  let resolvedSpecs: ResolvedSpec[] = []

  try {
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
              let resolutionResults = await Promise.all(
                specifiers.map((specifier) =>
                  build.resolve(specifier, {
                    kind: 'import-statement',
                    resolveDir: importerDir,
                  }),
                ),
              )

              for (let index = 0; index < specifiers.length; index++) {
                let resolutionResult = resolutionResults[index]
                if (resolutionResult?.errors.length) {
                  throw createScriptServerCompilationError(
                    `Failed to resolve import "${specifiers[index]}" in ${importerDir}.\n\n` +
                      `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
                    {
                      code: 'IMPORT_RESOLUTION_FAILED',
                    },
                  )
                }

                let absolutePath =
                  resolutionResult &&
                  !resolutionResult.external &&
                  resolutionResult.path &&
                  path.isAbsolute(resolutionResult.path)
                    ? resolutionResult.path
                    : null

                resolvedSpecs.push({ absolutePath, specifier: specifiers[index] })
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
  } catch (error) {
    if (isScriptServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
      throw error
    }

    throw createScriptServerCompilationError(
      `Failed to resolve imports in ${importerDir}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
      },
    )
  }

  return resolvedSpecs
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

export function createResponseForModule(
  result: ModuleCompileResult,
  options: {
    cacheControl: string
    ifNoneMatch: string | null
    isSourceMapRequest: boolean
    method: string
  },
): Response {
  let body: string | null
  let etag: string
  let contentType: string

  if (options.isSourceMapRequest) {
    if (!result.sourcemap) {
      return new Response('Not found', { status: 404 })
    }
    body = options.method === 'HEAD' ? null : result.sourcemap
    etag = `W/"${result.sourcemapHash ?? result.compiledHash}"`
    contentType = 'application/json; charset=utf-8'
  } else {
    body = options.method === 'HEAD' ? null : result.compiledCode
    etag = `W/"${result.compiledHash}"`
    contentType = 'application/javascript; charset=utf-8'
  }

  if (IfNoneMatch.from(options.ifNoneMatch).matches(etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag } })
  }

  return new Response(body, {
    headers: {
      'Cache-Control': options.cacheControl,
      'Content-Type': contentType,
      ETag: etag,
    },
  })
}
