import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IfNoneMatch } from '@remix-run/headers/if-none-match'
import { getTsconfig } from 'get-tsconfig'

import { createAssetServerCompilationError } from '../compilation-error.ts'
import { createFileMatcher } from '../file-matcher.ts'
import {
  formatFingerprintedPathname,
  getFingerprintRequestCacheControl,
  parseFingerprintSuffix,
} from '../fingerprint.ts'
import { emitResolvedModule } from './emit.ts'
import { normalizeFilePath, resolveFilePath } from '../paths.ts'
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
import type { EmittedAsset, EmittedModule } from './emit.ts'

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
    send(updates: ScriptHmrUpdate[]): void
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
  getPreloadLayers(filePath: string | readonly string[]): Promise<string[][]>
  getImportMap(filePath: string | readonly string[]): Promise<ScriptImportMap>
  getHref(filePath: string): Promise<string>
  classifyHmrFileEvent(filePath: string, event: ModuleWatchEvent): Promise<ScriptHmrUpdate[]>
  invalidateFileEvent(filePath: string, event: ModuleWatchEvent): void
  parseRequestPathname(pathname: string): ParsedRequestPathname | null
}

type ParsedRequestPathname = {
  cacheControl: string
  filePath: string
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
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
}

type DirectoryTsconfig = {
  fileIndependent: boolean
  path: string | null
}

const supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)
const scriptConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1))

export function createScriptCompiler(options: ScriptCompilerOptions): ScriptCompiler {
  let resolvedOptions = {
    ...options,
    externalSet: new Set(options.external),
    watchIgnoreMatchers: (options.watchIgnore ?? []).map((pattern) =>
      createFileMatcher(pattern, options.rootDir),
    ),
  }
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
    onWatchDirectoriesChange: options.onWatchDirectoriesChange,
    onWatchFilesChange: options.onWatchFilesChange,
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
    resolveActualPath,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps ?? null,
    target: resolvedOptions.target ?? null,
    tsconfigTransformOptionsResolver,
  }
  let resolveArgs: ResolveArgs = {
    concurrency: scriptConcurrency,
    isDirectoryResolutionFileIndependent,
    isAllowed: resolvedOptions.isAllowed,
    isWatchIgnored,
    resolveModulePath,
    resolverFactory,
    resolveDirectorySpecifierIdentity,
    routes: resolvedOptions.routes,
  }

  return {
    async getScript(filePath, getOptions) {
      let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(filePath))
      let record = scriptStore.get(resolvedModule.identityPath)
      let notModified = getNotModifiedScript(record, getOptions)
      if (notModified) return notModified

      let emitted = await getOrCreateEmittedScript(record)
      return {
        script: toScriptCompileResult(emitted),
        type: 'script',
      }
    },

    async getPreloadLayers(filePath) {
      let resolvedEntries: string[] = []
      let seen = new Set<string>()

      for (let resolvedModule of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) =>
        resolveServedScriptOrThrow(resolveInputFilePath(nextPath)),
      )) {
        if (seen.has(resolvedModule.identityPath)) continue
        seen.add(resolvedModule.identityPath)
        resolvedEntries.push(resolvedModule.identityPath)
      }

      let visited = new Set(resolvedEntries)
      let queue = [...resolvedEntries]
      let layers: string[][] = []

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let resolvedModules = await getOrCreateResolvedScripts(
          frontier.map((identityPath) => scriptStore.get(identityPath)),
        )
        let layer: string[] = []

        for (let resolvedModule of resolvedModules) {
          layer.push(await getServedUrl(resolvedModule.identityPath))

          for (let dep of resolvedModule.deps) {
            if (visited.has(dep)) continue
            visited.add(dep)
            queue.push(dep)
          }
        }

        layers.push(layer)
      }

      return layers
    },

    async getImportMap(filePath) {
      let resolvedEntries = resolveInputScriptRoots(filePath)
      let resolvedEntrySet = new Set(resolvedEntries)
      let visited = new Set<string>()
      let queue = [...resolvedEntries]
      let imports: Record<string, string> = {}
      let scopes: Record<string, Record<string, string>> = {}

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let resolvedModules = await getOrCreateResolvedScripts(
          frontier.map((identityPath) => scriptStore.get(identityPath)),
        )

        for (let resolvedModule of resolvedModules) {
          if (visited.has(resolvedModule.identityPath)) continue
          visited.add(resolvedModule.identityPath)
          if (!resolvedEntrySet.has(resolvedModule.identityPath)) {
            addImportMapEntry(
              imports,
              resolvedModule.stableUrlPathname,
              await getServedUrl(resolvedModule.identityPath),
            )
          }

          for (let imported of resolvedModule.imports) {
            let depUrl = await getServedUrl(imported.depPath)
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
    },

    async getHref(filePath) {
      let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(filePath))
      return getServedUrl(resolvedModule.identityPath)
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
        let hmrUpdate: ScriptHmrUpdate[] = [
          {
            accepted: false,
            filePath: normalizedFilePath,
            path: normalizedFilePath,
            timestamp,
          },
        ]
        resolvedOptions.hmr?.send(hmrUpdate)
        return hmrUpdate
      }

      let resolvedModule =
        event === 'change' && updatePathname
          ? await tryGetOrCreateResolvedScript(scriptStore.get(normalizedFilePath))
          : undefined
      let hmrUpdate =
        event === 'change' && updatePathname
          ? getHmrUpdatesForChange(
              resolvedModule ?? previousResolvedModule,
              previousResolvedModule,
              updatePathname,
              timestamp,
            )
          : []

      if (hmrUpdate.length > 0) {
        resolvedOptions.hmr?.send(hmrUpdate)
      }
      return hmrUpdate
    },

    invalidateFileEvent(filePath, event) {
      invalidateScriptFileEvent(normalizeFilePath(filePath), event)
    },

    parseRequestPathname(pathname) {
      let parsedPathname = parseServedPathname(pathname)
      let filePath = resolvedOptions.routes.resolveUrlPathname(parsedPathname.stablePathname)
      if (!filePath) return null
      if (resolvedOptions.fingerprintAssets && parsedPathname.requestedFingerprint === null)
        return null

      return {
        cacheControl: getFingerprintRequestCacheControl(parsedPathname.requestedFingerprint),
        filePath,
        isSourceMapRequest: parsedPathname.isSourceMapRequest,
        requestedFingerprint: parsedPathname.requestedFingerprint,
      }
    },
  }

  function resolveInputFilePath(filePath: string): string {
    if (filePath.startsWith('file://')) {
      return normalizeFilePath(fileURLToPath(new URL(filePath)))
    }

    if (filePath.includes('://')) {
      throw new TypeError(`Expected a file path or file:// URL, received "${filePath}"`)
    }

    return resolveFilePath(resolvedOptions.rootDir, filePath)
  }

  function invalidateScriptFileEvent(normalizedFilePath: string, event: ModuleWatchEvent): void {
    if (isWatchIgnored(normalizedFilePath)) return

    if (shouldClearResolverCacheForFileEvent(normalizedFilePath, event)) {
      resolverFactory.clearCache()
      for (let directoryResolver of directoryResolverByTsconfig.values()) {
        directoryResolver.clearCache()
      }
      tsconfigByDirectory.clear()
      directoryResolutionIdentityByCacheKey.clear()
    }

    if (isTsconfigPath(normalizedFilePath)) {
      tsconfigTransformOptionsResolver.clear()
      scriptStore.invalidateAll()
      return
    }

    if (isPackageJsonPath(normalizedFilePath)) {
      scriptStore.invalidateAll()
      return
    }

    scriptStore.invalidateForFileEvent(normalizedFilePath, event)
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
      return resolveModulePath(normalizeFilePath(result.path))?.identityPath ?? null
    })()
    directoryResolutionIdentityByCacheKey.set(cacheKey, promise)
    return promise
  }

  function resolveServedScriptOrThrow(absolutePath: string): ResolveModuleResult {
    let resolvedModule = resolveModulePath(absolutePath)
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
      let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(nextPath))
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

    if (scriptStore.isEmittedFresh(record)) {
      let current = getNotModifiedResult(record.emitted, options)
      if (current) return current
    }

    if (!record.staleEmittedSnapshot || !isModuleSnapshotFresh(record.staleEmittedSnapshot)) {
      return null
    }

    return getNotModifiedResult(record.staleEmitted, options)
  }

  async function getOrCreateResolvedScripts(records: ScriptRecord[]): Promise<ResolvedModule[]> {
    return mapWithConcurrency(records, scriptConcurrency, (record) =>
      getOrCreateResolvedScript(record),
    )
  }

  async function getOrCreateResolvedScript(record: ScriptRecord): Promise<ResolvedModule> {
    if (record.resolved && scriptStore.isResolvedFresh(record)) return record.resolved

    let cacheKey = getRecordCacheKey(record)
    let existing = resolveInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let transformedModule = await getOrCreateTransformedScript(record)
      if (
        resolvedOptions.watchMode &&
        transformedModule.unresolvedImports.some((unresolved) =>
          isBareImportSpecifier(unresolved.specifier),
        )
      ) {
        resolverFactory.clearCache()
      }
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

    let startedVersion = record.invalidationVersion
    let transformModuleResult = await transformModule(record, transformArgs)

    if (!transformModuleResult.ok) {
      if (isFresh(record, startedVersion)) {
        scriptStore.clearTransformed(record.identityPath, [transformModuleResult.tracking])
      }
      throw transformModuleResult.error
    }

    if (isFresh(record, startedVersion)) {
      scriptStore.setTransformed(record.identityPath, transformModuleResult.value, [
        transformModuleResult.tracking,
      ])
    }

    return transformModuleResult.value
  }

  async function getOrCreateEmittedScript(record: ScriptRecord): Promise<EmittedModule> {
    if (
      record.emitted &&
      scriptStore.isEmittedFresh(record) &&
      !hasHmrTimestampedDependency(record.resolved)
    ) {
      return record.emitted
    }

    let cacheKey = getRecordCacheKey(record)
    let existing = emitInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let resolvedModule = await getOrCreateResolvedScript(record)
      await resolveScriptGraph(resolvedModule)
      let emitResolvedModuleResult = await emitResolvedModule(resolvedModule, {
        fingerprintAssets: resolvedOptions.fingerprintAssets,
        getHmrImportTimestamp,
        getServedUrl,
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
          createModuleSnapshot(resolvedModule.trackedFiles),
        )
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

  async function resolveScriptGraph(root: ResolvedModule): Promise<void> {
    let visited = new Set([root.identityPath])
    let queue = [...root.deps]

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

        for (let dep of resolvedModule.deps) {
          if (!visited.has(dep)) queue.push(dep)
        }
      }
    }
  }

  async function getServedUrl(identityPath: string): Promise<string> {
    let resolvedModule = await getOrCreateResolvedScript(scriptStore.get(identityPath))
    if (!resolvedOptions.fingerprintAssets) {
      return resolvedModule.stableUrlPathname
    }

    let emittedModule = await getOrCreateEmittedScript(scriptStore.get(identityPath))
    return formatFingerprintedPathname(resolvedModule.stableUrlPathname, emittedModule.fingerprint)
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
    traversed.add(identityPath)

    let resolvedModule = scriptStore.getLastResolved(identityPath)
    if (!resolvedModule) return null

    if (resolvedModule.hmr.selfAccepting) {
      return [
        {
          acceptedModule: resolvedModule,
          boundaryModule: resolvedModule,
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
        })
        continue
      }

      let importerBoundaries = propagateHmrUpdate(importerPath, traversed)
      if (!importerBoundaries) return null
      boundaries.push(...importerBoundaries)
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

function getRecordCacheKey(record: ScriptRecord): string {
  return `${record.identityPath}\0${record.invalidationVersion}`
}

function isFresh(record: ScriptRecord, version: number): boolean {
  return record.invalidationVersion === version
}

function getNotModifiedResult(
  emittedModule: EmittedModule | undefined,
  options: ScriptGetOptions,
): ScriptGetResult | null {
  if (!emittedModule || options.ifNoneMatch === null) return null

  let asset = getEmittedAssetForRequest(emittedModule, options.isSourceMapRequest)
  if (!asset) return null

  if (options.requestedFingerprint !== null && asset.fingerprint !== options.requestedFingerprint) {
    return null
  }

  if (!IfNoneMatch.from(options.ifNoneMatch).matches(asset.etag)) return null
  return { type: 'not-modified', etag: asset.etag }
}

function getEmittedAssetForRequest(
  emittedModule: EmittedModule,
  isSourceMapRequest: boolean,
): EmittedAsset | null {
  return isSourceMapRequest ? emittedModule.sourceMap : emittedModule.code
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

function getFileSnapshot(filePath: string): FileSnapshot | null {
  try {
    let stats = fs.statSync(filePath, { bigint: true })
    if (!stats.isFile()) return null
    return {
      mtimeNs: stats.mtimeNs,
      size: stats.size,
    }
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

function parseServedPathname(pathname: string): {
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
  stablePathname: string
} {
  let isSourceMapRequest = pathname.endsWith('.map')
  let pathWithoutMap = isSourceMapRequest ? pathname.slice(0, -4) : pathname
  let fingerprint = parseFingerprintSuffix(pathWithoutMap)

  return {
    isSourceMapRequest,
    requestedFingerprint: fingerprint.requestedFingerprint,
    stablePathname: fingerprint.pathname,
  }
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

function isNoEntityError(
  error: unknown,
): error is NodeJS.ErrnoException & { code: 'ENOENT' | 'ENOTDIR' } {
  return (
    error instanceof Error &&
    'code' in error &&
    ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
      (error as NodeJS.ErrnoException).code === 'ENOTDIR')
  )
}

export function createResponseForScript(
  result: ScriptCompileResult,
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
    if (!result.sourceMap) {
      return new Response('Not found', { status: 404 })
    }
    body = options.method === 'HEAD' ? null : result.sourceMap.content
    etag = result.sourceMap.etag
    contentType = 'application/json; charset=utf-8'
  } else {
    body = options.method === 'HEAD' ? null : result.code.content
    etag = result.code.etag
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
