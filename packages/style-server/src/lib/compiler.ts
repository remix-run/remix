import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IfNoneMatch } from '@remix-run/headers'
import type { Targets } from 'lightningcss'

import { createStyleServerCompilationError } from './compilation-error.ts'
import { emitResolvedStyle, type EmittedAsset, type EmittedStyle } from './emit.ts'
import {
  formatFingerprintedPathname,
  generateFingerprint,
  getFingerprintRequestCacheControl,
  parseFingerprintSuffix,
} from './fingerprint.ts'
import { normalizeFilePath, resolveFilePath } from './paths.ts'
import { resolveServedFileOrThrow, resolveStyle } from './resolve.ts'
import type { ResolveArgs, ResolvedStyle } from './resolve.ts'
import type { CompiledRoutes } from './routes.ts'
import { createStyleStore } from './store.ts'
import type { StyleRecord, StyleWatchEvent as StoreStyleWatchEvent } from './store.ts'
import { transformStyle } from './transform.ts'
import type { TransformArgs, TransformedStyle } from './transform.ts'

export type CompiledStyleResult = {
  code: EmittedAsset
  fingerprint: string | null
  sourceMap: EmittedAsset | null
}

type StyleCompilerOptions = {
  buildId?: string
  browserslistTargets?: Targets
  fingerprintFiles: boolean
  isAllowed(absolutePath: string): boolean
  minify: boolean
  root: string
  routes: CompiledRoutes
  sourceMaps?: 'external' | 'inline'
}

type ParsedRequestPathname = {
  cacheControl: string
  filePath: string
  isSourceMapRequest: boolean
  requestedFingerprint: string | null
}

type StyleCompiler = {
  compileStyle(filePath: string): Promise<CompiledStyleResult>
  getFingerprint(filePath: string): Promise<string | null>
  getHref(filePath: string): Promise<string>
  getPreloadUrls(filePath: string | readonly string[]): Promise<string[]>
  handleFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): Promise<void>
  isStyleFile(filePath: string): boolean
  parseRequestPathname(pathname: string): ParsedRequestPathname | null
}

const preloadConcurrency = Math.max(1, Math.min(8, os.availableParallelism() - 1))
const styleExtensions = new Set(['.css'])

export function createStyleCompiler(options: StyleCompilerOptions): StyleCompiler {
  let store = createStyleStore()
  let resolveInFlightByIdentityPath = new Map<string, Promise<ResolvedStyle>>()
  let emitInFlightByIdentityPath = new Map<string, Promise<EmittedStyle>>()
  let resolveArgs: ResolveArgs = {
    isAllowed: options.isAllowed,
    routes: options.routes,
  }
  let assetFingerprintCache = new Map<string, Promise<string | null>>()
  let transformArgs: TransformArgs = {
    buildId: options.buildId ?? null,
    targets: options.browserslistTargets ?? null,
    minify: options.minify,
    routes: options.routes,
    sourceMaps: options.sourceMaps ?? null,
  }

  return {
    async compileStyle(filePath) {
      let resolved = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs)
      if (!isStyleFilePath(resolved.identityPath)) {
        throw createStyleServerCompilationError(
          `Expected a CSS file, received "${resolved.identityPath}".`,
          {
            code: 'STYLE_TRANSFORM_FAILED',
          },
        )
      }

      return toCompiledStyleResult(await getOrCreateEmittedStyle(store.get(resolved.identityPath)))
    },

    async getFingerprint(filePath) {
      let resolved = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs)
      return getFingerprintForIdentityPath(resolved.identityPath)
    },

    async getHref(filePath) {
      let resolved = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs)
      return getServedUrl(resolved.identityPath)
    },

    async getPreloadUrls(filePath) {
      let resolvedEntries: string[] = []
      let seen = new Set<string>()
      let urls: string[] = []

      for (let resolved of (Array.isArray(filePath) ? filePath : [filePath]).map((nextPath) =>
        resolveServedFileOrThrow(resolveInputFilePath(nextPath), resolveArgs),
      )) {
        if (seen.has(resolved.identityPath)) continue
        seen.add(resolved.identityPath)
        if (isStyleFilePath(resolved.identityPath)) {
          resolvedEntries.push(resolved.identityPath)
        } else {
          urls.push(await getServedUrl(resolved.identityPath))
        }
      }

      let visited = new Set(resolvedEntries)
      let queue = [...resolvedEntries]

      while (queue.length > 0) {
        let frontier = queue
        queue = []
        let resolvedStyles = await getOrCreateResolvedStyles(
          frontier.map((identityPath) => store.get(identityPath)),
        )

        for (let resolvedStyle of resolvedStyles) {
          urls.push(getServedUrlForResolvedStyle(resolvedStyle))

          for (let dep of resolvedStyle.deps) {
            if (visited.has(dep)) continue
            visited.add(dep)
            queue.push(dep)
          }
        }
      }

      return urls
    },

    async handleFileEvent(filePath, event) {
      assetFingerprintCache.clear()
      store.invalidateForFileEvent(normalizeFilePath(filePath), toStoreWatchEvent(event))
    },

    isStyleFile(filePath) {
      return isStyleFilePath(filePath)
    },

    parseRequestPathname(pathname) {
      let parsedPathname = parseServedPathname(pathname)
      let filePath = options.routes.resolveUrlPathname(parsedPathname.stablePathname)
      if (!filePath) return null
      if (
        options.fingerprintFiles &&
        parsedPathname.requestedFingerprint === null &&
        !parsedPathname.isSourceMapRequest
      ) {
        return null
      }

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

    return resolveFilePath(options.root, filePath)
  }

  async function getOrCreateResolvedStyles(records: StyleRecord[]): Promise<ResolvedStyle[]> {
    return mapWithConcurrency(records, preloadConcurrency, (record) =>
      getOrCreateResolvedStyle(record),
    )
  }

  async function getOrCreateResolvedStyle(record: StyleRecord): Promise<ResolvedStyle> {
    if (record.resolved) return record.resolved

    let existing = resolveInFlightByIdentityPath.get(record.identityPath)
    if (existing) return existing

    let promise = (async () => {
      let startedAt = Date.now()
      let transformedStyle = await getOrCreateTransformedStyle(record)
      let resolvedStyleResult = await resolveStyle(record, transformedStyle, resolveArgs)

      if (!resolvedStyleResult.ok) {
        if (startedAt >= record.lastInvalidatedAt) {
          store.setResolveFailure(record.identityPath, resolvedStyleResult.tracking)
        }
        throw resolvedStyleResult.error
      }

      if (startedAt >= record.lastInvalidatedAt) {
        store.setResolved(record.identityPath, resolvedStyleResult.value)
      }

      return resolvedStyleResult.value
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

  async function getOrCreateTransformedStyle(record: StyleRecord): Promise<TransformedStyle> {
    if (record.transformed) return record.transformed

    let startedAt = Date.now()
    let transformStyleResult = await transformStyle(record, transformArgs)

    if (!transformStyleResult.ok) {
      if (startedAt >= record.lastInvalidatedAt) {
        store.setTransformFailure(record.identityPath, {
          trackedFiles: transformStyleResult.trackedFiles,
        })
      }
      throw transformStyleResult.error
    }

    if (startedAt >= record.lastInvalidatedAt) {
      store.setTransformed(record.identityPath, transformStyleResult.value)
    }

    return transformStyleResult.value
  }

  async function getOrCreateEmittedStyle(record: StyleRecord): Promise<EmittedStyle> {
    if (record.emitted) return record.emitted

    let existing = emitInFlightByIdentityPath.get(record.identityPath)
    if (existing) return existing

    let promise = (async () => {
      let startedAt = Date.now()
      let resolvedStyle = await getOrCreateResolvedStyle(record)
      let emitResolvedStyleResult = await emitResolvedStyle(resolvedStyle, {
        getServedUrl,
        sourceMaps: options.sourceMaps,
      })

      if (!emitResolvedStyleResult.ok) {
        throw emitResolvedStyleResult.error
      }

      if (startedAt >= record.lastInvalidatedAt) {
        store.setEmitted(record.identityPath, emitResolvedStyleResult.value)
      }

      return emitResolvedStyleResult.value
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
    if (isStyleFilePath(identityPath)) {
      return getServedUrlForResolvedStyle(await getOrCreateResolvedStyle(store.get(identityPath)))
    }

    let stableUrlPathname = options.routes.toUrlPathname(identityPath)
    if (!stableUrlPathname) {
      throw createStyleServerCompilationError(
        `File is outside configured style-server routes: ${identityPath}`,
        {
          code: 'FILE_OUTSIDE_ROUTES',
        },
      )
    }

    return formatFingerprintedPathname(stableUrlPathname, await getAssetFingerprint(identityPath))
  }

  async function getFingerprintForIdentityPath(identityPath: string): Promise<string | null> {
    if (isStyleFilePath(identityPath)) {
      return (await getOrCreateResolvedStyle(store.get(identityPath))).fingerprint
    }

    return getAssetFingerprint(identityPath)
  }

  function getServedUrlForResolvedStyle(resolvedStyle: ResolvedStyle): string {
    return formatFingerprintedPathname(
      resolvedStyle.stableUrlPathname,
      options.fingerprintFiles ? resolvedStyle.fingerprint : null,
    )
  }

  async function getAssetFingerprint(identityPath: string): Promise<string | null> {
    if (!options.fingerprintFiles) return null

    let existing = assetFingerprintCache.get(identityPath)
    if (existing) return existing

    let promise = (async () =>
      generateFingerprint({
        buildId: options.buildId!,
        content: new Uint8Array(await fs.promises.readFile(identityPath)),
      }))()

    assetFingerprintCache.set(identityPath, promise)

    try {
      return await promise
    } catch (error) {
      assetFingerprintCache.delete(identityPath)
      throw error
    }
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

function isStyleFilePath(filePath: string): boolean {
  return styleExtensions.has(path.extname(filePath).toLowerCase())
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

function toCompiledStyleResult(emittedStyle: EmittedStyle): CompiledStyleResult {
  return {
    code: emittedStyle.code,
    fingerprint: emittedStyle.fingerprint,
    sourceMap: emittedStyle.sourceMap,
  }
}

function toStoreWatchEvent(event: 'add' | 'change' | 'unlink'): StoreStyleWatchEvent {
  if (event === 'unlink') return 'delete'
  return event
}

export function createResponseForStyle(
  result: CompiledStyleResult,
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
