import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IfNoneMatch } from '@remix-run/headers/if-none-match'
import { createAssetServerCompilationError } from '../compilation-error.ts'
import { createFileMatcher } from '../file-matcher.ts'
import { formatFingerprintedPathname } from '../fingerprint.ts'
import { createModuleStore } from '../module-store.ts'
import type { ModuleRecord, ModuleStore } from '../module-store.ts'
import { normalizeFilePath, resolveFilePath } from '../paths.ts'
import type { CompiledRoutes } from '../routes.ts'
import type { ResolvedStyleTarget } from '../target.ts'
import { emitResolvedStyle } from './emit.ts'
import type { EmittedAsset, EmittedStyle } from './emit.ts'
import { resolveServedStyleOrThrow, resolveStyle } from './resolve.ts'
import type { ResolveArgs, ResolvedStyle } from './resolve.ts'
import { transformStyle } from './transform.ts'
import type { TransformArgs, TransformedStyle } from './transform.ts'

type StyleRecord = ModuleRecord<TransformedStyle, ResolvedStyle, EmittedStyle>
type StyleStore = ModuleStore<TransformedStyle, ResolvedStyle, EmittedStyle>
type ResolvedStyleGraphEntry = {
  invalidationVersion: number
  resolvedStyle: ResolvedStyle
}
type ResolvedStyleGraph = ReadonlyMap<string, ResolvedStyleGraphEntry>

type StyleCompileResult = {
  code: EmittedAsset
  fingerprint: string | null
  sourceMap: EmittedAsset | null
}

type StyleGetResult =
  | {
      style: StyleCompileResult
      type: 'style'
    }
  | {
      etag: string
      type: 'not-modified'
    }

type StyleGetOptions = {
  ifNoneMatch: string | null
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
}

type StyleCompilerOptions = {
  fingerprintAssets: boolean
  getServedFileUrl?(
    identityPath: string,
    options: {
      transform: readonly string[] | null
    },
  ): Promise<string>
  hmr?: {
    send(pathname: string, timestamp: number): void
  }
  isAllowed(absolutePath: string): boolean
  isServedFilePath(filePath: string): boolean
  minify: boolean
  onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  onWatchFilesChange?: (delta: { add: string[]; remove: string[] }) => void
  rootDir: string
  routes: CompiledRoutes
  sourceMapSourcePaths: 'absolute' | 'url'
  sourceMaps?: 'external' | 'inline'
  targets?: ResolvedStyleTarget
  watchIgnore?: readonly string[]
}

type StyleCompiler = {
  getHref(filePath: string): Promise<string>
  getPreloadLayers(filePath: string | readonly string[]): Promise<string[][]>
  getStyle(filePath: string, options: StyleGetOptions): Promise<StyleGetResult>
  classifyHmrFileEvent(
    filePath: string,
    event: 'add' | 'change' | 'unlink',
  ): Promise<StyleHmrUpdate[]>
  invalidateFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): void
}

export type StyleHmrUpdate = {
  filePath: string
  path: string
  timestamp: number
}

const preloadConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1))
const styleExtension = '.css'

export function createStyleCompiler(options: StyleCompilerOptions): StyleCompiler {
  let resolvedOptions = {
    ...options,
    watchIgnoreMatchers: (options.watchIgnore ?? []).map((pattern) =>
      createFileMatcher(pattern, options.rootDir),
    ),
  }
  let styleStore: StyleStore = createModuleStore<TransformedStyle, ResolvedStyle, EmittedStyle>({
    getDependencies(resolvedStyle) {
      return resolvedStyle.deps
    },
    onWatchDirectoriesChange: options.onWatchDirectoriesChange,
    onWatchFilesChange: options.onWatchFilesChange,
  })
  let resolveInFlightByCacheKey = new Map<string, Promise<ResolvedStyle>>()
  let emitInFlightByCacheKey = new Map<string, Promise<EmittedStyle>>()
  let resolveArgs: ResolveArgs = {
    isAllowed: resolvedOptions.isAllowed,
    isServedFilePath: resolvedOptions.isServedFilePath,
    isWatchIgnored,
    routes: resolvedOptions.routes,
  }
  let transformArgs: TransformArgs = {
    isWatchIgnored,
    minify: resolvedOptions.minify,
    routes: resolvedOptions.routes,
    sourceMapSourcePaths: resolvedOptions.sourceMapSourcePaths,
    sourceMaps: resolvedOptions.sourceMaps ?? null,
    targets: resolvedOptions.targets ?? null,
  }

  return {
    async getHref(filePath) {
      let resolvedStyle = resolveServedStyleOrThrow(resolveInputFilePath(filePath), resolveArgs)
      let graph = await resolveStyleGraph(resolvedStyle.identityPath)
      return getServedUrlFromGraph(resolvedStyle.identityPath, graph)
    },

    async getPreloadLayers(filePath) {
      let resolvedEntries: string[] = []
      let seen = new Set<string>()

      for (let resolvedStyle of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) =>
        resolveServedStyleOrThrow(resolveInputFilePath(nextPath), resolveArgs),
      )) {
        if (seen.has(resolvedStyle.identityPath)) continue
        seen.add(resolvedStyle.identityPath)
        resolvedEntries.push(resolvedStyle.identityPath)
      }

      let visited = new Set(resolvedEntries)
      let queue = [...resolvedEntries]
      let layers: string[][] = []
      let graph = await resolveStyleGraph(resolvedEntries)

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let layer: string[] = []

        for (let identityPath of frontier) {
          let graphEntry = graph.get(identityPath)
          if (!graphEntry) throw new Error(`Missing resolved style ${identityPath}`)
          let resolvedStyle = graphEntry.resolvedStyle
          layer.push(await getServedUrlFromGraph(identityPath, graph))

          for (let dep of resolvedStyle.deps) {
            if (visited.has(dep)) continue
            visited.add(dep)
            queue.push(dep)
          }
        }

        layers.push(layer)
      }

      return layers
    },

    async getStyle(filePath, getOptions) {
      let resolvedStyle = resolveServedStyleOrThrow(resolveInputFilePath(filePath), resolveArgs)
      let record = styleStore.get(resolvedStyle.identityPath)
      let notModified = getNotModifiedStyle(
        record,
        styleStore,
        getOptions,
        hasHmrTimestampedDependency,
      )
      if (notModified) return notModified

      let emitted = await getOrCreateEmittedStyle(record)
      return {
        style: toStyleCompileResult(emitted),
        type: 'style',
      }
    },

    async classifyHmrFileEvent(filePath, event) {
      let normalizedFilePath = normalizeFilePath(filePath)
      if (isWatchIgnored(normalizedFilePath)) return []
      let timestamp = Date.now()
      let updatePathnames =
        event === 'change' ? getHmrUpdatePathnames(normalizedFilePath, timestamp) : []

      styleStore.invalidateForFileEvent(normalizedFilePath, event)

      for (let updatePathname of updatePathnames) {
        resolvedOptions.hmr?.send(updatePathname, timestamp)
      }
      return updatePathnames.map((path) => ({
        filePath: normalizedFilePath,
        path,
        timestamp,
      }))
    },

    invalidateFileEvent(filePath, event) {
      let normalizedFilePath = normalizeFilePath(filePath)
      if (isWatchIgnored(normalizedFilePath)) return
      styleStore.invalidateForFileEvent(normalizedFilePath, event)
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

  async function getOrCreateResolvedStyle(record: StyleRecord): Promise<ResolvedStyle> {
    if (record.resolved && styleStore.isResolvedFresh(record)) return record.resolved

    let cacheKey = getRecordCacheKey(record)
    let existing = resolveInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let transformedStyle = await getOrCreateTransformedStyle(record)
      let resolvedStyleResult = await resolveStyle(record, transformedStyle, resolveArgs)

      if (!resolvedStyleResult.ok) {
        if (isFresh(record, startedVersion)) {
          styleStore.clearResolved(record.identityPath, [resolvedStyleResult.tracking])
        }
        throw resolvedStyleResult.error
      }

      if (isFresh(record, startedVersion)) {
        styleStore.setResolved(record.identityPath, resolvedStyleResult.value, [
          resolvedStyleResult.tracking,
        ])
      }

      return resolvedStyleResult.value
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

  async function getOrCreateTransformedStyle(record: StyleRecord): Promise<TransformedStyle> {
    if (record.transformed && styleStore.isTransformedFresh(record)) return record.transformed

    let startedVersion = record.invalidationVersion
    let transformStyleResult = await transformStyle(record, transformArgs)

    if (!transformStyleResult.ok) {
      if (isFresh(record, startedVersion)) {
        styleStore.clearTransformed(record.identityPath, [transformStyleResult.tracking])
      }
      throw transformStyleResult.error
    }

    if (isFresh(record, startedVersion)) {
      styleStore.setTransformed(record.identityPath, transformStyleResult.value, [
        transformStyleResult.tracking,
      ])
    }

    return transformStyleResult.value
  }

  async function getOrCreateEmittedStyle(record: StyleRecord): Promise<EmittedStyle> {
    if (
      record.emitted &&
      styleStore.isEmittedFresh(record) &&
      !hasHmrTimestampedDependency(record.resolved)
    ) {
      return record.emitted
    }

    let graph = await resolveStyleGraph(record.identityPath)
    return getOrCreateEmittedStyleFromGraph(record, graph)
  }

  async function getOrCreateEmittedStyleFromGraph(
    record: StyleRecord,
    graph: ResolvedStyleGraph,
  ): Promise<EmittedStyle> {
    let graphEntry = graph.get(record.identityPath)
    if (!graphEntry) {
      throw new Error(`Missing resolved style ${record.identityPath}`)
    }

    if (
      record.invalidationVersion === graphEntry.invalidationVersion &&
      record.emitted &&
      styleStore.isEmittedFresh(record) &&
      !hasHmrTimestampedDependency(record.resolved)
    ) {
      return record.emitted
    }

    let cacheKey = getCacheKey(record.identityPath, graphEntry.invalidationVersion)
    let existing = emitInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let emitResolvedStyleResult = await emitResolvedStyle(graphEntry.resolvedStyle, {
        fingerprintAssets: resolvedOptions.fingerprintAssets,
        getServedFileUrl: resolvedOptions.getServedFileUrl,
        getServedUrl(identityPath) {
          return getServedUrlFromGraph(identityPath, graph)
        },
        sourceMaps: resolvedOptions.sourceMaps,
      })

      if (!emitResolvedStyleResult.ok) {
        throw emitResolvedStyleResult.error
      }

      if (isFresh(record, graphEntry.invalidationVersion)) {
        styleStore.setEmitted(record.identityPath, emitResolvedStyleResult.value, null)
      }

      return emitResolvedStyleResult.value
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

  async function getServedUrlFromGraph(
    identityPath: string,
    graph: ResolvedStyleGraph,
  ): Promise<string> {
    let graphEntry = graph.get(identityPath)
    if (!graphEntry) throw new Error(`Missing resolved style ${identityPath}`)
    let pathname = graphEntry.resolvedStyle.stableUrlPathname

    if (resolvedOptions.fingerprintAssets) {
      let emittedStyle = await getOrCreateEmittedStyleFromGraph(styleStore.get(identityPath), graph)
      pathname = formatFingerprintedPathname(
        graphEntry.resolvedStyle.stableUrlPathname,
        emittedStyle.fingerprint,
      )
    }

    let timestamp = styleStore.getHmrUpdateTimestamp(graphEntry.resolvedStyle.identityPath)
    return timestamp ? appendTimestamp(pathname, timestamp) : pathname
  }

  async function resolveStyleGraph(
    rootPath: string | readonly string[],
  ): Promise<ResolvedStyleGraph> {
    let resolvedByPath = new Map<string, ResolvedStyleGraphEntry>()
    let rootPaths = Array.isArray(rootPath) ? rootPath : [rootPath]
    let discovered = new Set(rootPaths)
    let queue = [...rootPaths]

    while (queue.length > 0) {
      let frontier = queue
      queue = []
      let graphEntries = await mapWithConcurrency(
        frontier,
        preloadConcurrency,
        async (identityPath): Promise<ResolvedStyleGraphEntry> => {
          let record = styleStore.get(identityPath)
          let invalidationVersion = record.invalidationVersion
          let resolvedStyle = await getOrCreateResolvedStyle(record)
          return {
            invalidationVersion,
            resolvedStyle,
          }
        },
      )

      for (let [index, identityPath] of frontier.entries()) {
        let graphEntry = graphEntries[index]
        resolvedByPath.set(identityPath, graphEntry)
        for (let depPath of graphEntry.resolvedStyle.deps) {
          if (discovered.has(depPath)) continue
          discovered.add(depPath)
          queue.push(depPath)
        }
      }
    }

    assertNoCircularImports(resolvedByPath, rootPaths)
    return resolvedByPath
  }

  function assertNoCircularImports(graph: ResolvedStyleGraph, rootPaths: readonly string[]): void {
    let visited = new Set<string>()
    let path: string[] = []
    let pathIndexByIdentity = new Map<string, number>()

    function visit(identityPath: string): void {
      let cycleStart = pathIndexByIdentity.get(identityPath)
      if (cycleStart !== undefined) {
        let cycle = [...path.slice(cycleStart), identityPath]
        throw createAssetServerCompilationError(
          `Circular CSS imports are not supported: ${cycle.join(' -> ')}`,
          { code: 'EMIT_FAILED' },
        )
      }
      if (visited.has(identityPath)) return

      let graphEntry = graph.get(identityPath)
      if (!graphEntry) throw new Error(`Missing resolved style ${identityPath}`)
      pathIndexByIdentity.set(identityPath, path.length)
      path.push(identityPath)
      for (let depPath of graphEntry.resolvedStyle.deps) visit(depPath)
      path.pop()
      pathIndexByIdentity.delete(identityPath)
      visited.add(identityPath)
    }

    for (let identityPath of rootPaths) visit(identityPath)
  }

  function getHmrUpdatePathnames(identityPath: string, timestamp: number): string[] {
    let resolvedStyles = findHmrUpdateStyles(identityPath, new Set())
    // Mark update timestamps before invalidating so re-emitted importer stylesheets
    // can rewrite imports to the changed dependency with this HMR timestamp.
    for (let resolvedStyle of resolvedStyles) {
      styleStore.setHmrUpdateTimestamp(resolvedStyle.identityPath, timestamp)
    }

    return dedupeHmrUpdatePathnames(
      resolvedStyles
        .filter((resolvedStyle) => styleStore.getImporters(resolvedStyle.identityPath).size === 0)
        .map((resolvedStyle) => resolvedStyle.stableUrlPathname),
    )
  }

  function findHmrUpdateStyles(identityPath: string, traversed: Set<string>): ResolvedStyle[] {
    if (traversed.has(identityPath)) return []
    traversed.add(identityPath)

    let resolvedStyle = styleStore.getLastResolved(identityPath)
    if (!resolvedStyle) return []

    let resolvedStyles = [resolvedStyle]
    for (let importerPath of styleStore.getImporters(identityPath)) {
      resolvedStyles.push(...findHmrUpdateStyles(importerPath, traversed))
    }

    return resolvedStyles
  }

  function hasHmrTimestampedDependency(resolvedStyle: ResolvedStyle | undefined): boolean {
    return (
      resolvedStyle?.deps.some((depPath) => styleStore.getHmrUpdateTimestamp(depPath) != null) ===
      true
    )
  }

  function isWatchIgnored(filePath: string): boolean {
    return resolvedOptions.watchIgnoreMatchers.some((matcher) => matcher(filePath))
  }
}

function getRecordCacheKey(record: StyleRecord): string {
  return getCacheKey(record.identityPath, record.invalidationVersion)
}

function getCacheKey(identityPath: string, version: number): string {
  return `${identityPath}\0${version}`
}

function isFresh(record: StyleRecord, version: number): boolean {
  return record.invalidationVersion === version
}

function getNotModifiedStyle(
  record: StyleRecord,
  styleStore: StyleStore,
  options: StyleGetOptions,
  hasHmrTimestampedDependency: (resolvedStyle: ResolvedStyle | undefined) => boolean,
): StyleGetResult | null {
  if (hasHmrTimestampedDependency(record.resolved)) return null
  if (!styleStore.isEmittedFresh(record)) return null
  let emittedStyle = record.emitted
  if (!emittedStyle || options.ifNoneMatch === null) return null

  let asset = getEmittedAssetForRequest(emittedStyle, options.isSourceMapRequest)
  if (!asset) return null

  if (options.requestedFingerprint !== null && asset.fingerprint !== options.requestedFingerprint) {
    return null
  }

  if (!IfNoneMatch.from(options.ifNoneMatch).matches(asset.etag)) return null
  return { etag: asset.etag, type: 'not-modified' }
}

function appendTimestamp(pathname: string, timestamp: number): string {
  return `${pathname}${pathname.includes('?') ? '&' : '?'}t=${timestamp}`
}

function dedupeHmrUpdatePathnames(pathnames: string[]): string[] {
  return [...new Set(pathnames)]
}

function getEmittedAssetForRequest(
  emittedStyle: EmittedStyle,
  isSourceMapRequest: boolean,
): EmittedAsset | null {
  return isSourceMapRequest ? emittedStyle.sourceMap : emittedStyle.code
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

function toStyleCompileResult(emittedStyle: EmittedStyle): StyleCompileResult {
  return {
    code: emittedStyle.code,
    fingerprint: emittedStyle.fingerprint,
    sourceMap: emittedStyle.sourceMap,
  }
}

export function isStyleFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === styleExtension
}

export function createResponseForStyle(
  result: StyleCompileResult,
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
    contentType = 'text/css; charset=utf-8'
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
