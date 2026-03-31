import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getTsconfig } from 'get-tsconfig'
import { minify } from 'oxc-minify'
import { ResolverFactory } from 'oxc-resolver'
import { transform as oxcTransform } from 'oxc-transform'
import { IfNoneMatch } from '@remix-run/headers'
import { init as esModuleLexerInit, parse as esModuleLexer } from 'es-module-lexer'
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
import type { ScriptServerTarget } from './script-server.ts'

type SourceLanguage = 'js' | 'jsx' | 'ts' | 'tsx'
const scriptModuleTypes = [
  { extension: '.js', lang: 'js' },
  { extension: '.jsx', lang: 'jsx' },
  { extension: '.mjs', lang: 'js' },
  { extension: '.mts', lang: 'ts' },
  { extension: '.ts', lang: 'ts' },
  { extension: '.tsx', lang: 'tsx' },
] as const satisfies ReadonlyArray<{ extension: string; lang: SourceLanguage }>
const supportedScriptExtensions = scriptModuleTypes.map(({ extension }) => extension)
const supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)
const sourceLanguageByExtension = new Map<string, SourceLanguage>(
  scriptModuleTypes.map(({ extension, lang }) => [extension, lang] as const),
)
const resolverExtensionAlias = {
  '.js': ['.js', '.ts', '.tsx', '.jsx'],
  '.jsx': ['.jsx', '.tsx'],
  '.mjs': ['.mjs', '.mts'],
} satisfies Record<string, string[]>
const resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']
const preloadTraversalConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1))

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
  packageSpecifiers: string[]
  rawCode: string
  resolvedPath: string
  sourcemap: string | null
  stableUrlPathname: string
  trackedFiles: string[]
  unresolvedImports: UnresolvedImport[]
}

type ResolvedModule = {
  deps: string[]
  fingerprint: string
  identityPath: string
  imports: ResolvedImport[]
  trackedFiles: string[]
  trackedResolutions: TrackedResolution[]
  rawCode: string
  resolvedPath: string
  sourcemap: string | null
  stableUrlPathname: string
}

type EmittedModule = {
  compiledCode: string
  compiledHash: string
  importUrls: string[]
  sourcemap: string | null
  sourcemapHash: string | null
}

type ModuleCompilerOptions = {
  buildId?: string
  define?: Record<string, string>
  external: string[]
  fingerprintModules: boolean
  isAllowed(absolutePath: string): boolean
  minify: boolean
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
  target?: ScriptServerTarget
}

type ModuleCacheEntry = {
  compileInFlight?: Promise<ModuleCompileResult>
  emitted?: EmittedModule
  generation: number
  resolved?: ResolvedModule
  resolvedPath?: string
  resolveInFlight?: Promise<ResolvedModule>
  trackedFiles?: string[]
  trackedResolutions?: TrackedResolution[]
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

type RelativeImportResolution = {
  candidatePaths: readonly string[]
  candidatePrefixes: readonly string[]
  specifier: string
}

type TrackedResolution = RelativeImportResolution & {
  resolvedIdentityPath: string
}

export type ModuleWatchEvent = 'add' | 'change' | 'unlink'

export type ModuleCompiler = {
  compileModule(absolutePath: string): Promise<ModuleCompileResult>
  getPreloadUrls(absolutePath: string | readonly string[]): Promise<string[]>
  handleFileEvent(filePath: string, event: ModuleWatchEvent): Promise<void>
  resolveRequestPath(absolutePath: string): ResolveModuleResult | null
  resolveServedPath(absolutePath: string): ResolveModuleResult
}

export function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler {
  let resolvedOptions = {
    ...options,
    externalSet: new Set(options.external),
  }
  let moduleCache = new Map<string, ModuleCacheEntry>()
  let importersByDependency = new Map<string, Set<string>>()
  let modulesByTrackedFile = new Map<string, Set<string>>()
  let tsconfigTransformOptions = createTsconfigTransformOptionsResolver()
  let resolverFactory = new ResolverFactory({
    aliasFields: [['browser']],
    conditionNames: ['browser', 'import', 'module', 'default'],
    extensionAlias: resolverExtensionAlias,
    extensions: resolverExtensions,
    mainFields: ['browser', 'module', 'main'],
  })

  return {
    resolveServedPath(absolutePath) {
      return resolveServedPathOrThrow(absolutePath)
    },
    async compileModule(absolutePath) {
      let resolvedModule = resolveServedPathOrThrow(absolutePath)
      let entry = getModuleCacheEntry(resolvedModule.identityPath)
      let generation = entry.generation

      let existing = entry.compileInFlight
      if (existing) return existing

      let compilePromise = compileResolvedModule(resolvedModule, generation)
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
      let resolvedEntries: string[] = []
      let seen = new Set<string>()
      for (let resolvedModule of (Array.isArray(absolutePath) ? absolutePath : [absolutePath]).map(
        (path) => resolveServedPathOrThrow(path),
      )) {
        if (seen.has(resolvedModule.identityPath)) continue
        seen.add(resolvedModule.identityPath)
        resolvedEntries.push(resolvedModule.identityPath)
      }

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
    async handleFileEvent(filePath, event) {
      let normalizedFilePath = normalizeFilePath(filePath)
      resolverFactory.clearCache()

      if (isTsconfigPath(normalizedFilePath)) {
        tsconfigTransformOptions.clear()
        invalidateAllModules()
        return
      }

      if (isPackageJsonPath(normalizedFilePath)) {
        invalidateAllModules()
        return
      }

      if (event === 'add' || event === 'unlink') {
        await invalidateModulesForResolutionChange(normalizedFilePath)
      }

      for (let identityPath of modulesByTrackedFile.get(normalizedFilePath) ?? []) {
        invalidateModuleAndImporters(identityPath)
      }
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
    generation: number,
  ): Promise<ModuleCompileResult> {
    let resolvedSourceModule = await getResolvedModuleByIdentity(
      resolvedModule.identityPath,
      resolvedModule.resolvedPath,
      generation,
    )
    let existing = getModuleCacheEntry(resolvedSourceModule.identityPath).emitted
    if (existing) return toModuleCompileResult(resolvedSourceModule, existing)

    let importUrls = await Promise.all(
      resolvedSourceModule.deps.map((depPath) => getServedUrl(depPath)),
    )

    let rewriteResult = await rewriteImports(resolvedSourceModule)
    let finalCode = rewriteResult.code
    if (rewriteResult.sourcemap) {
      if (resolvedOptions.sourceMaps === 'inline') {
        let encoded = Buffer.from(rewriteResult.sourcemap).toString('base64')
        finalCode += `\n//# sourceMappingURL=data:application/json;base64,${encoded}`
      } else if (resolvedOptions.sourceMaps === 'external') {
        let mapPath = `${getServedUrlForResolvedModule(resolvedSourceModule)}.map`
        finalCode += `\n//# sourceMappingURL=${mapPath}`
      }
    }

    let emittedModule: EmittedModule = {
      compiledCode: finalCode,
      compiledHash: await hashContent(finalCode),
      importUrls,
      sourcemap: rewriteResult.sourcemap,
      sourcemapHash: rewriteResult.sourcemap ? await hashContent(rewriteResult.sourcemap) : null,
    }

    cacheEmittedModule(resolvedSourceModule.identityPath, emittedModule, generation)
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
    return resolvedOptions.fingerprintModules
      ? `${resolvedModule.stableUrlPathname}.@${resolvedModule.fingerprint}`
      : resolvedModule.stableUrlPathname
  }

  async function getResolvedModuleByIdentity(
    identityPath: string,
    resolvedPath?: string,
    generation = getModuleCacheEntry(identityPath).generation,
  ): Promise<ResolvedModule> {
    let entry = getModuleCacheEntry(identityPath)
    let existing = entry.resolveInFlight
    if (existing) return existing

    let promise = (async () => {
      let transformedModule = await getTransformedModule(identityPath, resolvedPath, generation)
      return resolveTransformedModule(transformedModule, generation)
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
    generation = getModuleCacheEntry(identityPath).generation,
  ): Promise<ResolvedModule | TransformedModule> {
    let entry = getModuleCacheEntry(identityPath)
    let cachedResolvedModule = entry.resolved
    if (cachedResolvedModule) {
      return cachedResolvedModule
    }
    if (entry.transformed) return entry.transformed

    let nextResolvedPath = resolvedPath ?? entry.resolvedPath ?? resolveActualPath(identityPath)
    if (!nextResolvedPath) {
      throw createScriptServerCompilationError(`Module not found: ${identityPath}`, {
        code: 'MODULE_NOT_FOUND',
      })
    }

    entry.resolvedPath = nextResolvedPath

    let transformOptions = tsconfigTransformOptions.getTransformOptions(nextResolvedPath)
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
      define: resolvedOptions.define,
      minify: resolvedOptions.minify,
      sourceMaps: resolvedOptions.sourceMaps,
      target: resolvedOptions.target,
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
    let sourceMapText = analysis.sourcemap
    let sourcemap = sourceMapText
      ? rewriteSourceMap(sourceMapText, nextResolvedPath, stableUrlPathname)
      : null

    return cacheTransformedModule(
      {
        fingerprint: await hashContent(sourceText + '\0' + (resolvedOptions.buildId ?? '')),
        identityPath,
        importerDir: path.dirname(nextResolvedPath),
        packageSpecifiers: analysis.unresolvedImports
          .filter((unresolved) => isPackageImportSpecifier(unresolved.specifier))
          .map((unresolved) => unresolved.specifier),
        rawCode: analysis.rawCode,
        resolvedPath: nextResolvedPath,
        sourcemap,
        stableUrlPathname,
        trackedFiles: [nextResolvedPath, ...transformOptions.trackedFiles],
        unresolvedImports: analysis.unresolvedImports,
      },
      generation,
    )
  }

  async function resolveTransformedModule(
    transformedModule: ResolvedModule | TransformedModule,
    generation: number,
  ): Promise<ResolvedModule> {
    if (isResolvedModule(transformedModule)) return transformedModule

    let resolvedImports =
      transformedModule.unresolvedImports.length > 0
        ? await batchResolveSpecifiers(
            getUniqueSpecifiers(transformedModule.unresolvedImports),
            transformedModule.resolvedPath,
            resolverFactory,
          )
        : new Map<string, ResolvedSpec>()
    return buildResolvedModule(transformedModule, resolvedImports, generation)
  }

  async function resolveTransformedModules(
    transformedModules: Array<ResolvedModule | TransformedModule>,
  ): Promise<ResolvedModule[]> {
    let groupedSpecifiers = new Map<string, { importerPath: string; specifiers: Set<string> }>()

    for (let transformedModule of transformedModules) {
      if (isResolvedModule(transformedModule) || transformedModule.unresolvedImports.length === 0) {
        continue
      }

      let existing = groupedSpecifiers.get(transformedModule.importerDir) ?? {
        importerPath: transformedModule.resolvedPath,
        specifiers: new Set<string>(),
      }
      for (let specifier of getUniqueSpecifiers(transformedModule.unresolvedImports)) {
        existing.specifiers.add(specifier)
      }
      groupedSpecifiers.set(transformedModule.importerDir, existing)
    }

    let resolvedByDirectory = new Map<string, Map<string, ResolvedSpec>>()
    await mapWithConcurrency(
      [...groupedSpecifiers.entries()],
      preloadTraversalConcurrency,
      async ([importerDir, group]) => {
        resolvedByDirectory.set(
          importerDir,
          await batchResolveSpecifiers([...group.specifiers], group.importerPath, resolverFactory),
        )
      },
    )

    return Promise.all(
      transformedModules.map((transformedModule) => {
        if (isResolvedModule(transformedModule)) return transformedModule
        return buildResolvedModule(
          transformedModule,
          resolvedByDirectory.get(transformedModule.importerDir) ?? new Map<string, ResolvedSpec>(),
          getModuleCacheEntry(transformedModule.identityPath).generation,
        )
      }),
    )
  }

  async function buildResolvedModule(
    transformedModule: TransformedModule,
    resolvedImports: Map<string, ResolvedSpec>,
    generation: number,
  ): Promise<ResolvedModule> {
    let importsWithPaths: ResolvedImport[] = []
    let deps = new Set<string>()
    let trackedFiles = new Set(transformedModule.trackedFiles)
    let trackedResolutions: TrackedResolution[] = []

    for (let unresolved of transformedModule.unresolvedImports) {
      let resolvedSpec = resolvedImports.get(unresolved.specifier)
      if (!resolvedSpec?.absolutePath) {
        throw createScriptServerCompilationError(
          `Failed to resolve import "${unresolved.specifier}" in ${transformedModule.resolvedPath}.\n\n` +
            `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
          {
            code: 'IMPORT_RESOLUTION_FAILED',
          },
        )
      }

      let resolvedImport = resolveModulePath(resolvedSpec.absolutePath)
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
      if (transformedModule.packageSpecifiers.includes(unresolved.specifier)) {
        let packageJsonPath =
          resolvedSpec.packageJsonPath ?? findNearestPackageJsonPath(resolvedImport.resolvedPath)
        if (packageJsonPath) trackedFiles.add(packageJsonPath)
      }
      let trackedResolution = getTrackedRelativeImportResolution(
        transformedModule.importerDir,
        unresolved.specifier,
      )
      if (trackedResolution) {
        trackedResolutions.push({
          ...trackedResolution,
          resolvedIdentityPath: resolvedImport.identityPath,
        })
      }
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
      trackedFiles: [...trackedFiles],
      trackedResolutions,
      rawCode: transformedModule.rawCode,
      resolvedPath: transformedModule.resolvedPath,
      sourcemap: transformedModule.sourcemap,
      stableUrlPathname: transformedModule.stableUrlPathname,
    }

    cacheResolvedModule(resolvedModule, generation)
    return resolvedModule
  }

  function getModuleCacheEntry(identityPath: string): ModuleCacheEntry {
    let entry = moduleCache.get(identityPath)
    if (entry) return entry

    entry = { generation: 0 }
    moduleCache.set(identityPath, entry)
    return entry
  }

  function cacheEmittedModule(
    identityPath: string,
    emittedModule: EmittedModule,
    generation: number,
  ): EmittedModule {
    let entry = getModuleCacheEntry(identityPath)
    if (entry.generation !== generation) return emittedModule
    entry.emitted = emittedModule
    return emittedModule
  }

  function cacheTransformedModule(
    transformedModule: TransformedModule,
    generation: number,
  ): TransformedModule {
    let entry = getModuleCacheEntry(transformedModule.identityPath)
    if (entry.generation !== generation) return transformedModule
    entry.resolvedPath = transformedModule.resolvedPath
    entry.transformed = transformedModule
    updateTrackedState(transformedModule.identityPath, {
      depIdentityPaths: [],
      trackedFiles: transformedModule.trackedFiles,
      trackedResolutions: [],
    })
    return transformedModule
  }

  function cacheResolvedModule(resolvedModule: ResolvedModule, generation: number): ResolvedModule {
    let entry = getModuleCacheEntry(resolvedModule.identityPath)
    if (entry.generation !== generation) return resolvedModule
    entry.resolved = resolvedModule
    entry.resolvedPath = resolvedModule.resolvedPath
    updateTrackedState(resolvedModule.identityPath, {
      depIdentityPaths: resolvedModule.deps,
      trackedFiles: resolvedModule.trackedFiles,
      trackedResolutions: resolvedModule.trackedResolutions,
    })
    return resolvedModule
  }

  function updateTrackedState(
    identityPath: string,
    nextState: {
      depIdentityPaths: readonly string[]
      trackedFiles: readonly string[]
      trackedResolutions: readonly TrackedResolution[]
    },
  ) {
    let entry = getModuleCacheEntry(identityPath)

    for (let trackedFile of entry.trackedFiles ?? []) {
      removeFromIndexedSet(modulesByTrackedFile, trackedFile, identityPath)
    }
    for (let depIdentityPath of entry.resolved?.deps ?? []) {
      removeFromIndexedSet(importersByDependency, depIdentityPath, identityPath)
    }

    entry.trackedFiles = [...new Set(nextState.trackedFiles)]
    entry.trackedResolutions = [...nextState.trackedResolutions]

    for (let trackedFile of entry.trackedFiles) {
      addToIndexedSet(modulesByTrackedFile, trackedFile, identityPath)
    }
    for (let depIdentityPath of nextState.depIdentityPaths) {
      addToIndexedSet(importersByDependency, depIdentityPath, identityPath)
    }
  }

  function invalidateModuleAndImporters(identityPath: string, seen = new Set<string>()) {
    if (seen.has(identityPath)) return
    seen.add(identityPath)

    let importers = [...(importersByDependency.get(identityPath) ?? [])]
    clearModuleEntry(identityPath)

    for (let importerIdentityPath of importers) {
      invalidateModuleAndImporters(importerIdentityPath, seen)
    }
  }

  function clearModuleEntry(identityPath: string) {
    let entry = getModuleCacheEntry(identityPath)

    for (let trackedFile of entry.trackedFiles ?? []) {
      removeFromIndexedSet(modulesByTrackedFile, trackedFile, identityPath)
    }
    for (let depIdentityPath of entry.resolved?.deps ?? []) {
      removeFromIndexedSet(importersByDependency, depIdentityPath, identityPath)
    }

    entry.compileInFlight = undefined
    entry.emitted = undefined
    entry.generation += 1
    entry.resolved = undefined
    entry.resolveInFlight = undefined
    entry.trackedFiles = undefined
    entry.trackedResolutions = undefined
    entry.transformed = undefined
  }

  function invalidateAllModules() {
    for (let identityPath of moduleCache.keys()) {
      clearModuleEntry(identityPath)
    }
  }

  async function invalidateModulesForResolutionChange(filePath: string) {
    let affectedIdentityPaths = new Set<string>()

    for (let [identityPath, entry] of moduleCache) {
      for (let trackedResolution of entry.trackedResolutions ?? []) {
        if (!mayAffectTrackedResolution(trackedResolution, filePath)) continue

        let nextResolved = await resolveTrackedResolution(trackedResolution, identityPath)
        if (nextResolved !== trackedResolution.resolvedIdentityPath) {
          affectedIdentityPaths.add(identityPath)
          break
        }
      }
    }

    for (let identityPath of affectedIdentityPaths) {
      invalidateModuleAndImporters(identityPath)
    }
  }

  async function resolveTrackedResolution(
    trackedResolution: TrackedResolution,
    identityPath: string,
  ): Promise<string | null> {
    let entry = getModuleCacheEntry(identityPath)
    let importerPath = entry.transformed?.resolvedPath ?? entry.resolvedPath ?? identityPath
    let resolved = await batchResolveSpecifiers(
      [trackedResolution.specifier],
      importerPath,
      resolverFactory,
    )
    let resolvedSpec = resolved.get(trackedResolution.specifier)
    if (!resolvedSpec?.absolutePath) return null
    let resolvedModule = resolveModulePath(resolvedSpec.absolutePath)
    return resolvedModule?.identityPath ?? null
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

function resolveModulePath(absolutePath: string): ResolveModuleResult | null {
  let resolvedPath: string

  try {
    resolvedPath = normalizeFilePath(fs.realpathSync(normalizeFilePath(absolutePath)))
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }

  if (!supportedScriptExtensionSet.has(path.extname(resolvedPath).toLowerCase())) {
    return null
  }

  return {
    identityPath: resolvedPath,
    resolvedPath,
  }
}

function resolveActualPath(identityPath: string): string | null {
  try {
    return normalizeFilePath(fs.realpathSync(identityPath))
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
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

type TsconfigTransformOptions = {
  trackedFiles: string[]
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

  return {
    clear() {
      fileSystemCache = new Map()
      transformOptionsByDirectory.clear()
    },
    getTransformOptions(filePath: string): TsconfigTransformOptions {
      let directory = path.dirname(filePath)
      let cached = transformOptionsByDirectory.get(directory)
      if (cached) return cached

      let tsconfig = getTsconfig(directory, 'tsconfig.json', fileSystemCache)
      if (!tsconfig) {
        let transformOptions = { trackedFiles: [] }
        transformOptionsByDirectory.set(directory, transformOptions)
        return transformOptions
      }

      let transformOptions: TsconfigTransformOptions = {
        trackedFiles: (() => {
          let tsconfigPath = findNearestTsconfigPath(directory)
          return tsconfigPath ? [tsconfigPath] : []
        })(),
        tsconfigRaw: tsconfig.config,
      }

      transformOptionsByDirectory.set(directory, transformOptions)
      return transformOptions
    },
  }
}

function addToIndexedSet(map: Map<string, Set<string>>, key: string, value: string) {
  let existing = map.get(key) ?? new Set<string>()
  existing.add(value)
  map.set(key, existing)
}

function removeFromIndexedSet(map: Map<string, Set<string>>, key: string, value: string) {
  let existing = map.get(key)
  if (!existing) return
  existing.delete(value)
  if (existing.size === 0) {
    map.delete(key)
  }
}

function findNearestPackageJsonPath(filePath: string): string | null {
  let directory = path.dirname(filePath)

  while (true) {
    let packageJsonPath = path.join(directory, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      return normalizeFilePath(packageJsonPath)
    }

    let parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) return null
    directory = parentDirectory
  }
}

function findNearestTsconfigPath(directory: string): string | null {
  let currentDirectory = directory

  while (true) {
    let tsconfigPath = path.join(currentDirectory, 'tsconfig.json')
    if (fs.existsSync(tsconfigPath)) {
      return normalizeFilePath(tsconfigPath)
    }

    let parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return null
    currentDirectory = parentDirectory
  }
}

function isPackageImportSpecifier(specifier: string): boolean {
  return !isRelativeImportSpecifier(specifier) && !specifier.startsWith('/')
}

function isRelativeImportSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

function getTrackedRelativeImportResolution(
  importerDir: string,
  specifier: string,
): RelativeImportResolution | null {
  if (!isRelativeImportSpecifier(specifier)) return null

  let candidatePath = resolveCandidateBasePath(importerDir, specifier)
  let extension = path.extname(specifier)
  if (extension === '') {
    return {
      candidatePaths: [
        candidatePath,
        ...supportedScriptExtensions.map((extension) => `${candidatePath}${extension}`),
      ],
      candidatePrefixes: [`${candidatePath}/`],
      specifier,
    }
  }

  let candidateExtensions = resolverExtensionAlias[extension as keyof typeof resolverExtensionAlias]
  if (!candidateExtensions) return null

  return {
    candidatePaths: [
      candidatePath,
      ...candidateExtensions.map(
        (candidateExtension) =>
          `${candidatePath.slice(0, candidatePath.length - extension.length)}${candidateExtension}`,
      ),
    ],
    candidatePrefixes: [`${candidatePath}/`],
    specifier,
  }
}

function resolveCandidateBasePath(importerDir: string, specifier: string): string {
  return normalizeFilePath(path.resolve(importerDir, specifier))
}

function mayAffectTrackedResolution(
  trackedResolution: TrackedResolution,
  filePath: string,
): boolean {
  return (
    trackedResolution.candidatePaths.includes(filePath) ||
    trackedResolution.candidatePrefixes.some((prefix) => filePath.startsWith(prefix))
  )
}

function isPackageJsonPath(filePath: string): boolean {
  return path.posix.basename(filePath) === 'package.json'
}

function isTsconfigPath(filePath: string): boolean {
  return /^tsconfig(?:\..+)?\.json$/.test(path.posix.basename(filePath))
}

async function analyzeModuleSource(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: {
    define?: Record<string, string>
    minify: boolean
    sourceMaps?: 'external' | 'inline'
    target?: ScriptServerTarget
  },
) {
  let target = options.target
  let transformResult: { code: string; errors?: Array<{ message?: string }>; map?: unknown }
  try {
    transformResult = await transformModule(sourceText, resolvedPath, transformOptions, {
      define: options.define,
      sourceMaps: options.sourceMaps,
      target,
    })
  } catch (error) {
    if (isScriptServerCompilationError(error)) {
      throw error
    }
    throw createScriptServerCompilationError(
      `Failed to transform module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'MODULE_TRANSFORM_FAILED',
      },
    )
  }

  let rawCode = transformResult.code.trimEnd()
  let sourcemap = stringifySourceMap(transformResult.map)

  if (options.minify) {
    let minifyResult = await minifyModule(rawCode, resolvedPath, target, options.sourceMaps)
    rawCode = minifyResult.code.trimEnd()
    let minifyMap = stringifySourceMap(minifyResult.map)
    sourcemap =
      minifyMap == null
        ? sourcemap
        : sourcemap == null
          ? minifyMap
          : composeSourceMaps(minifyMap, sourcemap)
  }

  return {
    rawCode,
    sourcemap,
    unresolvedImports: await getUnresolvedImportsFromLexer(rawCode),
  }
}

async function transformModule(
  sourceText: string,
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: {
    define?: Record<string, string>
    sourceMaps?: 'external' | 'inline'
    target?: string
  },
) {
  let result = await oxcTransform(
    resolvedPath,
    sourceText,
    getTransformOptions(resolvedPath, transformOptions, options),
  )
  assertNoCompilerErrors(result.errors, resolvedPath, 'transform')
  return result
}

async function minifyModule(
  rawCode: string,
  resolvedPath: string,
  target: string | undefined,
  sourceMaps?: 'external' | 'inline',
) {
  try {
    let result = await minify(resolvedPath, rawCode, {
      compress: target ? { target } : true,
      mangle: true,
      module: true,
      sourcemap: sourceMaps != null,
    })
    assertNoCompilerErrors(result.errors, resolvedPath, 'minify')
    return result
  } catch (error) {
    if (isScriptServerCompilationError(error)) {
      throw error
    }
    throw createScriptServerCompilationError(
      `Failed to minify module ${resolvedPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'MODULE_TRANSFORM_FAILED',
      },
    )
  }
}

function getTransformOptions(
  resolvedPath: string,
  transformOptions: TsconfigTransformOptions,
  options: {
    define?: Record<string, string>
    sourceMaps?: 'external' | 'inline'
    target?: string
  },
) {
  let compilerOptions = transformOptions.tsconfigRaw?.compilerOptions as
    | Record<string, unknown>
    | undefined
  let useDefineForClassFields = getBooleanOption(compilerOptions, 'useDefineForClassFields')
  let jsxFactory = getStringOption(compilerOptions, 'jsxFactory')
  let jsxFragmentFactory = getStringOption(compilerOptions, 'jsxFragmentFactory')

  return {
    assumptions:
      useDefineForClassFields === false
        ? {
            setPublicClassFields: true,
          }
        : undefined,
    define: options.define,
    jsx: getJsxOptions(resolvedPath, compilerOptions),
    lang: getSourceLanguageForPath(resolvedPath),
    sourceType: 'module' as const,
    sourcemap: options.sourceMaps != null,
    target: options.target,
    typescript: {
      allowNamespaces: getBooleanOption(compilerOptions, 'allowNamespaces'),
      emitDecoratorMetadata: getBooleanOption(compilerOptions, 'emitDecoratorMetadata'),
      experimentalDecorators: getBooleanOption(compilerOptions, 'experimentalDecorators'),
      jsxPragma: jsxFactory,
      jsxPragmaFrag: jsxFragmentFactory,
      removeClassFieldsWithoutInitializer: useDefineForClassFields === false ? true : undefined,
    },
  }
}

function getJsxOptions(
  resolvedPath: string,
  compilerOptions?: Record<string, unknown>,
): 'preserve' | Record<string, unknown> | undefined {
  let language = getSourceLanguageForPath(resolvedPath)
  if (language !== 'jsx' && language !== 'tsx') return undefined

  let jsx = getStringOption(compilerOptions, 'jsx')
  let importSource = getStringOption(compilerOptions, 'jsxImportSource')
  let pragma = getStringOption(compilerOptions, 'jsxFactory')
  let pragmaFrag = getStringOption(compilerOptions, 'jsxFragmentFactory')

  if (jsx === 'preserve' || jsx === 'react-native') {
    return 'preserve'
  }

  if (jsx === 'react-jsx' || jsx === 'react-jsxdev') {
    return {
      development: jsx === 'react-jsxdev',
      importSource,
      runtime: 'automatic',
    }
  }

  return {
    pragma,
    pragmaFrag,
    runtime: 'classic',
  }
}

function getBooleanOption(
  compilerOptions: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  let value = compilerOptions?.[key]
  return typeof value === 'boolean' ? value : undefined
}

function getStringOption(
  compilerOptions: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  let value = compilerOptions?.[key]
  return typeof value === 'string' ? value : undefined
}

function stringifySourceMap(map: unknown): string | null {
  if (!map) return null
  if (typeof map === 'string') {
    return map
  }
  if (typeof map === 'object' && map !== null) {
    return JSON.stringify(map)
  }
  return String(map)
}

function assertNoCompilerErrors(
  errors: Array<{ message?: string }> | undefined,
  resolvedPath: string,
  operation: 'transform' | 'minify',
) {
  if (!errors || errors.length === 0) return

  throw createScriptServerCompilationError(
    `Failed to ${operation} module ${resolvedPath}.\n\n${errors[0].message ?? 'Unknown error'}`,
    {
      code: 'MODULE_TRANSFORM_FAILED',
    },
  )
}

async function batchResolveSpecifiers(
  specifiers: string[],
  importerPath: string,
  resolverFactory: ResolverFactory,
): Promise<Map<string, ResolvedSpec>> {
  let resolvedBySpecifier = new Map<string, ResolvedSpec>()
  if (specifiers.length === 0) return resolvedBySpecifier

  try {
    for (let specifier of specifiers) {
      let resolutionResult = await resolverFactory.resolveFileAsync(importerPath, specifier)
      if (resolutionResult.error) {
        throw createScriptServerCompilationError(
          `Failed to resolve import "${specifier}" in ${importerPath}.\n\n` +
            `Ensure it resolves to a file within the configured script-server routes, or mark it as external.`,
          {
            code: 'IMPORT_RESOLUTION_FAILED',
          },
        )
      }

      resolvedBySpecifier.set(specifier, {
        absolutePath:
          resolutionResult.path && path.isAbsolute(resolutionResult.path)
            ? normalizeFilePath(resolutionResult.path)
            : null,
        packageJsonPath: resolutionResult.packageJsonPath
          ? normalizeFilePath(resolutionResult.packageJsonPath)
          : null,
        specifier,
      })
    }
  } catch (error) {
    if (isScriptServerCompilationError(error) && error.code === 'IMPORT_RESOLUTION_FAILED') {
      throw error
    }

    throw createScriptServerCompilationError(
      `Failed to resolve imports in ${importerPath}.\n\n${formatUnknownError(error)}`,
      {
        cause: error,
        code: 'IMPORT_RESOLUTION_FAILED',
      },
    )
  }

  return resolvedBySpecifier
}

type ResolvedSpec = {
  absolutePath: string | null
  packageJsonPath: string | null
  specifier: string
}

function getUniqueSpecifiers(unresolvedImports: UnresolvedImport[]): string[] {
  return [...new Set(unresolvedImports.map((unresolved) => unresolved.specifier))]
}

async function getUnresolvedImportsFromLexer(rawCode: string): Promise<UnresolvedImport[]> {
  await esModuleLexerInit
  let [imports] = esModuleLexer(rawCode)
  let unresolvedImports: UnresolvedImport[] = []

  for (let imported of imports) {
    let specifier = getStaticImportSpecifier(rawCode, imported)
    if (specifier == null || shouldSkipImportSpecifier(specifier)) continue
    unresolvedImports.push({
      specifier,
      start: imported.s,
      end: imported.e,
      quote: getImportQuote(rawCode, imported.s),
    })
  }

  return unresolvedImports
}

function getStaticImportSpecifier(
  source: string,
  imported: ReturnType<typeof esModuleLexer>[0][number],
): string | null {
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

function shouldSkipImportSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('data:') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('https://')
  )
}

function getImportQuote(source: string, start: number): '"' | "'" | '`' | undefined {
  let firstCharacter = source[start]
  if (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === '`') {
    return firstCharacter
  }
  return undefined
}

function getSourceLanguageForPath(resolvedPath: string): SourceLanguage {
  let extension = path.extname(resolvedPath).toLowerCase()
  return sourceLanguageByExtension.get(extension) ?? 'js'
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
