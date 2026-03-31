import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getTsconfig } from 'get-tsconfig'
import { minify } from 'oxc-minify'
import { parseSync, visitorKeys } from 'oxc-parser'
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

const preloadTraversalConcurrency = getPreloadTraversalConcurrency()
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
const resolverExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.json']

export type ModuleCompileResult = {
  compiledCode: string
  compiledHash: string
  fingerprint: string
  sourcemap: string | null
  sourcemapHash: string | null
}

type TransformedModule = {
  extensionlessImports: ExtensionlessImport[]
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
  removeUnusedImports: boolean
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
  target?: ScriptServerTarget
}

type ResolvedOptions = ModuleCompilerOptions & {
  externalSet: Set<string>
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

type AstNode = {
  type: string
  [key: string]: unknown
}

type Identifier = AstNode & {
  name: string
}

type StaticImport = {
  end: number
  entries: Array<{
    isType: boolean
    localName: {
      value: string
    }
  }>
  moduleRequest: {
    end: number
    start: number
    value: string
  }
  start: number
}

type StaticExport = {
  entries: Array<{
    moduleRequest?: {
      end: number
      start: number
      value: string
    } | null
  }>
}

type DynamicImport = {
  moduleRequest: {
    end: number
    start: number
  }
}

type RewriteBuffer = {
  generateMap(): string
  overwrite(start: number, end: number, content: string): void
  remove(start: number, end: number): void
  toString(): string
}

type ParseResult = ReturnType<typeof parseSync>

type RemovedRange = {
  end: number
  start: number
}

type Scope = {
  bindings: Map<string, 'import' | 'local'>
  kind: 'block' | 'function' | 'module'
  parent: Scope | null
}

type ExtensionlessImport = {
  candidateBasePath: string
  specifier: string
}

function createResolverFactory() {
  return new ResolverFactory({
    tsconfig: 'auto',
    aliasFields: [['browser']],
    conditionNames: ['browser', 'import', 'module', 'default'],
    extensionAlias: {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    },
    extensions: resolverExtensions,
    mainFields: ['browser', 'module', 'main'],
  })
}

type TrackedResolution = ExtensionlessImport & {
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
  let resolvedOptions = resolveOptions(options)
  let moduleCache = new Map<string, ModuleCacheEntry>()
  let importersByDependency = new Map<string, Set<string>>()
  let modulesByTrackedFile = new Map<string, Set<string>>()
  let tsconfigTransformOptions = createTsconfigTransformOptionsResolver()
  let resolverFactory = createResolverFactory()

  function resolveSpecifiers(specifiers: string[], importerPath: string) {
    return batchResolveSpecifiers(specifiers, importerPath, resolverFactory)
  }

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
    let existing = getCachedEmittedModule(resolvedSourceModule.identityPath)
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
    let rewrittenSource = createRewriteBuffer(resolvedModule.rawCode)

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
        ? composeSourceMaps(rewrittenSource.generateMap(), resolvedModule.sourcemap)
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
    let cachedResolvedModule = getCachedResolvedModule(identityPath)
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
      removeUnusedImports: resolvedOptions.removeUnusedImports,
      resolveSpecifiers,
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
        extensionlessImports: getExtensionlessImports(
          analysis.unresolvedImports,
          path.dirname(nextResolvedPath),
        ),
        fingerprint: await hashContent(sourceText + '\0' + (resolvedOptions.buildId ?? '')),
        identityPath,
        importerDir: path.dirname(nextResolvedPath),
        packageSpecifiers: getPackageSpecifiers(analysis.unresolvedImports),
        rawCode: analysis.rawCode,
        resolvedPath: nextResolvedPath,
        sourcemap,
        stableUrlPathname,
        trackedFiles: [
          nextResolvedPath,
          ...transformOptions.trackedFiles,
          ...analysis.trackedFiles,
        ],
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
        ? await resolveSpecifiers(
            getUniqueSpecifiers(transformedModule.unresolvedImports),
            transformedModule.resolvedPath,
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
      if (!path.extname(unresolved.specifier) && isRelativeImportSpecifier(unresolved.specifier)) {
        trackedResolutions.push({
          candidateBasePath: resolveCandidateBasePath(
            transformedModule.importerDir,
            unresolved.specifier,
          ),
          resolvedIdentityPath: resolvedImport.identityPath,
          specifier: unresolved.specifier,
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

  function getCachedEmittedModule(identityPath: string): EmittedModule | null {
    let entry = getModuleCacheEntry(identityPath)
    if (entry.emitted) return entry.emitted
    return null
  }

  function getCachedResolvedModule(identityPath: string): ResolvedModule | null {
    let entry = getModuleCacheEntry(identityPath)
    if (entry.resolved) return entry.resolved
    return null
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
    externalSet: new Set(options.external),
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

  if (!isSupportedScriptPath(resolvedPath)) {
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
  trackedFiles: string[]
  unresolvedImports: UnresolvedImport[]
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
        trackedFiles: getTrackedTsconfigFiles(directory),
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

function getTrackedTsconfigFiles(directory: string): string[] {
  let tsconfigPath = findNearestTsconfigPath(directory)
  return tsconfigPath ? [tsconfigPath] : []
}

function getExtensionlessImports(
  unresolvedImports: UnresolvedImport[],
  importerDir: string,
): ExtensionlessImport[] {
  return unresolvedImports
    .filter((unresolved) => isTrackedExtensionlessImport(unresolved.specifier))
    .map((unresolved) => ({
      candidateBasePath: resolveCandidateBasePath(importerDir, unresolved.specifier),
      specifier: unresolved.specifier,
    }))
}

function getPackageSpecifiers(unresolvedImports: UnresolvedImport[]): string[] {
  return unresolvedImports
    .filter((unresolved) => isPackageImportSpecifier(unresolved.specifier))
    .map((unresolved) => unresolved.specifier)
}

function isPackageImportSpecifier(specifier: string): boolean {
  return !isRelativeImportSpecifier(specifier) && !specifier.startsWith('/')
}

function isRelativeImportSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

function isTrackedExtensionlessImport(specifier: string): boolean {
  if (!isRelativeImportSpecifier(specifier)) return false
  return path.extname(specifier) === ''
}

function resolveCandidateBasePath(importerDir: string, specifier: string): string {
  return normalizeFilePath(path.resolve(importerDir, specifier))
}

function mayAffectTrackedResolution(
  trackedResolution: TrackedResolution,
  filePath: string,
): boolean {
  return (
    filePath === trackedResolution.candidateBasePath ||
    filePath.startsWith(`${trackedResolution.candidateBasePath}/`) ||
    filePath.startsWith(`${trackedResolution.candidateBasePath}.`)
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
    removeUnusedImports: boolean
    resolveSpecifiers(
      specifiers: string[],
      importerPath: string,
    ): Promise<Map<string, ResolvedSpec>>
    sourceMaps?: 'external' | 'inline'
    target?: ScriptServerTarget
  },
): Promise<ModuleAnalysisResult> {
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

  if (!options.removeUnusedImports) {
    return {
      rawCode,
      sourcemap,
      trackedFiles: [],
      unresolvedImports: await getUnresolvedImportsFromLexer(rawCode),
    }
  }

  let pruned = await pruneUnusedImports(
    rawCode,
    resolvedPath,
    sourceText,
    sourcemap,
    options.resolveSpecifiers,
  )

  return {
    rawCode: pruned.rawCode,
    sourcemap: pruned.sourcemap,
    trackedFiles: pruned.trackedFiles,
    unresolvedImports: pruned.unresolvedImports,
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

function createRewriteBuffer(sourceText: string): RewriteBuffer {
  let magicString = new MagicString(sourceText)

  return {
    generateMap() {
      return magicString.generateMap({ hires: true }).toString()
    },
    overwrite(start, end, content) {
      magicString.overwrite(start, end, content)
    },
    remove(start, end) {
      magicString.remove(start, end)
    },
    toString() {
      return magicString.toString()
    },
  }
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

  let resolvedSpecs = await resolveSpecifiersWithResolver(specifiers, importerPath, resolverFactory)
  for (let resolvedSpec of resolvedSpecs) {
    resolvedBySpecifier.set(resolvedSpec.specifier, resolvedSpec)
  }

  return resolvedBySpecifier
}

type ResolvedSpec = {
  absolutePath: string | null
  packageJsonPath: string | null
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

type ParsedImportRecord = ReturnType<typeof esModuleLexer>[0][number]

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

function shouldSkipImportSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('data:') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('https://')
  )
}

function getDynamicImportSpecifier(
  rawCode: string,
  imported: DynamicImport,
): UnresolvedImport | null {
  let rawSpecifier = rawCode.slice(imported.moduleRequest.start, imported.moduleRequest.end)
  if (
    (rawSpecifier.startsWith('"') && rawSpecifier.endsWith('"')) ||
    (rawSpecifier.startsWith("'") && rawSpecifier.endsWith("'"))
  ) {
    return {
      specifier: rawSpecifier.slice(1, -1),
      start: imported.moduleRequest.start,
      end: imported.moduleRequest.end,
      quote: getImportQuote(rawCode, imported.moduleRequest.start),
    }
  }

  if (isStaticTemplateLiteral(rawSpecifier)) {
    return {
      specifier: rawSpecifier.slice(1, -1),
      start: imported.moduleRequest.start,
      end: imported.moduleRequest.end,
      quote: '"',
    }
  }

  return null
}

function getImportQuote(source: string, start: number): '"' | "'" | '`' | undefined {
  let firstCharacter = source[start]
  if (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === '`') {
    return firstCharacter
  }
  return undefined
}

async function pruneUnusedImports(
  rawCode: string,
  resolvedPath: string,
  sourceText: string,
  sourcemap: string | null,
  resolveSpecifiers: (
    specifiers: string[],
    importerPath: string,
  ) => Promise<Map<string, ResolvedSpec>>,
): Promise<{
  rawCode: string
  sourcemap: string | null
  trackedFiles: string[]
  unresolvedImports: UnresolvedImport[]
}> {
  let parseResult = parseJavaScript(rawCode, resolvedPath)
  let staticImports = parseResult.module.staticImports as StaticImport[]
  let originalImportSpecifiers = getOriginalNonBareImportSpecifiers(sourceText, resolvedPath)
  let removableImports = staticImports.filter(
    (imported) =>
      imported.entries.length > 0 || originalImportSpecifiers.has(imported.moduleRequest.value),
  )
  if (removableImports.length === 0) {
    return {
      rawCode,
      sourcemap,
      trackedFiles: [],
      unresolvedImports: getUnresolvedImportsFromParsedModule(rawCode, parseResult),
    }
  }

  let usedImportedBindings = getUsedImportedBindings(
    parseResult.program as unknown as AstNode,
    removableImports,
  )
  let unusedImports = removableImports.filter((imported) =>
    imported.entries.every(
      (entry) => entry.isType || !usedImportedBindings.has(entry.localName.value),
    ),
  )
  if (unusedImports.length === 0) {
    return {
      rawCode,
      sourcemap,
      trackedFiles: [],
      unresolvedImports: getUnresolvedImportsFromParsedModule(rawCode, parseResult),
    }
  }

  let resolvedSpecifiers = await resolveSpecifiers(
    getUniqueImportSpecifiers(unusedImports),
    resolvedPath,
  )

  let rewrittenSource = createRewriteBuffer(rawCode)
  let trackedFiles = new Set<string>()
  let didPrune = false
  let removedImports = new Set<StaticImport>()
  let removedRanges: RemovedRange[] = []

  for (let imported of unusedImports) {
    let resolvedSpec = resolvedSpecifiers.get(imported.moduleRequest.value)
    if (!resolvedSpec?.absolutePath) continue

    let resolvedImport = resolveModulePath(resolvedSpec.absolutePath)
    if (!resolvedImport) continue

    let packageJsonPath =
      resolvedSpec.packageJsonPath ?? findNearestPackageJsonPath(resolvedImport.resolvedPath)
    if (!packageJsonPath) continue

    if (!isSideEffectFreeModule(packageJsonPath, resolvedImport.resolvedPath)) continue

    let removableEnd = getImportRemovalEnd(rawCode, imported.end)
    rewrittenSource.remove(imported.start, removableEnd)
    removedImports.add(imported)
    removedRanges.push({ start: imported.start, end: removableEnd })
    trackedFiles.add(packageJsonPath)
    didPrune = true
  }

  if (!didPrune) {
    return {
      rawCode,
      sourcemap,
      trackedFiles: [...trackedFiles],
      unresolvedImports: getUnresolvedImportsFromParsedModule(rawCode, parseResult),
    }
  }

  let prunedCode = rewrittenSource.toString().trimEnd()
  let prunedSourcemap =
    sourcemap !== null ? composeSourceMaps(rewrittenSource.generateMap(), sourcemap) : null

  return {
    rawCode: prunedCode,
    sourcemap: prunedSourcemap,
    trackedFiles: [...trackedFiles],
    unresolvedImports: getUnresolvedImportsFromParsedModule(prunedCode, parseResult, {
      removedImports,
      remapPosition: createPositionRemapper(removedRanges),
    }),
  }
}

function getUniqueImportSpecifiers(imports: StaticImport[]): string[] {
  return [...new Set(imports.map((imported) => imported.moduleRequest.value))]
}

function getUnresolvedImportsFromParsedModule(
  rawCode: string,
  parseResult: ParseResult,
  options: {
    removedImports?: Set<StaticImport>
    remapPosition?: (position: number) => number
  } = {},
): UnresolvedImport[] {
  let unresolvedImports: UnresolvedImport[] = []
  let removedImports = options.removedImports ?? new Set<StaticImport>()
  let remapPosition = options.remapPosition ?? ((position: number) => position)

  for (let imported of parseResult.module.staticImports as StaticImport[]) {
    if (removedImports.has(imported) || shouldSkipImportSpecifier(imported.moduleRequest.value))
      continue
    unresolvedImports.push({
      specifier: imported.moduleRequest.value,
      start: remapPosition(imported.moduleRequest.start),
      end: remapPosition(imported.moduleRequest.end),
      quote: getImportQuote(rawCode, remapPosition(imported.moduleRequest.start)),
    })
  }

  for (let exported of parseResult.module.staticExports as StaticExport[]) {
    for (let entry of exported.entries) {
      let moduleRequest = entry.moduleRequest
      if (!moduleRequest || shouldSkipImportSpecifier(moduleRequest.value)) continue
      let start = remapPosition(moduleRequest.start)
      unresolvedImports.push({
        specifier: moduleRequest.value,
        start,
        end: remapPosition(moduleRequest.end),
        quote: getImportQuote(rawCode, start),
      })
    }
  }

  for (let imported of parseResult.module.dynamicImports as DynamicImport[]) {
    let start = remapPosition(imported.moduleRequest.start)
    let end = remapPosition(imported.moduleRequest.end)
    let dynamicImport = getDynamicImportSpecifier(rawCode, {
      moduleRequest: { start, end },
    })
    if (dynamicImport && !shouldSkipImportSpecifier(dynamicImport.specifier)) {
      unresolvedImports.push(dynamicImport)
    }
  }

  return unresolvedImports
}

function createPositionRemapper(removedRanges: RemovedRange[]): (position: number) => number {
  if (removedRanges.length === 0) {
    return (position) => position
  }

  let sortedRanges = [...removedRanges].sort((left, right) => left.start - right.start)
  return (position: number) => {
    let offset = 0
    for (let range of sortedRanges) {
      if (position < range.start) break
      offset += range.end - range.start
    }
    return position - offset
  }
}

function getImportRemovalEnd(source: string, end: number): number {
  if (source[end] === '\r' && source[end + 1] === '\n') return end + 2
  if (source[end] === '\n') return end + 1
  return end
}

function parseJavaScript(sourceText: string, resolvedPath: string) {
  let result = parseSync(resolvedPath, sourceText, {
    lang: getOutputLanguageForPath(resolvedPath),
    sourceType: 'module',
  })
  if (result.errors.length > 0) {
    throw createScriptServerCompilationError(
      `Failed to analyze transformed module ${resolvedPath}.\n\n${result.errors[0].message}`,
      {
        code: 'MODULE_TRANSFORM_FAILED',
      },
    )
  }
  return result
}

function getOutputLanguageForPath(resolvedPath: string): 'js' | 'jsx' {
  let extension = path.extname(resolvedPath).toLowerCase()
  return extension === '.jsx' || extension === '.tsx' ? 'jsx' : 'js'
}

function getSourceLanguageForPath(resolvedPath: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  let extension = path.extname(resolvedPath).toLowerCase()
  return sourceLanguageByExtension.get(extension) ?? 'js'
}

function getOriginalNonBareImportSpecifiers(sourceText: string, resolvedPath: string): Set<string> {
  let result = parseSync(resolvedPath, sourceText, {
    lang: getSourceLanguageForPath(resolvedPath),
    sourceType: 'module',
  })
  if (result.errors.length > 0) {
    return new Set()
  }

  return new Set(
    (result.module.staticImports as StaticImport[])
      .filter((imported) => imported.entries.length > 0)
      .map((imported) => imported.moduleRequest.value),
  )
}

function getUsedImportedBindings(program: AstNode, staticImports: StaticImport[]): Set<string> {
  let importedBindingNames = new Set<string>()
  for (let imported of staticImports) {
    for (let entry of imported.entries) {
      if (!entry.isType) {
        importedBindingNames.add(entry.localName.value)
      }
    }
  }
  if (importedBindingNames.size === 0) return new Set()

  let moduleScope = createScope(null, 'module')
  let nodeScopes = new WeakMap<object, Scope>()
  nodeScopes.set(program, moduleScope)
  collectScopeBindings(program, moduleScope, nodeScopes)

  let usedBindings = new Set<string>()
  walkReferences(program, nodeScopes, moduleScope, (name, scope) => {
    if (resolveBindingKind(name, scope) !== 'import') return
    if (importedBindingNames.has(name)) {
      usedBindings.add(name)
    }
  })

  return usedBindings
}

function collectScopeBindings(
  node: AstNode,
  currentScope: Scope,
  nodeScopes: WeakMap<object, Scope>,
) {
  switch (node.type) {
    case 'Program': {
      forEachChildNode(node, (child) => {
        collectScopeBindings(child, currentScope, nodeScopes)
      })
      return
    }
    case 'ImportDeclaration': {
      for (let specifier of getNodeArray(node.specifiers)) {
        if (isAstNode(specifier) && isIdentifier(specifier.local)) {
          currentScope.bindings.set(specifier.local.name, 'import')
        }
      }
      return
    }
    case 'VariableDeclaration': {
      let targetScope = node.kind === 'var' ? getFunctionScope(currentScope) : currentScope
      for (let declaration of getNodeArray(node.declarations)) {
        if (isAstNode(declaration)) {
          collectPatternBindings(declaration.id, targetScope)
          if (isAstNode(declaration.init)) {
            collectScopeBindings(declaration.init, currentScope, nodeScopes)
          }
        }
      }
      return
    }
    case 'FunctionDeclaration': {
      if (isIdentifier(node.id)) {
        currentScope.bindings.set(node.id.name, 'local')
      }
      let functionScope = createScope(currentScope, 'function')
      nodeScopes.set(node, functionScope)
      if (isIdentifier(node.id)) {
        functionScope.bindings.set(node.id.name, 'local')
      }
      for (let param of getNodeArray(node.params)) {
        collectPatternBindings(param, functionScope)
      }
      for (let param of getNodeArray(node.params)) {
        collectPatternReferenceBindings(param, functionScope, nodeScopes)
      }
      if (isAstNode(node.body)) {
        collectScopeBindings(node.body, functionScope, nodeScopes)
      }
      return
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      let functionScope = createScope(currentScope, 'function')
      nodeScopes.set(node, functionScope)
      if (node.type === 'FunctionExpression' && isIdentifier(node.id)) {
        functionScope.bindings.set(node.id.name, 'local')
      }
      for (let param of getNodeArray(node.params)) {
        collectPatternBindings(param, functionScope)
      }
      for (let param of getNodeArray(node.params)) {
        collectPatternReferenceBindings(param, functionScope, nodeScopes)
      }
      if (isAstNode(node.body)) {
        collectScopeBindings(node.body, functionScope, nodeScopes)
      }
      return
    }
    case 'ClassDeclaration': {
      if (isIdentifier(node.id)) {
        currentScope.bindings.set(node.id.name, 'local')
      }
      break
    }
    case 'ClassExpression': {
      if (isIdentifier(node.id)) {
        let classScope = createScope(currentScope, 'block')
        classScope.bindings.set(node.id.name, 'local')
        nodeScopes.set(node, classScope)
        forEachChildNode(node, (child, key) => {
          if (key !== 'id') {
            collectScopeBindings(child, classScope, nodeScopes)
          }
        })
        return
      }
      break
    }
    case 'BlockStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'SwitchStatement': {
      let nextScope = createScope(currentScope, 'block')
      nodeScopes.set(node, nextScope)
      forEachChildNode(node, (child) => {
        collectScopeBindings(child, nextScope, nodeScopes)
      })
      return
    }
    case 'CatchClause': {
      let catchScope = createScope(currentScope, 'block')
      nodeScopes.set(node, catchScope)
      collectPatternBindings(node.param, catchScope)
      if (isAstNode(node.param)) {
        collectPatternReferenceBindings(node.param, catchScope, nodeScopes)
      }
      if (isAstNode(node.body)) {
        collectScopeBindings(node.body, catchScope, nodeScopes)
      }
      return
    }
  }

  forEachChildNode(node, (child) => {
    collectScopeBindings(child, currentScope, nodeScopes)
  })
}

function collectPatternBindings(node: unknown, scope: Scope): void {
  if (!isAstNode(node)) return

  switch (node.type) {
    case 'Identifier':
      if (isIdentifier(node)) {
        scope.bindings.set(node.name, 'local')
      }
      return
    case 'RestElement':
      collectPatternBindings(node.argument, scope)
      return
    case 'AssignmentPattern':
      collectPatternBindings(node.left, scope)
      return
    case 'ArrayPattern':
      for (let element of getNodeArray(node.elements)) {
        collectPatternBindings(element, scope)
      }
      return
    case 'ObjectPattern':
      for (let property of getNodeArray(node.properties)) {
        if (!isAstNode(property)) continue
        if (property.type === 'Property') {
          collectPatternBindings(property.value, scope)
        } else {
          collectPatternBindings(property.argument, scope)
        }
      }
      return
  }
}

function collectPatternReferenceBindings(
  node: unknown,
  currentScope: Scope,
  nodeScopes: WeakMap<object, Scope>,
): void {
  if (!isAstNode(node)) return

  switch (node.type) {
    case 'AssignmentPattern':
      collectPatternReferenceBindings(node.left, currentScope, nodeScopes)
      if (isAstNode(node.right)) {
        collectScopeBindings(node.right, currentScope, nodeScopes)
      }
      return
    case 'ArrayPattern':
      for (let element of getNodeArray(node.elements)) {
        collectPatternReferenceBindings(element, currentScope, nodeScopes)
      }
      return
    case 'ObjectPattern':
      for (let property of getNodeArray(node.properties)) {
        if (!isAstNode(property)) continue
        if (property.type === 'Property') {
          if (property.computed && isAstNode(property.key)) {
            collectScopeBindings(property.key, currentScope, nodeScopes)
          }
          collectPatternReferenceBindings(property.value, currentScope, nodeScopes)
        } else {
          collectPatternReferenceBindings(property.argument, currentScope, nodeScopes)
        }
      }
      return
    case 'RestElement':
      collectPatternReferenceBindings(node.argument, currentScope, nodeScopes)
      return
  }
}

function walkReferences(
  node: AstNode,
  nodeScopes: WeakMap<object, Scope>,
  currentScope: Scope,
  onReference: (name: string, scope: Scope) => void,
  parent: AstNode | null = null,
  key?: string,
): void {
  let nextScope = nodeScopes.get(node) ?? currentScope

  switch (node.type) {
    case 'ImportDeclaration':
      return
    case 'VariableDeclarator':
      if (isAstNode(node.init)) {
        walkReferences(node.init, nodeScopes, nextScope, onReference, node, 'init')
      }
      walkPatternReferences(node.id, nodeScopes, nextScope, onReference)
      return
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      for (let param of getNodeArray(node.params)) {
        walkPatternReferences(param, nodeScopes, nextScope, onReference)
      }
      if (isAstNode(node.body)) {
        walkReferences(node.body, nodeScopes, nextScope, onReference, node, 'body')
      }
      return
    case 'CatchClause':
      walkPatternReferences(node.param, nodeScopes, nextScope, onReference)
      if (isAstNode(node.body)) {
        walkReferences(node.body, nodeScopes, nextScope, onReference, node, 'body')
      }
      return
    case 'Property':
      if (node.computed && isAstNode(node.key)) {
        walkReferences(node.key, nodeScopes, nextScope, onReference, node, 'key')
      }
      if (isAstNode(node.value)) {
        walkReferences(node.value, nodeScopes, nextScope, onReference, node, 'value')
      }
      return
    case 'MemberExpression':
      if (isAstNode(node.object)) {
        walkReferences(node.object, nodeScopes, nextScope, onReference, node, 'object')
      }
      if (node.computed && isAstNode(node.property)) {
        walkReferences(node.property, nodeScopes, nextScope, onReference, node, 'property')
      }
      return
    case 'ExportSpecifier':
      if (isAstNode(node.local)) {
        walkReferences(node.local, nodeScopes, nextScope, onReference, node, 'local')
      }
      return
    case 'Identifier':
      if (isIdentifier(node) && isReferenceIdentifier(node, parent, key)) {
        onReference(node.name, nextScope)
      }
      return
  }

  forEachChildNode(node, (child, childKey) => {
    walkReferences(child, nodeScopes, nextScope, onReference, node, childKey)
  })
}

function walkPatternReferences(
  node: unknown,
  nodeScopes: WeakMap<object, Scope>,
  currentScope: Scope,
  onReference: (name: string, scope: Scope) => void,
): void {
  if (!isAstNode(node)) return

  switch (node.type) {
    case 'Identifier':
      return
    case 'AssignmentPattern':
      walkPatternReferences(node.left, nodeScopes, currentScope, onReference)
      if (isAstNode(node.right)) {
        walkReferences(node.right, nodeScopes, currentScope, onReference)
      }
      return
    case 'RestElement':
      walkPatternReferences(node.argument, nodeScopes, currentScope, onReference)
      return
    case 'ArrayPattern':
      for (let element of getNodeArray(node.elements)) {
        walkPatternReferences(element, nodeScopes, currentScope, onReference)
      }
      return
    case 'ObjectPattern':
      for (let property of getNodeArray(node.properties)) {
        if (!isAstNode(property)) continue
        if (property.type === 'Property') {
          if (property.computed && isAstNode(property.key)) {
            walkReferences(property.key, nodeScopes, currentScope, onReference, property, 'key')
          }
          walkPatternReferences(property.value, nodeScopes, currentScope, onReference)
        } else {
          walkPatternReferences(property.argument, nodeScopes, currentScope, onReference)
        }
      }
      return
  }
}

function resolveBindingKind(name: string, currentScope: Scope): 'import' | 'local' | null {
  let scope: Scope | null = currentScope
  while (scope !== null) {
    let binding = scope.bindings.get(name)
    if (binding) return binding
    scope = scope.parent
  }
  return null
}

function createScope(parent: Scope | null, kind: Scope['kind']): Scope {
  return {
    bindings: new Map(),
    kind,
    parent,
  }
}

function getFunctionScope(scope: Scope): Scope {
  let current = scope
  while (current.kind === 'block' && current.parent !== null) {
    current = current.parent
  }
  return current
}

function isReferenceIdentifier(node: Identifier, parent: AstNode | null, key?: string): boolean {
  if (parent === null) return false
  if (parent.type === 'Property' && key === 'key' && !parent.computed) {
    return false
  }
  if (
    (parent.type === 'MemberExpression' ||
      parent.type === 'PropertyDefinition' ||
      parent.type === 'MethodDefinition') &&
    key === (parent.type === 'MemberExpression' ? 'property' : 'key') &&
    !parent.computed
  ) {
    return false
  }
  if (parent.type === 'MetaProperty') return false
  if (
    (parent.type === 'LabeledStatement' ||
      parent.type === 'BreakStatement' ||
      parent.type === 'ContinueStatement') &&
    key === 'label'
  ) {
    return false
  }
  if (parent.type === 'ExportSpecifier' && key === 'exported') return false
  return true
}

function forEachChildNode(node: AstNode, callback: (child: AstNode, key: string) => void): void {
  for (let key of visitorKeys[node.type] ?? []) {
    let value = node[key]
    if (Array.isArray(value)) {
      for (let child of value) {
        if (isAstNode(child)) {
          callback(child, key)
        }
      }
      continue
    }
    if (isAstNode(value)) {
      callback(value, key)
    }
  }
}

function getNodeArray(value: unknown): AstNode[] {
  return Array.isArray(value) ? value.filter(isAstNode) : []
}

function isAstNode(node: unknown): node is AstNode {
  return !!node && typeof node === 'object' && 'type' in node && typeof node.type === 'string'
}

function isIdentifier(node: unknown): node is Identifier {
  return isAstNode(node) && node.type === 'Identifier' && typeof node.name === 'string'
}

function isSideEffectFreeModule(packageJsonPath: string, resolvedPath: string): boolean {
  let sideEffects = readPackageSideEffects(packageJsonPath)
  if (sideEffects == null || sideEffects === true) return false
  if (sideEffects === false) return true

  let packageRoot = normalizeFilePath(path.dirname(packageJsonPath))
  let relativePath = normalizeFilePath(path.relative(packageRoot, resolvedPath))
  return !sideEffects.some((pattern) => matchesSideEffectPattern(relativePath, pattern))
}

function readPackageSideEffects(packageJsonPath: string): boolean | string[] | null {
  try {
    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
      sideEffects?: unknown
    }
    if (typeof packageJson.sideEffects === 'boolean') {
      return packageJson.sideEffects
    }
    if (Array.isArray(packageJson.sideEffects)) {
      return packageJson.sideEffects.filter(
        (pattern): pattern is string => typeof pattern === 'string',
      )
    }
  } catch {
    // Invalid package metadata should conservatively keep imports in place.
  }

  return null
}

function matchesSideEffectPattern(relativePath: string, pattern: string): boolean {
  let normalizedPath = relativePath.replace(/\\/g, '/')
  let normalizedPattern = pattern.replace(/\\/g, '/').replace(/^\.\//, '')
  return path.posix.matchesGlob(normalizedPath, normalizedPattern)
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

async function resolveSpecifiersWithResolver(
  specifiers: string[],
  importerPath: string,
  resolverFactory: ResolverFactory,
): Promise<ResolvedSpec[]> {
  let resolvedSpecs: ResolvedSpec[] = []

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

      resolvedSpecs.push({
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
