import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { getTsconfig } from 'get-tsconfig'

import { createAssetServerCompilationError } from '../compilation-error.ts'
import { createFileMatcher } from '../file-matcher.ts'
import { formatFingerprintedPathname } from '../fingerprint.ts'
import { emitResolvedModule } from './emit.ts'
import { createBarrelFileImportOptimizer } from './optimize-barrel-file-imports.ts'
import { normalizeFilePath, resolveInputFilePath } from '../paths.ts'
import {
  resolveModule,
  resolverExtensionAlias,
  resolverExtensions,
  supportedScriptExtensions,
} from './resolve.ts'
import type { ResolveArgs, ResolvedModule } from './resolve.ts'
import { isBareImportSpecifier } from './specifiers.ts'
import type { CompiledRoutes } from '../routes.ts'
import type { ResolvedScriptTarget } from '../target.ts'
import { createModuleStore } from '../module-store.ts'
import type { ModuleLoader } from '../loaders.ts'
import type {
  FileSnapshot,
  ModuleRecord,
  ModuleSnapshot,
  ModuleStore,
  ModuleWatchEvent,
} from '../module-store.ts'
import { createTsconfigTransformOptionsResolver, transformModule } from './transform.ts'
import type { ResolveModuleResult, TransformArgs, TransformedModule } from './transform.ts'
import { ResolverFactory } from 'oxc-resolver'
import type { NapiResolveOptions } from 'oxc-resolver'
import type { EmittedModule } from './emit.ts'
import type { EmittedAsset } from '../fingerprint.ts'
import {
  appendTimestampQuery,
  createRealFilePathCache,
  getCacheKey,
  getCompiledAssetByteSize,
  getEmittedAssetForRequest,
  getFileSnapshot,
  getNotModifiedResult,
  isFresh,
  mapWithConcurrency,
} from '../compiler-utils.ts'

type ScriptRecord = ModuleRecord<TransformedModule, ResolvedModule, EmittedModule>
type ScriptStore = ModuleStore<TransformedModule, ResolvedModule, EmittedModule>

type ScriptCompileResult = {
  code: EmittedAsset
  fingerprint: string | null
  sourceMap: EmittedAsset | null
}

export type ScriptImportMap = {
  imports: Record<string, string>
  scopes?: Record<string, Record<string, string>>
}

type ScriptGetResult =
  | {
      script: ScriptCompileResult
      type: 'script'
    }
  | {
      type: 'not-modified'
      etag: string
    }

type ScriptGetOptions = {
  ifNoneMatch: string | null
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
}

type ScriptCompilerOptions = {
  define?: Record<string, string>
  external: string[]
  fingerprintAssets: boolean
  hmr?: {
    clientPathname: string
  }
  isAllowed(absolutePath: string): boolean
  minify: boolean
  loaders: readonly ModuleLoader[]
  onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  onWatchFilesChange?: (delta: { add: string[]; remove: string[] }) => void
  rootDir: string
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
  target?: ResolvedScriptTarget
  watchIgnore?: readonly string[]
  watchMode: boolean
}

type ScriptCompiler = {
  getScript(filePath: string, options: ScriptGetOptions): Promise<ScriptGetResult>
  getScriptEntry(
    filePath: string,
    options?: { extraImportMapRoots?: readonly string[] },
  ): Promise<{ href: string; importMap: ScriptImportMap; preloads: string[] }>
  getPreloadLayers(filePath: string | readonly string[]): Promise<string[][]>
  getImportMap(filePath: string | readonly string[]): Promise<ScriptImportMap>
  getHref(filePath: string): Promise<string>
  resolveSpecifierFromRoot(specifier: string): Promise<ResolvedScriptSpecifier>
  classifyHmrFileEvent(filePath: string, event: ModuleWatchEvent): Promise<ScriptHmrUpdate[]>
  invalidateFileEvent(filePath: string, event: ModuleWatchEvent): void
}

type ResolvedScriptSpecifier = {
  href: string
  identityPath: string
}

export type ScriptHmrUpdate =
  | {
      accepted: false
      filePath: string
      path: string
      timestamp: number
    }
  | {
      accepted: true
      acceptedFilePath: string
      acceptedUrlPathname: string
      filePath: string
      path: string
      timestamp: number
    }

type ScriptHmrBoundary = {
  acceptedModule: ResolvedModule
  boundaryModule: ResolvedModule
  propagationPath: readonly string[]
}

type DirectoryTsconfig = {
  fileIndependent: boolean
  path: string | null
}

const supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)
const scriptConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1))
const maxScriptEmittedBytes = 128 * 1024 * 1024

export function createScriptCompiler(options: ScriptCompilerOptions): ScriptCompiler {
  let resolvedOptions = {
    ...options,
    externalSet: new Set(options.external),
    watchIgnoreMatchers: (options.watchIgnore ?? []).map((pattern) =>
      createFileMatcher(pattern, options.rootDir),
    ),
  }
  let barrelFileImportOptimizer = createBarrelFileImportOptimizer()
  let realPathCache = createRealFilePathCache()
  let nearestPackageJsonByDir = new Map<string, string | null>()
  let scriptStore: ScriptStore = createModuleStore<
    TransformedModule,
    ResolvedModule,
    EmittedModule
  >({
    getAcceptedDependencies(resolvedModule) {
      return resolvedModule.hmr.acceptedDeps.map((acceptedDep) => acceptedDep.depPath)
    },
    getDependencies(resolvedModule) {
      return resolvedModule.deps
    },
    getEmittedByteSize: getCompiledAssetByteSize,
    invalidateImportersOnFileEvent: true,
    maxEmittedBytes: maxScriptEmittedBytes,
    onEmittedEvicted(identityPath) {
      barrelFileImportOptimizer.invalidate(identityPath)
    },
    onWatchDirectoriesChange: options.onWatchDirectoriesChange,
    onWatchFilesChange: options.onWatchFilesChange,
    retainIntermediate: resolvedOptions.watchMode,
    retainLastResolved: resolvedOptions.watchMode,
  })
  let tsconfigTransformOptionsResolver = createTsconfigTransformOptionsResolver()
  let resolverOptions = {
    aliasFields: [['browser']],
    conditionNames: ['browser', 'import', 'module', 'default'],
    extensionAlias: resolverExtensionAlias,
    extensions: resolverExtensions,
    mainFields: ['browser', 'module', 'main'],
  } satisfies NapiResolveOptions
  let resolverFactory = new ResolverFactory({ ...resolverOptions, tsconfig: 'auto' })
  let directoryResolverByTsconfig = new Map<string | null, ResolverFactory>()
  let tsconfigByDirectory = new Map<string, DirectoryTsconfig>()
  let directoryResolutionIdentityByCacheKey = new Map<string, Promise<string | null>>()
  let resolveInFlightByCacheKey = new Map<string, Promise<ResolvedModule>>()
  let emitInFlightByCacheKey = new Map<string, Promise<EmittedModule>>()
  let hasResolvedScripts = false

  let transformArgs: TransformArgs = {
    define: resolvedOptions.define ?? null,
    externalSet: resolvedOptions.externalSet,
    isWatchIgnored,
    minify: resolvedOptions.minify,
    loaders: resolvedOptions.loaders,
    resolveActualPath: realPathCache.resolve,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps ?? null,
    target: resolvedOptions.target ?? null,
    tsconfigTransformOptionsResolver,
  }
  let resolveArgs: ResolveArgs = {
    concurrency: scriptConcurrency,
    findNearestPackageJsonPath: findCachedNearestPackageJsonPath,
    isDirectoryResolutionFileIndependent,
    isAllowed: resolvedOptions.isAllowed,
    isWatchIgnored,
    resolveModulePath: resolveCachedModulePath,
    resolverFactory,
    resolveDirectorySpecifierIdentity,
    routes: resolvedOptions.routes,
    packageJsonSearchRoot: resolvedOptions.rootDir,
  }

  return {
    async getScript(filePath, getOptions) {
      let resolvedModule = resolveServedScriptOrThrow(
        resolveInputFilePath(resolvedOptions.rootDir, filePath),
      )
      let record = scriptStore.get(resolvedModule.identityPath)
      let notModified = getNotModifiedScript(record, getOptions)
      if (notModified) return notModified

      let emitted = await getOrCreateEmittedScript(record)
      return {
        script: toScriptCompileResult(emitted),
        type: 'script',
      }
    },

    async getScriptEntry(filePath, entryOptions) {
      let entryIdentityPath = resolveServedScriptOrThrow(
        resolveInputFilePath(resolvedOptions.rootDir, filePath),
      ).identityPath
      let importMapRootPaths = [entryIdentityPath]
      if (entryOptions?.extraImportMapRoots) {
        for (let extraRoot of entryOptions.extraImportMapRoots) {
          if (!importMapRootPaths.includes(extraRoot)) {
            importMapRootPaths.push(extraRoot)
          }
        }
      }

      let resolvedRoots = await getOrCreateResolvedScripts(
        importMapRootPaths.map((identityPath) => scriptStore.get(identityPath)),
      )
      let graph = await resolveServedGraph(resolvedRoots)
      let preloadLayerPaths = collectPreloadLayerPaths([entryIdentityPath], graph)
      let servedUrlsByPath = await getServedUrlsForGraph(
        collectServedUrlPaths(importMapRootPaths, graph),
        graph,
      )
      let preloads = formatPreloadLayers(preloadLayerPaths, servedUrlsByPath).flat()
      let href =
        preloads[0] ??
        appendCurrentHmrTimestamp(
          entryIdentityPath,
          getRequiredServedUrl(servedUrlsByPath, entryIdentityPath),
        )
      let importMap = buildImportMapFromGraph(importMapRootPaths, graph, servedUrlsByPath)

      return { href, importMap, preloads }
    },

    async getPreloadLayers(filePath) {
      let entryPaths = resolveInputScriptRoots(filePath)
      let resolvedEntries = await getOrCreateResolvedScripts(
        entryPaths.map((identityPath) => scriptStore.get(identityPath)),
      )
      let graph = await resolveServedGraph(resolvedEntries)
      let layerPaths = collectPreloadLayerPaths(entryPaths, graph)
      let servedUrlsByPath = await getServedUrlsForGraph(layerPaths.flat(), graph)

      return formatPreloadLayers(layerPaths, servedUrlsByPath)
    },

    async getImportMap(filePath) {
      let entryPaths = resolveInputScriptRoots(filePath)
      let resolvedEntries = await getOrCreateResolvedScripts(
        entryPaths.map((identityPath) => scriptStore.get(identityPath)),
      )
      let graph = await resolveServedGraph(resolvedEntries)
      let servedUrlsByPath = await getServedUrlsForGraph(
        collectServedUrlPaths(entryPaths, graph),
        graph,
      )

      return buildImportMapFromGraph(entryPaths, graph, servedUrlsByPath)
    },

    async getHref(filePath) {
      let resolvedModule = resolveServedScriptOrThrow(
        resolveInputFilePath(resolvedOptions.rootDir, filePath),
      )
      return getCurrentServedUrl(resolvedModule.identityPath)
    },

    async resolveSpecifierFromRoot(specifier) {
      let importerPath = path.join(resolvedOptions.rootDir, '__remix_virtual_entry__.js')
      let resolutionResult = await resolverFactory.resolveFileAsync(importerPath, specifier)
      if (resolutionResult.error || !resolutionResult.path) {
        throw createAssetServerCompilationError(
          `Failed to resolve browser module "${specifier}" from asset server root.`,
          { code: 'IMPORT_RESOLUTION_FAILED' },
        )
      }

      let resolvedModule = resolveServedScriptOrThrow(resolutionResult.path)
      return {
        href: await getCurrentServedUrl(resolvedModule.identityPath),
        identityPath: resolvedModule.identityPath,
      }
    },

    async classifyHmrFileEvent(filePath, event) {
      let normalizedFilePath = normalizeFilePath(filePath)
      if (isWatchIgnored(normalizedFilePath)) return []

      let timestamp = Date.now()
      let previousResolvedModule = scriptStore.getLastResolved(normalizedFilePath)
      let updatePathname = previousResolvedModule?.stableUrlPathname
      let resolutionMetadataChanged =
        isPackageJsonPath(normalizedFilePath) || isTsconfigPath(normalizedFilePath)

      invalidateScriptFileEvent(normalizedFilePath, event)

      if (resolutionMetadataChanged && hasResolvedScripts) {
        return [
          {
            accepted: false,
            filePath: normalizedFilePath,
            path: normalizedFilePath,
            timestamp,
          },
        ]
      }

      let resolvedModule =
        event === 'change' && updatePathname
          ? await tryGetOrCreateResolvedScript(scriptStore.get(normalizedFilePath))
          : undefined
      return event === 'change' && updatePathname
        ? getHmrUpdatesForChange(
            resolvedModule ?? previousResolvedModule,
            previousResolvedModule,
            updatePathname,
            timestamp,
          )
        : []
    },

    invalidateFileEvent(filePath, event) {
      invalidateScriptFileEvent(normalizeFilePath(filePath), event)
    },
  }

  function invalidateScriptFileEvent(normalizedFilePath: string, event: ModuleWatchEvent): void {
    if (isWatchIgnored(normalizedFilePath)) return

    if (event !== 'change') {
      realPathCache.clear()
    }

    if (shouldClearResolverCacheForFileEvent(normalizedFilePath, event)) {
      resolverFactory.clearCache()
      for (let directoryResolver of directoryResolverByTsconfig.values()) {
        directoryResolver.clearCache()
      }
      tsconfigByDirectory.clear()
      directoryResolutionIdentityByCacheKey.clear()
      nearestPackageJsonByDir.clear()
      barrelFileImportOptimizer.clearSideEffects()
    }

    if (isTsconfigPath(normalizedFilePath)) {
      tsconfigTransformOptionsResolver.clear()
      barrelFileImportOptimizer.clear()
      scriptStore.invalidateAll()
      return
    }

    if (isPackageJsonPath(normalizedFilePath)) {
      barrelFileImportOptimizer.clear()
      scriptStore.invalidateAll()
      return
    }

    barrelFileImportOptimizer.invalidate(normalizedFilePath)
    scriptStore.invalidateForFileEvent(normalizedFilePath, event)
  }

  function resolveCachedModulePath(absolutePath: string): ResolveModuleResult | null {
    let resolvedPath = realPathCache.resolve(normalizeFilePath(absolutePath))
    if (resolvedPath === null) return null

    if (!supportedScriptExtensionSet.has(path.extname(resolvedPath).toLowerCase())) {
      return null
    }

    return {
      identityPath: resolvedPath,
      resolvedPath,
    }
  }

  function findCachedNearestPackageJsonPath(filePath: string): string | null {
    let startDirectory = path.dirname(filePath)
    let cached = nearestPackageJsonByDir.get(startDirectory)
    if (cached !== undefined) return cached

    let visited: string[] = []
    let directory = startDirectory
    let found: string | null = null

    while (true) {
      let existing = nearestPackageJsonByDir.get(directory)
      if (existing !== undefined) {
        found = existing
        break
      }
      visited.push(directory)

      let packageJsonPath = path.join(directory, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        found = normalizeFilePath(packageJsonPath)
        break
      }

      let parentDirectory = path.dirname(directory)
      if (parentDirectory === directory) break
      directory = parentDirectory
    }

    for (let visitedDirectory of visited) {
      nearestPackageJsonByDir.set(visitedDirectory, found)
    }
    return found
  }

  function isDirectoryResolutionFileIndependent(directory: string): boolean {
    return getDirectoryTsconfig(directory).fileIndependent
  }

  function getDirectoryTsconfig(directory: string): DirectoryTsconfig {
    let existing = tsconfigByDirectory.get(directory)
    if (existing) return existing

    let tsconfig = getTsconfig(directory)
    let result = {
      fileIndependent: !tsconfig?.config.references?.length,
      path: tsconfig?.path ?? null,
    }
    tsconfigByDirectory.set(directory, result)
    return result
  }

  async function resolveDirectorySpecifierIdentity(
    directory: string,
    specifier: string,
  ): Promise<string | null> {
    let cacheKey = `${directory}\0${specifier}`
    let existing = directoryResolutionIdentityByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let tsconfigPath = getDirectoryTsconfig(directory).path
      let directoryResolver = directoryResolverByTsconfig.get(tsconfigPath)
      if (!directoryResolver) {
        directoryResolver = new ResolverFactory({
          ...resolverOptions,
          tsconfig: tsconfigPath ? { configFile: tsconfigPath } : undefined,
        })
        directoryResolverByTsconfig.set(tsconfigPath, directoryResolver)
      }

      let result = await directoryResolver.async(directory, specifier)
      if (!result.path || !path.isAbsolute(result.path)) return null
      return resolveCachedModulePath(normalizeFilePath(result.path))?.identityPath ?? null
    })()
    directoryResolutionIdentityByCacheKey.set(cacheKey, promise)
    return promise
  }

  function resolveServedScriptOrThrow(absolutePath: string): ResolveModuleResult {
    let resolvedModule = resolveCachedModulePath(absolutePath)
    if (!resolvedModule) {
      throw createAssetServerCompilationError(`File not found: ${absolutePath}`, {
        code: 'FILE_NOT_FOUND',
      })
    }

    if (!resolvedOptions.isAllowed(resolvedModule.identityPath)) {
      throw createAssetServerCompilationError(
        `File "${resolvedModule.identityPath}" is not allowed by the asset server access configuration. ` +
          `Add a matching allowFiles or allowPackages rule, or remove a conflicting denyFiles rule.`,
        {
          code: 'FILE_NOT_ALLOWED',
        },
      )
    }

    return resolvedModule
  }

  function resolveInputScriptRoots(filePath: string | readonly string[]): string[] {
    let resolvedEntries: string[] = []
    let seen = new Set<string>()

    for (let nextPath of Array.isArray(filePath) ? filePath : [filePath]) {
      let resolvedModule = resolveServedScriptOrThrow(
        resolveInputFilePath(resolvedOptions.rootDir, nextPath),
      )
      if (seen.has(resolvedModule.identityPath)) continue
      seen.add(resolvedModule.identityPath)
      resolvedEntries.push(resolvedModule.identityPath)
    }

    return resolvedEntries
  }

  function getNotModifiedScript(
    record: ScriptRecord,
    options: ScriptGetOptions,
  ): ScriptGetResult | null {
    if (hasHmrTimestampedDependency(record.resolved)) {
      return null
    }

    let fresh = getFreshEmittedScript(record)
    if (fresh) {
      let current = getNotModifiedResult(
        getEmittedAssetForRequest(fresh, options.isSourceMapRequest),
        options,
      )
      if (current) return current
    }

    if (!record.staleEmittedSnapshot || !isModuleSnapshotFresh(record.staleEmittedSnapshot)) {
      return null
    }

    return record.staleEmitted
      ? getNotModifiedResult(
          getEmittedAssetForRequest(record.staleEmitted, options.isSourceMapRequest),
          options,
        )
      : null
  }

  async function getOrCreateResolvedScripts(records: ScriptRecord[]): Promise<ResolvedModule[]> {
    if (records.length === 0) return []

    let results = new Array<ResolvedModule>(records.length)
    let pendingIndices: number[] = []
    for (let index = 0; index < records.length; index++) {
      let record = records[index]
      if (record.resolved && scriptStore.isResolvedFresh(record)) {
        results[index] = record.resolved
      } else {
        pendingIndices.push(index)
      }
    }

    if (pendingIndices.length > 0) {
      let resolvedPending = await mapWithConcurrency(pendingIndices, scriptConcurrency, (index) =>
        getOrCreateResolvedScript(records[index]),
      )
      for (let index = 0; index < pendingIndices.length; index++) {
        results[pendingIndices[index]] = resolvedPending[index]
      }
    }

    return results
  }

  async function getOrCreateResolvedScript(record: ScriptRecord): Promise<ResolvedModule> {
    if (record.resolved && scriptStore.isResolvedFresh(record)) return record.resolved

    let cacheKey = getCacheKey(record.identityPath, record.invalidationVersion)
    let existing = resolveInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let transformedModule = await getOrCreateTransformedScript(record)
      let resolveModuleResult = await resolveModule(record, transformedModule, resolveArgs)

      if (!resolveModuleResult.ok) {
        if (isFresh(record, startedVersion)) {
          scriptStore.clearResolved(record.identityPath, [resolveModuleResult.tracking])
        }
        throw resolveModuleResult.error
      }

      if (isFresh(record, startedVersion)) {
        scriptStore.setResolved(record.identityPath, resolveModuleResult.value, [
          resolveModuleResult.tracking,
        ])
      }
      hasResolvedScripts = true

      return resolveModuleResult.value
    })()

    resolveInFlightByCacheKey.set(cacheKey, promise)

    try {
      return await promise
    } finally {
      if (resolveInFlightByCacheKey.get(cacheKey) === promise) {
        resolveInFlightByCacheKey.delete(cacheKey)
      }
    }
  }

  async function tryGetOrCreateResolvedScript(
    record: ScriptRecord,
  ): Promise<ResolvedModule | undefined> {
    try {
      return await getOrCreateResolvedScript(record)
    } catch {
      return undefined
    }
  }

  async function getOrCreateTransformedScript(record: ScriptRecord): Promise<TransformedModule> {
    if (record.transformed && scriptStore.isTransformedFresh(record)) return record.transformed

    let startedVersion = record.contentVersion
    let transformModuleResult = await transformModule(record, transformArgs)

    if (!transformModuleResult.ok) {
      if (record.contentVersion === startedVersion) {
        scriptStore.clearTransformed(record.identityPath, [transformModuleResult.tracking])
      }
      throw transformModuleResult.error
    }

    if (record.contentVersion === startedVersion) {
      scriptStore.setTransformed(record.identityPath, transformModuleResult.value, [
        transformModuleResult.tracking,
      ])
    }

    return transformModuleResult.value
  }

  function getFreshEmittedScript(record: ScriptRecord): EmittedModule | null {
    if (
      !record.emitted ||
      !scriptStore.isEmittedFresh(record) ||
      hasHmrTimestampedDependency(record.resolved)
    ) {
      return null
    }

    scriptStore.touchEmitted(record.identityPath)
    return record.emitted
  }

  async function getOrCreateEmittedScript(
    record: ScriptRecord,
    precomputedGraph?: ReadonlyMap<string, ResolvedModule>,
  ): Promise<EmittedModule> {
    let fresh = getFreshEmittedScript(record)
    if (fresh) return fresh

    let cacheKey = getCacheKey(record.identityPath, record.invalidationVersion)
    let existing = emitInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let root = precomputedGraph?.get(record.identityPath)
      let sourceRoot: ResolvedModule
      if (root) {
        sourceRoot = record.resolved ?? root
      } else {
        sourceRoot = await getOrCreateResolvedScript(record)
        let graph = await resolveServedGraph([sourceRoot])
        root = graph.get(sourceRoot.identityPath)
        if (!root) throw new Error(`Failed to resolve script graph for ${record.identityPath}`)
      }
      let emitResolvedModuleResult = await emitResolvedModule(root, {
        fingerprintAssets: resolvedOptions.fingerprintAssets,
        getImportSpecifier,
        getStableUrl,
        hmrClientPathname: resolvedOptions.hmr?.clientPathname,
        sourceMaps: resolvedOptions.sourceMaps,
      })

      if (!emitResolvedModuleResult.ok) {
        throw emitResolvedModuleResult.error
      }

      if (isFresh(record, startedVersion)) {
        scriptStore.setEmitted(
          record.identityPath,
          emitResolvedModuleResult.value,
          resolvedOptions.watchMode ? createModuleSnapshot(sourceRoot.trackedFiles) : null,
        )
        if (!resolvedOptions.watchMode && record.resolved) {
          record.resolved.sourceMap = null
        }
      }

      return emitResolvedModuleResult.value
    })()

    emitInFlightByCacheKey.set(cacheKey, promise)

    try {
      return await promise
    } finally {
      if (emitInFlightByCacheKey.get(cacheKey) === promise) {
        emitInFlightByCacheKey.delete(cacheKey)
      }
    }
  }

  async function resolveScriptGraph(
    roots: readonly ResolvedModule[],
  ): Promise<Map<string, ResolvedModule>> {
    let visited = new Set(roots.map((root) => root.identityPath))
    let graph = new Map(roots.map((root) => [root.identityPath, root]))
    let queue = roots.flatMap((root) => root.deps)

    while (queue.length > 0) {
      let frontier = queue
      queue = []
      let resolvedModules = await getOrCreateResolvedScripts(
        frontier
          .filter((identityPath) => !visited.has(identityPath))
          .map((identityPath) => scriptStore.get(identityPath)),
      )

      for (let resolvedModule of resolvedModules) {
        if (visited.has(resolvedModule.identityPath)) continue
        visited.add(resolvedModule.identityPath)
        graph.set(resolvedModule.identityPath, resolvedModule)

        for (let dep of resolvedModule.deps) {
          if (!visited.has(dep)) queue.push(dep)
        }
      }
    }

    return graph
  }

  async function resolveServedGraph(
    roots: readonly ResolvedModule[],
  ): Promise<Map<string, ResolvedModule>> {
    let sourceGraph = await resolveScriptGraph(roots)
    return getReachableGraph(
      roots.map((root) => root.identityPath),
      barrelFileImportOptimizer.optimize(sourceGraph),
    )
  }

  function getReachableGraph(
    rootIdentityPaths: readonly string[],
    graph: ReadonlyMap<string, ResolvedModule>,
  ): Map<string, ResolvedModule> {
    let reachable = new Map<string, ResolvedModule>()
    let queue = [...rootIdentityPaths]
    while (queue.length > 0) {
      let identityPath = queue.pop()
      if (!identityPath || reachable.has(identityPath)) continue
      let module = graph.get(identityPath)
      if (!module) continue
      reachable.set(identityPath, module)
      queue.push(...module.deps)
    }
    return reachable
  }

  async function getServedUrl(
    identityPath: string,
    precomputedGraph?: ReadonlyMap<string, ResolvedModule>,
  ): Promise<string> {
    let resolvedModule =
      precomputedGraph?.get(identityPath) ??
      (await getOrCreateResolvedScript(scriptStore.get(identityPath)))
    if (!resolvedOptions.fingerprintAssets) {
      return resolvedModule.stableUrlPathname
    }

    let emittedModule = await getOrCreateEmittedScript(
      scriptStore.get(identityPath),
      precomputedGraph,
    )
    return formatFingerprintedPathname(resolvedModule.stableUrlPathname, emittedModule.fingerprint)
  }

  async function getServedUrlsForGraph(
    identityPaths: readonly string[],
    graph: ReadonlyMap<string, ResolvedModule>,
  ): Promise<Map<string, string>> {
    let servedUrlsByPath = new Map<string, string>()
    let pendingPaths: string[] = []

    for (let identityPath of identityPaths) {
      if (servedUrlsByPath.has(identityPath)) continue
      let resolvedModule = graph.get(identityPath)
      if (resolvedModule) {
        if (!resolvedOptions.fingerprintAssets) {
          servedUrlsByPath.set(identityPath, resolvedModule.stableUrlPathname)
          continue
        }
        let fresh = getFreshEmittedScript(scriptStore.get(identityPath))
        if (fresh) {
          servedUrlsByPath.set(
            identityPath,
            formatFingerprintedPathname(resolvedModule.stableUrlPathname, fresh.fingerprint),
          )
          continue
        }
      }
      servedUrlsByPath.set(identityPath, '')
      pendingPaths.push(identityPath)
    }

    if (pendingPaths.length > 0) {
      let urls = await mapWithConcurrency(pendingPaths, scriptConcurrency, (identityPath) =>
        getServedUrl(identityPath, graph),
      )
      for (let index = 0; index < pendingPaths.length; index++) {
        servedUrlsByPath.set(pendingPaths[index], urls[index])
      }
    }

    return servedUrlsByPath
  }

  function formatPreloadLayers(
    layerPaths: readonly (readonly string[])[],
    servedUrlsByPath: ReadonlyMap<string, string>,
  ): string[][] {
    return layerPaths.map((layer) =>
      layer.map((identityPath) =>
        appendCurrentHmrTimestamp(
          identityPath,
          getRequiredServedUrl(servedUrlsByPath, identityPath),
        ),
      ),
    )
  }

  function appendCurrentHmrTimestamp(identityPath: string, servedUrl: string): string {
    let timestamp = getHmrImportTimestamp(identityPath)
    return timestamp === null ? servedUrl : appendTimestampQuery(servedUrl, timestamp)
  }

  async function getCurrentServedUrl(identityPath: string): Promise<string> {
    return appendCurrentHmrTimestamp(identityPath, await getServedUrl(identityPath))
  }

  function buildImportMapFromGraph(
    entryPaths: readonly string[],
    graph: ReadonlyMap<string, ResolvedModule>,
    servedUrlsByPath: ReadonlyMap<string, string>,
  ): ScriptImportMap {
    let resolvedEntrySet = new Set(entryPaths)
    let visited = new Set<string>()
    let queue = [...entryPaths]
    let imports: Record<string, string> = {}
    let scopes: Record<string, Record<string, string>> = {}

    while (queue.length > 0) {
      let frontier = queue
      queue = []
      for (let identityPath of frontier) {
        let resolvedModule = graph.get(identityPath)
        if (!resolvedModule) continue
        if (visited.has(resolvedModule.identityPath)) continue
        visited.add(resolvedModule.identityPath)
        if (!resolvedEntrySet.has(resolvedModule.identityPath)) {
          addImportMapEntry(
            imports,
            resolvedModule.stableUrlPathname,
            getRequiredServedUrl(servedUrlsByPath, resolvedModule.identityPath),
          )
        }

        for (let rewrite of resolvedModule.importRewrites) {
          for (let imported of rewrite.imports) {
            addImportMapEntry(
              imports,
              getStableUrl(imported.depPath),
              getRequiredServedUrl(servedUrlsByPath, imported.depPath),
            )
          }
        }

        for (let imported of resolvedModule.runtimeImports) {
          let depUrl = getRequiredServedUrl(servedUrlsByPath, imported.depPath)
          if (isBareImportSpecifier(imported.specifier)) {
            let scopePathname = imported.scopePathname
            if (!scopePathname) {
              throw new Error(
                `Expected import map scope for bare import "${imported.specifier}" in ${resolvedModule.identityPath}`,
              )
            }
            let scopeImports = (scopes[scopePathname] ??= {})
            addImportMapEntry(scopeImports, imported.specifier, depUrl)
          } else {
            let browserResolvedSpecifier = resolveImportMapUrlSpecifier(
              imported.specifier,
              resolvedModule.stableUrlPathname,
            )
            addImportMapEntry(imports, browserResolvedSpecifier, depUrl)
          }
        }

        for (let dep of resolvedModule.deps) {
          if (!visited.has(dep)) {
            queue.push(dep)
          }
        }
      }
    }

    for (let [scopePathname, scopeImports] of Object.entries(scopes)) {
      if (Object.keys(scopeImports).length === 0) {
        delete scopes[scopePathname]
      }
    }

    return Object.keys(scopes).length > 0 ? { imports, scopes } : { imports }
  }

  function getImportSpecifier(identityPath: string, originalSpecifier?: string): string {
    let timestamp = getHmrImportTimestamp(identityPath)
    if (timestamp !== null) {
      // HMR and fingerprinting are mutually exclusive, so updated imports use stable paths.
      return appendTimestampQuery(getStableUrl(identityPath), timestamp)
    }
    return originalSpecifier ?? getStableUrl(identityPath)
  }

  function getStableUrl(identityPath: string): string {
    let stableUrlPathname = resolvedOptions.routes.toUrlPathname(identityPath)
    if (!stableUrlPathname) {
      throw createAssetServerCompilationError(
        `File ${identityPath} is outside all configured mounts.`,
        {
          code: 'FILE_OUTSIDE_MOUNTS',
        },
      )
    }
    return stableUrlPathname
  }

  function getHmrImportTimestamp(identityPath: string): number | null {
    return scriptStore.getHmrUpdateTimestamp(identityPath) ?? null
  }

  function hasHmrTimestampedDependency(resolvedModule: ResolvedModule | undefined): boolean {
    return resolvedModule?.deps.some((depPath) => getHmrImportTimestamp(depPath) !== null) === true
  }

  function getHmrUpdatesForChange(
    resolvedModule: ResolvedModule | undefined,
    previousResolvedModule: ResolvedModule | undefined,
    updatePathname: string,
    timestamp: number,
  ): ScriptHmrUpdate[] {
    if (resolvedModule) {
      scriptStore.setHmrUpdateTimestamp(resolvedModule.identityPath, timestamp)
    }

    if (resolvedModule?.hmr.selfAccepting === true) {
      return [
        {
          accepted: true,
          acceptedFilePath: resolvedModule.identityPath,
          acceptedUrlPathname: updatePathname,
          filePath: resolvedModule.identityPath,
          path: updatePathname,
          timestamp,
        },
      ]
    }

    let sourceFilePath = resolvedModule?.identityPath
    let boundaries = findHmrBoundaries(sourceFilePath)
    if (sourceFilePath !== undefined && boundaries) {
      for (let boundary of boundaries) {
        scriptStore.setHmrUpdateTimestamp(boundary.boundaryModule.identityPath, timestamp)
        for (let identityPath of boundary.propagationPath) {
          scriptStore.setHmrUpdateTimestamp(identityPath, timestamp)
        }
      }
      return dedupeHmrBoundaries(boundaries).map(({ acceptedModule, boundaryModule }) => ({
        accepted: true,
        acceptedFilePath: acceptedModule.identityPath,
        acceptedUrlPathname: acceptedModule.stableUrlPathname,
        filePath: sourceFilePath,
        path: boundaryModule.stableUrlPathname,
        timestamp,
      }))
    }

    return [
      {
        accepted: false,
        filePath:
          resolvedModule?.identityPath ?? previousResolvedModule?.identityPath ?? updatePathname,
        path: updatePathname,
        timestamp,
      },
    ]
  }

  function findHmrBoundaries(identityPath: string | undefined): ScriptHmrBoundary[] | null {
    if (identityPath === undefined) return null
    return propagateHmrUpdate(identityPath, new Set())
  }

  function propagateHmrUpdate(
    identityPath: string,
    traversed: Set<string>,
  ): ScriptHmrBoundary[] | null {
    if (traversed.has(identityPath)) return []
    let nextTraversed = new Set(traversed)
    nextTraversed.add(identityPath)

    let resolvedModule = scriptStore.getLastResolved(identityPath)
    if (!resolvedModule) return null

    if (resolvedModule.hmr.selfAccepting) {
      return [
        {
          acceptedModule: resolvedModule,
          boundaryModule: resolvedModule,
          propagationPath: [],
        },
      ]
    }

    let importerPaths = scriptStore.getImporters(identityPath)
    if (!importerPaths || importerPaths.size === 0) return null

    let acceptedImporterPaths = scriptStore.getAcceptedImporters(identityPath)
    let boundaries: ScriptHmrBoundary[] = []
    for (let importerPath of importerPaths) {
      let importer = scriptStore.getLastResolved(importerPath)
      if (!importer) return null

      if (acceptedImporterPaths?.has(importerPath)) {
        boundaries.push({
          acceptedModule: resolvedModule,
          boundaryModule: importer,
          propagationPath: [resolvedModule.identityPath],
        })
        continue
      }

      let importerBoundaries = propagateHmrUpdate(importerPath, nextTraversed)
      if (!importerBoundaries) return null
      for (let importerBoundary of importerBoundaries) {
        boundaries.push({
          ...importerBoundary,
          propagationPath: [resolvedModule.identityPath, ...importerBoundary.propagationPath],
        })
      }
    }

    return boundaries
  }

  function isWatchIgnored(filePath: string): boolean {
    return resolvedOptions.watchIgnoreMatchers.some((matcher) => matcher(filePath))
  }
}

function resolveImportMapUrlSpecifier(specifier: string, importerUrlPathname: string): string {
  return new URL(specifier, `http://localhost${importerUrlPathname}`).pathname
}

function addImportMapEntry(imports: Record<string, string>, specifier: string, url: string): void {
  if (specifier === url) return
  imports[specifier] = url
}

function dedupeHmrBoundaries(boundaries: ScriptHmrBoundary[]): ScriptHmrBoundary[] {
  let seen = new Set<string>()
  let result: ScriptHmrBoundary[] = []

  for (let boundary of boundaries) {
    let key = `${boundary.boundaryModule.identityPath}\0${boundary.acceptedModule.identityPath}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(boundary)
  }

  return result
}

function createModuleSnapshot(filePaths: readonly string[]): ModuleSnapshot | null {
  let snapshot = new Map<string, FileSnapshot>()

  for (let filePath of filePaths) {
    let fileSnapshot = getFileSnapshot(filePath)
    if (!fileSnapshot) return null
    snapshot.set(filePath, fileSnapshot)
  }

  return snapshot
}

function isModuleSnapshotFresh(snapshot: ModuleSnapshot): boolean {
  for (let [filePath, previous] of snapshot) {
    let current = getFileSnapshot(filePath)
    if (!current) return false
    if (current.mtimeNs !== previous.mtimeNs || current.size !== previous.size) return false
  }

  return true
}

function toScriptCompileResult(emittedModule: EmittedModule): ScriptCompileResult {
  return {
    code: emittedModule.code,
    fingerprint: emittedModule.fingerprint,
    sourceMap: emittedModule.sourceMap,
  }
}

function isPackageJsonPath(filePath: string): boolean {
  return filePath.endsWith('/package.json')
}

function isTsconfigPath(filePath: string): boolean {
  return /\/tsconfig(?:\..+)?\.json$/.test(filePath)
}

function shouldClearResolverCacheForFileEvent(filePath: string, event: ModuleWatchEvent): boolean {
  return event !== 'change' || isPackageJsonPath(filePath) || isTsconfigPath(filePath)
}

function collectPreloadLayerPaths(
  entryPaths: readonly string[],
  graph: ReadonlyMap<string, ResolvedModule>,
): string[][] {
  let visited = new Set(entryPaths)
  let queue = [...entryPaths]
  let layers: string[][] = []

  while (queue.length > 0) {
    let frontier = queue
    queue = []
    let layer: string[] = []

    for (let identityPath of frontier) {
      let resolvedModule = graph.get(identityPath)
      if (!resolvedModule) continue
      layer.push(resolvedModule.identityPath)

      for (let dep of resolvedModule.staticDeps) {
        if (visited.has(dep)) continue
        visited.add(dep)
        queue.push(dep)
      }
    }

    layers.push(layer)
  }

  return layers
}

function collectServedUrlPaths(
  entryPaths: readonly string[],
  graph: ReadonlyMap<string, ResolvedModule>,
): string[] {
  let paths = new Set<string>(entryPaths)
  let visited = new Set<string>()
  let queue = [...entryPaths]

  while (queue.length > 0) {
    let identityPath = queue.pop()
    if (!identityPath || visited.has(identityPath)) continue
    visited.add(identityPath)

    let resolvedModule = graph.get(identityPath)
    if (!resolvedModule) continue
    paths.add(resolvedModule.identityPath)

    for (let rewrite of resolvedModule.importRewrites) {
      for (let imported of rewrite.imports) {
        paths.add(imported.depPath)
      }
    }
    for (let imported of resolvedModule.runtimeImports) {
      paths.add(imported.depPath)
    }
    for (let dep of resolvedModule.deps) {
      if (!visited.has(dep)) queue.push(dep)
    }
  }

  return [...paths]
}

function getRequiredServedUrl(
  servedUrlsByPath: ReadonlyMap<string, string>,
  identityPath: string,
): string {
  let url = servedUrlsByPath.get(identityPath)
  if (url === undefined) {
    throw new Error(`Missing served URL for script ${identityPath}`)
  }
  return url
}
