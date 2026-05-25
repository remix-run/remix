import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IfNoneMatch } from '@remix-run/headers'

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
import type { CompiledRoutes } from '../routes.ts'
import type { ResolvedScriptTarget } from '../target.ts'
import { createModuleStore } from '../module-store.ts'
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
import type { EmittedAsset, EmittedModule } from './emit.ts'

type ScriptRecord = ModuleRecord<TransformedModule, ResolvedModule, EmittedModule>
type ScriptStore = ModuleStore<TransformedModule, ResolvedModule, EmittedModule>

type ScriptCompileResult = {
  code: EmittedAsset
  fingerprint: string | null
  sourceMap: EmittedAsset | null
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
  buildId?: string
  define?: Record<string, string>
  external: string[]
  fingerprintAssets: boolean
  isAllowed(absolutePath: string): boolean
  minify: boolean
  onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
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
  getHref(filePath: string): Promise<string>
  handleFileEvent(filePath: string, event: ModuleWatchEvent): Promise<void>
  parseRequestPathname(pathname: string): ParsedRequestPathname | null
}

type ParsedRequestPathname = {
  cacheControl: string
  filePath: string
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
}

const supportedScriptExtensionSet = new Set<string>(supportedScriptExtensions)
const preloadConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1))

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
    onWatchDirectoriesChange: options.onWatchDirectoriesChange,
  })
  let tsconfigTransformOptionsResolver = createTsconfigTransformOptionsResolver()
  let resolverFactory = new ResolverFactory({
    aliasFields: [['browser']],
    conditionNames: ['browser', 'import', 'module', 'default'],
    extensionAlias: resolverExtensionAlias,
    extensions: resolverExtensions,
    mainFields: ['browser', 'module', 'main'],
    tsconfig: 'auto',
  })
  let resolveInFlightByCacheKey = new Map<string, Promise<ResolvedModule>>()
  let emitInFlightByCacheKey = new Map<string, Promise<EmittedModule>>()

  let transformArgs: TransformArgs = {
    buildId: resolvedOptions.buildId ?? null,
    define: resolvedOptions.define ?? null,
    externalSet: resolvedOptions.externalSet,
    isWatchIgnored,
    minify: resolvedOptions.minify,
    resolveActualPath,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps ?? null,
    target: resolvedOptions.target ?? null,
    tsconfigTransformOptionsResolver,
  }
  let resolveArgs: ResolveArgs = {
    isAllowed: resolvedOptions.isAllowed,
    isWatchIgnored,
    resolveModulePath,
    resolverFactory,
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
          layer.push(getServedUrlForResolvedScript(resolvedModule))

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

    async getHref(filePath) {
      let resolvedModule = resolveServedScriptOrThrow(resolveInputFilePath(filePath))
      return getServedUrl(resolvedModule.identityPath)
    },

    async handleFileEvent(filePath, event) {
      let normalizedFilePath = normalizeFilePath(filePath)
      if (isWatchIgnored(normalizedFilePath)) return

      if (shouldClearResolverCacheForFileEvent(normalizedFilePath, event)) {
        resolverFactory.clearCache()
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

  function resolveServedScriptOrThrow(absolutePath: string): ResolveModuleResult {
    let resolvedModule = resolveModulePath(absolutePath)
    if (!resolvedModule) {
      throw createAssetServerCompilationError(`File not found: ${absolutePath}`, {
        code: 'FILE_NOT_FOUND',
      })
    }

    if (!resolvedOptions.isAllowed(resolvedModule.identityPath)) {
      throw createAssetServerCompilationError(
        `File is not allowed: ${resolvedModule.identityPath}`,
        {
          code: 'FILE_NOT_ALLOWED',
        },
      )
    }

    return resolvedModule
  }

  function getNotModifiedScript(
    record: ScriptRecord,
    options: ScriptGetOptions,
  ): ScriptGetResult | null {
    let current = getNotModifiedResult(record.emitted, options)
    if (current) return current

    if (!record.staleEmittedSnapshot || !isModuleSnapshotFresh(record.staleEmittedSnapshot)) {
      return null
    }

    return getNotModifiedResult(record.staleEmitted, options)
  }

  async function getOrCreateResolvedScripts(records: ScriptRecord[]): Promise<ResolvedModule[]> {
    return mapWithConcurrency(records, preloadConcurrency, (record) =>
      getOrCreateResolvedScript(record),
    )
  }

  async function getOrCreateResolvedScript(record: ScriptRecord): Promise<ResolvedModule> {
    if (record.resolved) return record.resolved

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

  async function getOrCreateTransformedScript(record: ScriptRecord): Promise<TransformedModule> {
    if (record.transformed) return record.transformed

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
    if (record.emitted) return record.emitted

    let cacheKey = getRecordCacheKey(record)
    let existing = emitInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let resolvedModule = await getOrCreateResolvedScript(record)
      let emitResolvedModuleResult = await emitResolvedModule(resolvedModule, {
        getServedUrl,
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

  async function getServedUrl(identityPath: string): Promise<string> {
    return getServedUrlForResolvedScript(
      await getOrCreateResolvedScript(scriptStore.get(identityPath)),
    )
  }

  function getServedUrlForResolvedScript(resolvedModule: ResolvedModule): string {
    return formatFingerprintedPathname(
      resolvedModule.stableUrlPathname,
      resolvedOptions.fingerprintAssets ? resolvedModule.fingerprint : null,
    )
  }

  function isWatchIgnored(filePath: string): boolean {
    return resolvedOptions.watchIgnoreMatchers.some((matcher) => matcher(filePath))
  }
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

  if (
    options.requestedFingerprint !== null &&
    emittedModule.fingerprint !== options.requestedFingerprint
  ) {
    return null
  }

  let asset = getEmittedAssetForRequest(emittedModule, options.isSourceMapRequest)
  if (!asset) return null

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

function isBareImportSpecifier(specifier: string): boolean {
  return (
    !specifier.startsWith('./') &&
    !specifier.startsWith('../') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('file:') &&
    !specifier.startsWith('data:') &&
    !specifier.startsWith('http://') &&
    !specifier.startsWith('https://')
  )
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
