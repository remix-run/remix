import type { FileMetadata, FileStorage } from '@remix-run/file-storage'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { FileCache } from './file-cache.ts'

/** Directory and limits for a filesystem file cache. */
export interface FsFileCacheOptions {
  /**
   * Directory dedicated to this cache, created on first use if needed.
   * Defaults to `node_modules/.cache/remix/assets`. Relative paths resolve from
   * `process.cwd()` when the factory is called.
   */
  directory?: string
  /** Maximum number of cached files (defaults to `1024`). */
  maxEntries?: number
  /** Maximum bytes per stored entry, including cache metadata (defaults to 4 MiB). */
  maxFileSize?: number
  /** Maximum total stored entry bytes, including cache metadata (defaults to 256 MiB). */
  maxTotalSize?: number
}

/**
 * Creates a persistent filesystem cache that evicts least recently used entries.
 * Reads and writes refresh an in-memory index. On first use, the index is rebuilt
 * from stored write timestamps; read recency is not preserved across restarts.
 * Use one cache instance per directory. For shared multi-process caching, provide
 * a custom `FileCache`. Files exceeding either byte limit are not cached. All limits
 * must be positive safe integers. Storage metadata and filesystem overhead are
 * additional to the byte budgets.
 *
 * @param options Cache directory, entry count, and byte limits.
 * @returns A file cache suitable for `files.cache` in `createAssetServer()`.
 */
export function createFsFileCache(options: FsFileCacheOptions = {}): FileCache {
  let rootDir = path.resolve(options.directory ?? 'node_modules/.cache/remix/assets')
  let dataDir = path.join(rootDir, 'files')
  let pendingPath = path.join(rootDir, 'pending')
  let maxEntries = options.maxEntries ?? 1024
  let maxFileSize = options.maxFileSize ?? 4 * 1024 * 1024
  let maxTotalSize = options.maxTotalSize ?? 256 * 1024 * 1024
  for (let [name, value] of Object.entries({ maxEntries, maxFileSize, maxTotalSize })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`)
    }
  }
  let initialization: Promise<CacheState> | undefined
  let mutations = Promise.resolve()

  function getState(): Promise<CacheState> {
    return (initialization ??= initialize().catch((error: unknown) => {
      initialization = undefined
      throw error
    }))
  }

  async function initialize(): Promise<CacheState> {
    await fs.mkdir(rootDir, { recursive: true })
    let pending = await fs.stat(pendingPath).catch((error: unknown) => {
      if (isFileError(error, 'ENOENT')) return null
      throw error
    })
    // A partial storage write may leave a body without metadata to account for it.
    if (pending) await fs.rm(dataDir, { recursive: true, force: true })
    let storage = createFsFileStorage(dataDir)
    let records: FileMetadata[]
    try {
      records = (await storage.list({ includeMetadata: true, limit: Number.MAX_SAFE_INTEGER }))
        .files
      if (!records.every(isCacheRecordMetadata)) throw new SyntaxError('Invalid cache metadata')
    } catch (error) {
      if (!(error instanceof SyntaxError) && !isFileError(error, 'ENOENT')) throw error
      await fs.writeFile(pendingPath, '')
      await fs.rm(dataDir, { recursive: true, force: true })
      await fs.mkdir(dataDir, { recursive: true })
      records = []
    }
    records.sort((a, b) => a.lastModified - b.lastModified || a.key.localeCompare(b.key))
    let state: CacheState = { storage, entries: new Map(), size: 0 }
    for (let record of records) {
      state.entries.set(record.key, { size: record.size })
      state.size += record.size
    }
    if (
      records.some((record) => record.size > maxFileSize) ||
      state.entries.size > maxEntries ||
      state.size > maxTotalSize
    ) {
      await fs.writeFile(pendingPath, '')
      for (let record of records) {
        if (record.size > maxFileSize) await removeEntry(state, record.key)
      }
      await trim(state)
    }
    await fs.rm(pendingPath, { force: true })
    return state
  }

  function withCacheMutation(action: (state: CacheState) => Promise<void>): Promise<void> {
    let result = mutations.then(async () => {
      let state = await getState()
      try {
        await fs.writeFile(pendingPath, '')
        await action(state)
        await fs.unlink(pendingPath)
      } catch (error) {
        initialization = undefined
        throw error
      }
    })
    mutations = result.catch(() => {})
    return result
  }

  async function removeEntry(state: CacheState, key: string): Promise<void> {
    await state.storage.remove(key)
    let entry = state.entries.get(key)
    if (entry) {
      state.entries.delete(key)
      state.size -= entry.size
    }
  }

  async function trim(state: CacheState, incomingSize = 0): Promise<void> {
    let entryLimit = maxEntries - (incomingSize > 0 ? 1 : 0)
    for (let key of state.entries.keys()) {
      if (state.entries.size <= entryLimit && state.size <= maxTotalSize - incomingSize) break
      await removeEntry(state, key)
    }
  }

  return {
    async get(key) {
      let digest = await hash(new TextEncoder().encode(key))
      await mutations
      let state = await getState()
      let entry = state.entries.get(digest)
      if (!entry) return null
      state.entries.delete(digest)
      state.entries.set(digest, entry)
      let file = await readRecord(state.storage, digest, maxFileSize).catch((error: unknown) => {
        if (isFileError(error, 'ENOENT')) return null
        throw error
      })
      if (!file) {
        await withCacheMutation(async (current) => {
          // A read may overlap replacement or eviction. Do not remove a newer entry.
          if (current.entries.get(digest) === entry) await removeEntry(current, digest)
        })
      }
      return file
    },
    async put(key, file) {
      let limit = Math.min(maxFileSize, maxTotalSize)
      if (file.size > limit) return
      let digest = await hash(new TextEncoder().encode(key))
      let header = JSON.stringify([digest, file.name, file.type, file.lastModified])
      let isNativeBlob = file instanceof Blob
      let content = new Blob([header, '\n', isNativeBlob ? file : await file.arrayBuffer()])
      if (65 + content.size > limit) return
      let bytes = new Uint8Array(await content.arrayBuffer())
      let checksum = await hash(bytes)
      await withCacheMutation(async (state) => {
        let record = new File([checksum, '\n', bytes], 'file-cache')
        if (state.entries.has(digest)) await removeEntry(state, digest)
        await trim(state, record.size)
        await state.storage.set(digest, record)
        state.entries.set(digest, { size: record.size })
        state.size += record.size
      })
    },
  }
}

type CacheState = {
  storage: FileStorage
  entries: Map<string, { size: number }>
  size: number
}

export function createTransformCacheKey(namespace: string, identity: string): Promise<string> {
  return hash(
    new TextEncoder().encode(JSON.stringify(['transformed-file-v3', namespace, identity])),
  )
}

async function readRecord(
  storage: FileStorage,
  digest: string,
  maxFileSize: number,
): Promise<File | null> {
  let file: File | null
  try {
    file = await storage.get(digest)
  } catch (error) {
    // Invalid storage metadata cannot be used to recover a cached record.
    if (error instanceof SyntaxError || isFileError(error, 'ENOENT')) return null
    throw error
  }
  if (!file || file.size > maxFileSize) return null

  let bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > maxFileSize || bytes[64] !== 10) return null
  let decoder = new TextDecoder()
  let checksum = decoder.decode(bytes.subarray(0, 64))
  if ((await hash(bytes.subarray(65))) !== checksum) return null

  let headerEnd = bytes.indexOf(10, 65)
  if (headerEnd === -1) return null
  let header: unknown
  try {
    header = JSON.parse(decoder.decode(bytes.subarray(65, headerEnd)))
  } catch {
    return null
  }
  if (
    !Array.isArray(header) ||
    header.length !== 4 ||
    header[0] !== digest ||
    typeof header[1] !== 'string' ||
    typeof header[2] !== 'string' ||
    typeof header[3] !== 'number' ||
    !Number.isFinite(header[3])
  ) {
    return null
  }

  return new File([bytes.subarray(headerEnd + 1)], header[1], {
    type: header[2],
    lastModified: header[3],
  })
}

function isCacheRecordMetadata(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    typeof value.key === 'string' &&
    /^[a-f0-9]{64}$/.test(value.key) &&
    'size' in value &&
    typeof value.size === 'number' &&
    Number.isSafeInteger(value.size) &&
    value.size > 0 &&
    'lastModified' in value &&
    typeof value.lastModified === 'number' &&
    Number.isFinite(value.lastModified)
  )
}

function isFileError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function hash(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', bytes)
  return Buffer.from(digest).toString('hex')
}
