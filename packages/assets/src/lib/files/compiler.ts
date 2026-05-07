import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FileStorage } from '@remix-run/file-storage'
import { IfNoneMatch } from '@remix-run/headers'
import { detectContentType } from '@remix-run/mime'
import {
  createAssetServerCompilationError,
  isAssetServerCompilationError,
} from '../compilation-error.ts'
import { formatFingerprintedPathname, generateFingerprint, hashContent } from '../fingerprint.ts'
import { normalizeFilePath, resolveFilePath } from '../paths.ts'
import type { CompiledRoutes } from '../routes.ts'
import type { AssetFileTransformResult, AssetRequestTransformMap } from './config.ts'
import { parseAssetTransformInvocations } from './config.ts'
import { createSourceFileStore } from './store.ts'
import type {
  FileSnapshot,
  SourceFileMetadata,
  SourceFileRecord,
  SourceFileStore,
} from './store.ts'

type EmittedFile = {
  body: Uint8Array
  contentType: string
  etag: string
  extension: string
  fingerprint: string | null
}

type EmittedFileMetadata = Omit<EmittedFile, 'body'>

type FileCompileResult = EmittedFile

type FileGetResult =
  | {
      etag: string
      type: 'not-modified'
    }
  | {
      file: FileCompileResult
      type: 'file'
    }

type FileGetOptions = {
  ifNoneMatch: string | null
  requestedFingerprint: string | null
  transform: readonly string[] | null
}

type FileGetHrefOptions = {
  transform: readonly string[] | null
}

type FileCompilerOptions<transforms extends AssetRequestTransformMap = {}> = {
  buildId?: string
  cache?: FileStorage
  extensions: readonly string[]
  fingerprintAssets: boolean
  globalTransforms: readonly {
    extensions?: readonly string[]
    name?: string
    transform(
      bytes: Uint8Array,
      context: {
        extension: string
        filePath: string
      },
    ):
      | string
      | Uint8Array
      | AssetFileTransformResult
      | null
      | Promise<string | Uint8Array | AssetFileTransformResult | null>
  }[]
  isAllowed(absolutePath: string): boolean
  maxRequestTransforms: number
  onWatchDirectoriesChange?: (delta: { add: string[]; remove: string[] }) => void
  transforms: transforms
  rootDir: string
  routes: CompiledRoutes
}

export type FileCompiler = {
  getFile(filePath: string, options: FileGetOptions): Promise<FileGetResult>
  getHref(filePath: string, options: FileGetHrefOptions): Promise<string>
  handleFileEvent(filePath: string, event: 'add' | 'change' | 'unlink'): Promise<void>
  isServedFilePath(filePath: string): boolean
  validateTransformQuery(transformQuery: readonly string[]): void
}

type ResolveArgs = {
  extensions: ReadonlySet<string>
  isAllowed(absolutePath: string): boolean
  routes: CompiledRoutes
}

type ResolvedFile = {
  identityPath: string
  stableUrlPathname: string
}

type ParsedRequestTransform = {
  name: string
  param: string | undefined
}

export function createFileCompiler<transforms extends AssetRequestTransformMap>(
  options: FileCompilerOptions<transforms>,
): FileCompiler {
  let resolvedOptions = {
    ...options,
    extensionSet: new Set(options.extensions),
  }
  let sourceFileStore: SourceFileStore = createSourceFileStore({
    onWatchDirectoriesChange: options.onWatchDirectoriesChange,
  })
  let sourceFileInFlightByCacheKey = new Map<string, Promise<EmittedFile>>()
  let transformedAssetMetadataByCacheKey = new Map<string, EmittedFileMetadata>()
  let transformedCacheKeysByIdentityPath = new Map<string, Set<string>>()
  let transformedEmitInFlightByCacheKey = new Map<string, Promise<EmittedFile>>()
  let cacheEpoch = resolvedOptions.buildId ?? crypto.randomUUID()
  let resolveArgs: ResolveArgs = {
    extensions: resolvedOptions.extensionSet,
    isAllowed: resolvedOptions.isAllowed,
    routes: resolvedOptions.routes,
  }

  return {
    async getFile(filePath, getOptions) {
      let resolvedFile = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs)
      let record = getFreshSourceFileRecord(resolvedFile.identityPath)
      if (shouldUseTransformPipeline(getOptions.transform)) {
        let cacheKey = getTransformedRecordCacheKey(cacheEpoch, record, getOptions.transform)
        let notModified = getNotModifiedFile(
          transformedAssetMetadataByCacheKey.get(cacheKey),
          getOptions,
        )
        if (notModified) return notModified

        let transformedFile = await getOrCreateTransformedFile(record, getOptions.transform)
        notModified = getNotModifiedFile(toEmittedFileMetadata(transformedFile), getOptions)
        if (notModified) return notModified

        return {
          file: transformedFile,
          type: 'file',
        }
      }

      let notModified = getNotModifiedFile(record.metadata, getOptions)
      if (notModified) return notModified

      if (
        record.staleMetadata &&
        record.staleMetadataSnapshot &&
        isFileSnapshotFresh(record.staleMetadataSnapshot)
      ) {
        let staleNotModified = getNotModifiedFile(record.staleMetadata, getOptions)
        if (staleNotModified) return staleNotModified
      }

      let file = await getOrCreateSourceFile(record)
      return {
        file,
        type: 'file',
      }
    },

    async getHref(filePath, hrefOptions) {
      let resolvedFile = resolveServedFileOrThrow(resolveInputFilePath(filePath), resolveArgs)
      let record = getFreshSourceFileRecord(resolvedFile.identityPath)
      let href = resolvedOptions.fingerprintAssets
        ? formatFingerprintedPathname(
            resolvedFile.stableUrlPathname,
            (await getOrCreateSourceFileMetadata(record)).fingerprint,
          )
        : resolvedFile.stableUrlPathname

      if (shouldUseTransformPipeline(hrefOptions.transform)) {
        return appendTransformQuery(href, hrefOptions.transform)
      }

      return href
    },

    async handleFileEvent(filePath, event) {
      if (!isServedFilePath(filePath, resolvedOptions.extensionSet)) return
      sourceFileStore.invalidateForFileEvent(filePath, event)
      clearTransformedCacheIndex(filePath)
    },

    isServedFilePath(filePath) {
      return isServedFilePath(filePath, resolvedOptions.extensionSet)
    },
    validateTransformQuery(transformQuery) {
      parseRequestTransforms(
        transformQuery,
        resolvedOptions.transforms,
        resolvedOptions.maxRequestTransforms,
      )
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

  function shouldUseTransformPipeline(transformQuery: readonly string[] | null): boolean {
    return (
      (transformQuery !== null && transformQuery.length > 0) ||
      resolvedOptions.globalTransforms.length > 0
    )
  }

  function getFreshSourceFileRecord(identityPath: string): SourceFileRecord {
    let record = sourceFileStore.get(identityPath)
    if (record.metadataSnapshot && !isFileSnapshotFresh(record.metadataSnapshot)) {
      sourceFileStore.invalidate(identityPath)
      clearTransformedCacheIndex(identityPath)
      record = sourceFileStore.get(identityPath)
    }

    return record
  }

  async function getOrCreateSourceFile(record: SourceFileRecord): Promise<EmittedFile> {
    let cacheKey = getRecordCacheKey(record)
    let existing = sourceFileInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let startedVersion = record.invalidationVersion
      let body = await readFileContents(record.identityPath)
      let sourceFile = record.metadata
        ? createEmittedFileFromMetadata(body, record.metadata)
        : await createSourceFile(body, record.identityPath)

      if (record.invalidationVersion === startedVersion && !record.metadata) {
        sourceFileStore.set(
          record.identityPath,
          toEmittedFileMetadata(sourceFile),
          getFileSnapshot(record.identityPath),
        )
      }

      return sourceFile
    })()

    sourceFileInFlightByCacheKey.set(cacheKey, promise)

    try {
      return await promise
    } finally {
      if (sourceFileInFlightByCacheKey.get(cacheKey) === promise) {
        sourceFileInFlightByCacheKey.delete(cacheKey)
      }
    }
  }

  async function getOrCreateSourceFileMetadata(
    record: SourceFileRecord,
  ): Promise<SourceFileMetadata> {
    if (record.metadata) return record.metadata
    return toEmittedFileMetadata(await getOrCreateSourceFile(record))
  }

  async function getOrCreateTransformedFile(
    record: SourceFileRecord,
    transformQuery: readonly string[] | null,
  ): Promise<EmittedFile> {
    let parsedTransforms = parseRequestTransforms(
      transformQuery,
      resolvedOptions.transforms,
      resolvedOptions.maxRequestTransforms,
    )
    let cacheKey = getTransformedRecordCacheKey(cacheEpoch, record, transformQuery)
    let existing = transformedEmitInFlightByCacheKey.get(cacheKey)
    if (existing) return existing

    let promise = (async () => {
      let sourceFile = await getOrCreateSourceFile(record)
      let cachedFile = await getCachedTransformedFile(
        cacheKey,
        record.identityPath,
        sourceFile.fingerprint,
      )
      if (cachedFile) return cachedFile

      let transformedFile = await applyTransforms(record.identityPath, sourceFile, parsedTransforms)
      if (transformedFile === null) {
        return sourceFile
      }

      let emittedFile = await createEmittedFile(transformedFile.body, {
        extension: transformedFile.extension,
        filePath: record.identityPath,
        fingerprint: sourceFile.fingerprint,
      })
      rememberTransformedAssetMetadata(
        cacheKey,
        record.identityPath,
        toEmittedFileMetadata(emittedFile),
      )
      await setCachedTransformedFile(cacheKey, record.identityPath, emittedFile)
      return emittedFile
    })()

    transformedEmitInFlightByCacheKey.set(cacheKey, promise)

    try {
      return await promise
    } finally {
      if (transformedEmitInFlightByCacheKey.get(cacheKey) === promise) {
        transformedEmitInFlightByCacheKey.delete(cacheKey)
      }
    }
  }

  async function createSourceFile(body: Uint8Array, identityPath: string): Promise<EmittedFile> {
    return createEmittedFile(body, {
      extension: path.extname(identityPath).toLowerCase(),
      filePath: identityPath,
      fingerprint:
        resolvedOptions.fingerprintAssets && resolvedOptions.buildId
          ? await generateFingerprint({
              buildId: resolvedOptions.buildId,
              content: body,
            })
          : null,
    })
  }

  function createEmittedFileFromMetadata(
    body: Uint8Array,
    metadata: EmittedFileMetadata,
  ): EmittedFile {
    return {
      body,
      ...metadata,
    }
  }

  async function applyTransforms(
    filePath: string,
    source: EmittedFile,
    transforms: readonly ParsedRequestTransform[],
  ): Promise<{ body: Uint8Array; extension: string } | null> {
    let currentBody = source.body
    let currentExtension = source.extension
    let appliedTransform = false

    for (let requestTransform of transforms) {
      let transform = resolvedOptions.transforms[requestTransform.name]
      if (!transform) {
        throw createAssetServerCompilationError(
          `Unknown file transform "${requestTransform.name}" requested for ${filePath}`,
          { code: 'TRANSFORM_FAILED' },
        )
      }

      if (!supportsTransformExtension(transform.extensions, currentExtension)) {
        throw createAssetServerCompilationError(
          `File transform "${requestTransform.name}" does not support ${currentExtension} inputs for ${filePath}`,
          { code: 'TRANSFORM_FAILED' },
        )
      }

      let result = await transform.transform(currentBody, {
        extension: currentExtension,
        filePath,
        param: requestTransform.param,
      })
      let normalizedResult = normalizeTransformResult(result, {
        currentExtension,
        filePath,
        transformName: requestTransform.name,
      })
      currentBody = normalizedResult.content
      currentExtension = normalizedResult.extension
      appliedTransform = true
    }

    for (let globalTransform of resolvedOptions.globalTransforms) {
      if (!supportsTransformExtension(globalTransform.extensions, currentExtension)) continue

      let result = await globalTransform.transform(currentBody, {
        extension: currentExtension,
        filePath,
      })
      if (result === null) continue

      let normalizedResult = normalizeTransformResult(result, {
        currentExtension,
        filePath,
        transformName: globalTransform.name ?? '<anonymous>',
      })
      currentBody = normalizedResult.content
      currentExtension = normalizedResult.extension
      appliedTransform = true
    }

    if (!appliedTransform) return null
    return { body: currentBody, extension: currentExtension }
  }

  async function getCachedTransformedFile(
    cacheKey: string,
    identityPath: string,
    fingerprint: string | null,
  ): Promise<EmittedFile | null> {
    if (!resolvedOptions.cache) return null

    let file = await resolvedOptions.cache.get(cacheKey)
    if (!file) return null

    let body = new Uint8Array(await file.arrayBuffer())
    let metadata =
      transformedAssetMetadataByCacheKey.get(cacheKey) ??
      (await createEmittedFileMetadata(body, {
        extension: path.extname(file.name).toLowerCase(),
        filePath: identityPath,
        fingerprint,
      }))

    rememberTransformedAssetMetadata(cacheKey, identityPath, metadata)

    return {
      body,
      ...metadata,
    }
  }

  async function setCachedTransformedFile(
    cacheKey: string,
    filePath: string,
    emittedFile: EmittedFile,
  ): Promise<void> {
    if (!resolvedOptions.cache) return

    let basename = path.basename(filePath, path.extname(filePath))
    await resolvedOptions.cache.set(
      cacheKey,
      new File([Buffer.from(emittedFile.body)], `${basename}${emittedFile.extension}`, {
        type: emittedFile.contentType,
      }),
    )
  }

  async function createEmittedFile(
    body: Uint8Array,
    options: {
      extension: string
      filePath: string
      fingerprint: string | null
    },
  ): Promise<EmittedFile> {
    let metadata = await createEmittedFileMetadata(body, options)
    return {
      body,
      ...metadata,
    }
  }

  function clearTransformedCacheIndex(identityPath: string): void {
    let cacheKeys = transformedCacheKeysByIdentityPath.get(identityPath)
    if (!cacheKeys) return

    for (let cacheKey of cacheKeys) {
      transformedAssetMetadataByCacheKey.delete(cacheKey)
    }

    transformedCacheKeysByIdentityPath.delete(identityPath)
  }

  function rememberTransformedAssetMetadata(
    cacheKey: string,
    identityPath: string,
    metadata: EmittedFileMetadata,
  ): void {
    transformedAssetMetadataByCacheKey.set(cacheKey, metadata)

    let cacheKeys = transformedCacheKeysByIdentityPath.get(identityPath) ?? new Set<string>()
    cacheKeys.add(cacheKey)
    transformedCacheKeysByIdentityPath.set(identityPath, cacheKeys)
  }

  async function createEmittedFileMetadata(
    body: Uint8Array,
    options: {
      extension: string
      filePath: string
      fingerprint: string | null
    },
  ): Promise<EmittedFileMetadata> {
    let contentType =
      detectContentType(`file${options.extension}`) ??
      detectContentType(options.filePath) ??
      'application/octet-stream'

    return {
      contentType,
      etag: `W/"${await hashContent(body)}"`,
      extension: options.extension,
      fingerprint: options.fingerprint,
    }
  }
}

export function resolveServedFileOrThrow(filePath: string, args: ResolveArgs): ResolvedFile {
  let identityPath = resolveExistingFilePath(filePath)
  if (!identityPath) {
    throw createAssetServerCompilationError(`File not found: ${filePath}`, {
      code: 'FILE_NOT_FOUND',
    })
  }

  if (!isServedFilePath(identityPath, args.extensions)) {
    throw createAssetServerCompilationError(`File type is not supported: ${identityPath}`, {
      code: 'FILE_NOT_SUPPORTED',
    })
  }

  if (!args.isAllowed(identityPath)) {
    throw createAssetServerCompilationError(`File is not allowed: ${identityPath}`, {
      code: 'FILE_NOT_ALLOWED',
    })
  }

  let stableUrlPathname = args.routes.toUrlPathname(identityPath)
  if (!stableUrlPathname) {
    throw createAssetServerCompilationError(
      `File ${identityPath} is outside all configured fileMap entries.`,
      {
        code: 'FILE_OUTSIDE_FILE_MAP',
      },
    )
  }

  return {
    identityPath,
    stableUrlPathname,
  }
}

export function createResponseForFile(
  result: FileCompileResult,
  options: {
    cacheControl: string
    ifNoneMatch: string | null
    method: string
  },
): Response {
  if (IfNoneMatch.from(options.ifNoneMatch).matches(result.etag)) {
    return new Response(null, { status: 304, headers: { ETag: result.etag } })
  }

  return new Response(options.method === 'HEAD' ? null : Buffer.from(result.body), {
    headers: {
      'Cache-Control': options.cacheControl,
      'Content-Type': result.contentType,
      ETag: result.etag,
    },
  })
}

export function isServedFilePath(filePath: string, extensions: ReadonlySet<string>): boolean {
  return extensions.has(path.extname(filePath).toLowerCase())
}

function getRecordCacheKey(record: SourceFileRecord): string {
  return `${record.identityPath}\0${record.invalidationVersion}`
}

function getTransformedRecordCacheKey(
  cacheEpoch: string,
  record: SourceFileRecord,
  transformQuery: readonly string[] | null,
): string {
  return [
    encodeCacheKeyPart(cacheEpoch),
    encodeCacheKeyPart(record.identityPath),
    String(record.invalidationVersion),
    encodeCacheKeyPart(JSON.stringify(transformQuery ?? [])),
  ].join('/')
}

function getFileSnapshot(filePath: string): FileSnapshot | null {
  try {
    let stats = fs.statSync(filePath, { bigint: true })
    if (!stats.isFile()) return null
    return {
      filePath,
      mtimeNs: stats.mtimeNs,
      size: stats.size,
    }
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
}

function getNotModifiedFile(
  emittedFile: EmittedFileMetadata | undefined,
  options: FileGetOptions,
): FileGetResult | null {
  if (!emittedFile || options.ifNoneMatch === null) return null

  if (
    options.requestedFingerprint !== null &&
    emittedFile.fingerprint !== options.requestedFingerprint
  ) {
    return null
  }

  if (!IfNoneMatch.from(options.ifNoneMatch).matches(emittedFile.etag)) return null
  return { etag: emittedFile.etag, type: 'not-modified' }
}

function toEmittedFileMetadata(emittedFile: EmittedFile): EmittedFileMetadata {
  return {
    contentType: emittedFile.contentType,
    etag: emittedFile.etag,
    extension: emittedFile.extension,
    fingerprint: emittedFile.fingerprint,
  }
}

function isFileSnapshotFresh(snapshot: FileSnapshot): boolean {
  let current = getFileSnapshot(snapshot.filePath)
  return current != null && current.mtimeNs === snapshot.mtimeNs && current.size === snapshot.size
}

function appendTransformQuery(href: string, transformQuery: readonly string[] | null): string {
  if (transformQuery === null) return href
  let searchParams = new URLSearchParams()
  for (let transform of transformQuery) {
    searchParams.append('transform', transform)
  }

  let search = searchParams.toString()
  return search.length > 0 ? `${href}?${search}` : href
}

function encodeCacheKeyPart(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function normalizeTransformResult(
  result: unknown,
  options: {
    currentExtension: string
    filePath: string
    transformName: string
  },
): AssetFileTransformResult & { content: Uint8Array; extension: string } {
  if (typeof result === 'string') {
    return {
      content: new TextEncoder().encode(result),
      extension: options.currentExtension,
    }
  }

  if (result instanceof Uint8Array) {
    return {
      content: result,
      extension: options.currentExtension,
    }
  }

  if (result === null || typeof result !== 'object') {
    throw createAssetServerCompilationError(
      `File transform "${options.transformName}" must return a string, Uint8Array, or object for ${options.filePath}`,
      { code: 'TRANSFORM_FAILED' },
    )
  }

  if (
    !('content' in result) ||
    (typeof result.content !== 'string' && !(result.content instanceof Uint8Array))
  ) {
    throw createAssetServerCompilationError(
      `File transform "${options.transformName}" must return a string or Uint8Array content value for ${options.filePath}`,
      { code: 'TRANSFORM_FAILED' },
    )
  }

  let extension = options.currentExtension
  if ('extension' in result && result.extension !== undefined) {
    if (typeof result.extension !== 'string') {
      throw createAssetServerCompilationError(
        `File transform "${options.transformName}" must return a string extension for ${options.filePath}`,
        { code: 'TRANSFORM_FAILED' },
      )
    }

    extension = normalizeTransformExtension(
      result.extension,
      options.filePath,
      options.transformName,
    )
  }

  return {
    content:
      typeof result.content === 'string'
        ? new TextEncoder().encode(result.content)
        : result.content,
    extension,
  }
}

function normalizeTransformExtension(
  extension: string,
  filePath: string,
  transformName: string,
): string {
  let normalizedExtension = extension.trim().toLowerCase()
  if (!/^\.[A-Za-z0-9_-]+$/.test(normalizedExtension)) {
    throw createAssetServerCompilationError(
      `File transform "${transformName}" returned an invalid extension "${extension}" for ${filePath}`,
      { code: 'TRANSFORM_FAILED' },
    )
  }

  return normalizedExtension
}

function supportsTransformExtension(
  extensions: readonly string[] | undefined,
  currentExtension: string,
): boolean {
  return extensions === undefined || extensions.includes(currentExtension)
}

function parseRequestTransforms(
  transformQuery: readonly string[] | null,
  transforms: AssetRequestTransformMap,
  maxRequestTransforms: number,
): readonly ParsedRequestTransform[] {
  if (transformQuery === null) return []

  try {
    return parseAssetTransformInvocations(transformQuery, transforms, maxRequestTransforms).map(
      (transformInvocation): ParsedRequestTransform =>
        typeof transformInvocation === 'string'
          ? {
              name: transformInvocation,
              param: undefined,
            }
          : {
              name: transformInvocation[0],
              param: transformInvocation[1],
            },
    )
  } catch (error) {
    throw createAssetServerCompilationError(
      error instanceof Error ? error.message : 'Invalid file transforms',
      {
        code: 'INVALID_TRANSFORM_QUERY',
      },
    )
  }
}

function resolveExistingFilePath(filePath: string): string | null {
  try {
    return normalizeFilePath(fs.realpathSync(filePath))
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

async function readFileContents(identityPath: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await fsp.readFile(identityPath))
  } catch (error) {
    if (isNoEntityError(error)) {
      throw createAssetServerCompilationError(`File not found: ${identityPath}`, {
        cause: error,
        code: 'FILE_NOT_FOUND',
      })
    }

    throw toEmitError(error, identityPath)
  }
}

function toEmitError(error: unknown, identityPath: string) {
  if (isAssetServerCompilationError(error)) return error

  return createAssetServerCompilationError(
    `Failed to read file ${identityPath}. ${error instanceof Error ? error.message : String(error)}`,
    {
      cause: error,
      code: 'EMIT_FAILED',
    },
  )
}
