import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IfNoneMatch } from '@remix-run/headers'

import { createAssetServerCompilationError } from '../compilation-error.ts'
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
import type { ScriptsTarget } from '../asset-server.ts'
import { createModuleStore } from './store.ts'
import type { ModuleRecord } from './store.ts'
import type { ModuleWatchEvent as StoreModuleWatchEvent } from './store.ts'
import { createTsconfigTransformOptionsResolver, transformModule } from './transform.ts'
import type { ResolveModuleResult, TransformArgs, TransformedModule } from './transform.ts'
import { ResolverFactory } from 'oxc-resolver'
import type { EmittedAsset, EmittedModule } from './emit.ts'

type ModuleCompileResult = {
  code: EmittedAsset
  fingerprint: string | null
  sourceMap: EmittedAsset | null
}

type ModuleCompilerOptions = {
  buildId?: string
  define?: Record<string, string>
  external: string[]
  fingerprintModules: boolean
  isAllowed(absolutePath: string): boolean
  minify: boolean
  root: string
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
  target?: ScriptsTarget
}

type ModuleWatchEvent = 'add' | 'change' | 'unlink'

type ModuleCompiler = {
  compileModule(filePath: string): Promise<ModuleCompileResult>
  getPreloadUrls(filePath: string | readonly string[]): Promise<string[]>
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

export function createModuleCompiler(options: ModuleCompilerOptions): ModuleCompiler {
  let resolvedOptions = {
    ...options,
    externalSet: new Set(options.external),
  }
  let store = createModuleStore()
  let tsconfigTransformOptionsResolver = createTsconfigTransformOptionsResolver()
  let resolverFactory = new ResolverFactory({
    aliasFields: [['browser']],
    conditionNames: ['browser', 'import', 'module', 'default'],
    extensionAlias: resolverExtensionAlias,
    extensions: resolverExtensions,
    mainFields: ['browser', 'module', 'main'],
    tsconfig: 'auto',
  })
  let resolveInFlightByIdentityPath = new Map<string, Promise<ResolvedModule>>()
  let emitInFlightByIdentityPath = new Map<string, Promise<EmittedModule>>()

  let transformArgs: TransformArgs = {
    buildId: resolvedOptions.buildId ?? null,
    define: resolvedOptions.define ?? null,
    externalSet: resolvedOptions.externalSet,
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
    resolveModulePath,
    resolverFactory,
    routes: resolvedOptions.routes,
  }

  return {
    async compileModule(filePath) {
      let resolvedModule = resolveServedModuleOrThrow(resolveInputFilePath(filePath))
      let record = store.get(resolvedModule.identityPath)
      let emitted = await getOrCreateEmittedModule(record)
      return toModuleCompileResult(emitted)
    },

    async getPreloadUrls(filePath) {
      let resolvedEntries: string[] = []
      let seen = new Set<string>()

      for (let resolvedModule of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) =>
        resolveServedModuleOrThrow(resolveInputFilePath(nextPath)),
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
        let resolvedModules = await getOrCreateResolvedModules(
          frontier.map((identityPath) => store.get(identityPath)),
        )

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

    async getHref(filePath) {
      let resolvedModule = resolveServedModuleOrThrow(resolveInputFilePath(filePath))
      return getServedUrl(resolvedModule.identityPath)
    },

    async handleFileEvent(filePath, event) {
      let normalizedFilePath = normalizeFilePath(filePath)
      resolverFactory.clearCache()

      if (isTsconfigPath(normalizedFilePath)) {
        tsconfigTransformOptionsResolver.clear()
        store.invalidateAll()
        return
      }

      if (isPackageJsonPath(normalizedFilePath)) {
        store.invalidateAll()
        return
      }

      store.invalidateForFileEvent(normalizedFilePath, toStoreWatchEvent(event))
    },

    parseRequestPathname(pathname) {
      let parsedPathname = parseServedPathname(pathname)
      let filePath = resolvedOptions.routes.resolveUrlPathname(parsedPathname.stablePathname)
      if (!filePath) return null
      if (resolvedOptions.fingerprintModules && parsedPathname.requestedFingerprint === null)
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

    return resolveFilePath(resolvedOptions.root, filePath)
  }

  function resolveServedModuleOrThrow(absolutePath: string): ResolveModuleResult {
    let resolvedModule = resolveModulePath(absolutePath)
    if (!resolvedModule) {
      throw createAssetServerCompilationError(`Module not found: ${absolutePath}`, {
        code: 'MODULE_NOT_FOUND',
      })
    }

    if (!resolvedOptions.isAllowed(resolvedModule.identityPath)) {
      throw createAssetServerCompilationError(
        `Module is not allowed: ${resolvedModule.identityPath}`,
        {
          code: 'MODULE_NOT_ALLOWED',
        },
      )
    }

    return resolvedModule
  }

  async function getOrCreateResolvedModules(records: ModuleRecord[]): Promise<ResolvedModule[]> {
    return mapWithConcurrency(records, preloadConcurrency, (record) =>
      getOrCreateResolvedModule(record),
    )
  }

  async function getOrCreateResolvedModule(record: ModuleRecord): Promise<ResolvedModule> {
    if (record.resolved) return record.resolved

    let existing = resolveInFlightByIdentityPath.get(record.identityPath)
    if (existing) return existing

    let promise = (async () => {
      let startedAt = Date.now()
      let transformedModule = await getOrCreateTransformedModule(record)
      let resolveModuleResult = await resolveModule(record, transformedModule, resolveArgs)

      if (!resolveModuleResult.ok) {
        if (startedAt >= record.lastInvalidatedAt) {
          store.setResolveFailure(record.identityPath, resolveModuleResult.tracking)
        }
        throw resolveModuleResult.error
      }

      if (startedAt >= record.lastInvalidatedAt) {
        store.setResolved(record.identityPath, resolveModuleResult.value)
      }

      return resolveModuleResult.value
    })()

    resolveInFlightByIdentityPath.set(record.identityPath, promise)

    try {
      return await promise
    } finally {
      if (resolveInFlightByIdentityPath.get(record.identityPath) === promise) {
        resolveInFlightByIdentityPath.delete(record.identityPath)
      }
    }
  }

  async function getOrCreateTransformedModule(record: ModuleRecord): Promise<TransformedModule> {
    if (record.transformed) return record.transformed

    let startedAt = Date.now()
    let transformModuleResult = await transformModule(record, transformArgs)

    if (!transformModuleResult.ok) {
      if (startedAt >= record.lastInvalidatedAt) {
        store.setTransformFailure(record.identityPath, {
          trackedFiles: transformModuleResult.trackedFiles,
        })
      }
      throw transformModuleResult.error
    }

    if (startedAt >= record.lastInvalidatedAt) {
      store.setTransformed(record.identityPath, transformModuleResult.value)
    }

    return transformModuleResult.value
  }

  async function getOrCreateEmittedModule(record: ModuleRecord): Promise<EmittedModule> {
    if (record.emitted) return record.emitted

    let existing = emitInFlightByIdentityPath.get(record.identityPath)
    if (existing) return existing

    let promise = (async () => {
      let startedAt = Date.now()
      let resolvedModule = await getOrCreateResolvedModule(record)
      let emitResolvedModuleResult = await emitResolvedModule(resolvedModule, {
        getServedUrl,
        sourceMaps: resolvedOptions.sourceMaps,
      })

      if (!emitResolvedModuleResult.ok) {
        throw emitResolvedModuleResult.error
      }

      if (startedAt >= record.lastInvalidatedAt) {
        store.setEmitted(record.identityPath, emitResolvedModuleResult.value)
      }

      return emitResolvedModuleResult.value
    })()

    emitInFlightByIdentityPath.set(record.identityPath, promise)

    try {
      return await promise
    } finally {
      if (emitInFlightByIdentityPath.get(record.identityPath) === promise) {
        emitInFlightByIdentityPath.delete(record.identityPath)
      }
    }
  }

  async function getServedUrl(identityPath: string): Promise<string> {
    return getServedUrlForResolvedModule(await getOrCreateResolvedModule(store.get(identityPath)))
  }

  function getServedUrlForResolvedModule(resolvedModule: ResolvedModule): string {
    return formatFingerprintedPathname(
      resolvedModule.stableUrlPathname,
      resolvedOptions.fingerprintModules ? resolvedModule.fingerprint : null,
    )
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

function toModuleCompileResult(emittedModule: EmittedModule): ModuleCompileResult {
  return {
    code: emittedModule.code,
    fingerprint: emittedModule.fingerprint,
    sourceMap: emittedModule.sourceMap,
  }
}

function toStoreWatchEvent(event: ModuleWatchEvent): StoreModuleWatchEvent {
  if (event === 'unlink') return 'delete'
  return event
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

function isPackageJsonPath(filePath: string): boolean {
  return path.posix.basename(filePath) === 'package.json'
}

function isTsconfigPath(filePath: string): boolean {
  return /^tsconfig(?:\..+)?\.json$/.test(path.posix.basename(filePath))
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
