import type { FileStorage } from '@remix-run/file-storage'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { lock } from 'proper-lockfile'
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
 * Reads and writes refresh recency. Files exceeding either byte limit are not cached.
 * All limits must be positive safe integers. Storage metadata and filesystem overhead
 * are additional to the byte budgets. Instances sharing a directory should use the
 * same limits; each operation enforces the calling instance's limits.
 *
 * @param options Cache directory, entry count, and byte limits.
 * @returns A file cache suitable for `files.cache` in `createAssetServer()`.
 */
export function createFsFileCache(options: FsFileCacheOptions = {}): FileCache {
  let rootDir = path.resolve(options.directory ?? 'node_modules/.cache/remix/assets')
  let dataDir = path.join(rootDir, 'files')
  let indexPath = path.join(rootDir, 'index.json')
  let pendingPath = path.join(rootDir, 'pending')
  let maxEntries = options.maxEntries ?? 1024
  let maxFileSize = options.maxFileSize ?? 4 * 1024 * 1024
  let maxTotalSize = options.maxTotalSize ?? 256 * 1024 * 1024
  for (let [name, value] of Object.entries({ maxEntries, maxFileSize, maxTotalSize })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`)
    }
  }
  let queue = Promise.resolve()

  function withLockedCache<result>(
    action: (entries: Map<string, number>, storage: FileStorage) => Promise<result>,
  ): Promise<result | undefined> {
    let result = queue.then(async () => {
      await fs.mkdir(rootDir, { recursive: true })
      let compromised: Error | undefined
      let release: () => Promise<void>
      try {
        release = await lock(rootDir, {
          lockfilePath: path.join(rootDir, '.lock'),
          onCompromised(error) {
            compromised = error
          },
        })
      } catch (error) {
        // Another process owns the cache. Contention is a miss or declined admission.
        if (isFileError(error, 'ELOCKED')) return undefined
        throw error
      }
      try {
        let entries = await readIndex()
        // An interrupted operation invalidates the cache instead of leaving unaccounted files.
        await fs.writeFile(pendingPath, '')
        let storage = createFsFileStorage(dataDir)
        await trim(entries, storage)
        let value = await action(entries, storage)
        if (compromised) throw compromised
        let temporaryIndex = path.join(rootDir, 'index.tmp')
        await fs.writeFile(temporaryIndex, JSON.stringify([...entries]))
        await fs.rename(temporaryIndex, indexPath)
        await fs.unlink(pendingPath)
        return value
      } finally {
        if (!compromised) await release()
      }
    })
    queue = result.then(
      () => {},
      () => {},
    )
    return result
  }

  async function readIndex(): Promise<Map<string, number>> {
    try {
      let pending = await fs.stat(pendingPath).catch((error: unknown) => {
        if (isFileError(error, 'ENOENT')) return null
        throw error
      })
      if (!pending) {
        let value: unknown = JSON.parse(await fs.readFile(indexPath, 'utf8'))
        if (isCacheIndex(value)) return new Map(value)
      }
    } catch (error) {
      if (!(error instanceof SyntaxError) && !isFileError(error, 'ENOENT')) throw error
    }
    await fs.rm(dataDir, { recursive: true, force: true })
    return new Map()
  }

  async function trim(entries: Map<string, number>, storage: FileStorage): Promise<void> {
    let size = 0
    for (let [key, entrySize] of entries) {
      if (entrySize > maxFileSize) {
        await storage.remove(key)
        entries.delete(key)
      } else {
        size += entrySize
      }
    }
    for (let [key, entrySize] of entries) {
      if (entries.size <= maxEntries && size <= maxTotalSize) break
      await storage.remove(key)
      entries.delete(key)
      size -= entrySize
    }
  }

  return {
    async get(key) {
      let digest = await hash(new TextEncoder().encode(key))
      return (
        (await withLockedCache(async (entries, storage) => {
          if (!entries.has(digest)) return null
          let file = await readRecord(storage, digest, maxFileSize).catch((error: unknown) => {
            if (isFileError(error, 'ENOENT')) return null
            throw error
          })
          let size = entries.get(digest)
          entries.delete(digest)
          if (file && size !== undefined) {
            entries.set(digest, size)
          } else {
            await storage.remove(digest)
          }
          return file
        })) ?? null
      )
    },
    async put(key, file) {
      let limit = Math.min(maxFileSize, maxTotalSize)
      if (file.size > limit) return
      let digest = await hash(new TextEncoder().encode(key))
      let header = JSON.stringify([digest, file.name, file.type, file.lastModified])
      let content = new Blob([header, '\n', file])
      if (65 + content.size > limit) return
      let bytes = new Uint8Array(await content.arrayBuffer())
      let checksum = await hash(bytes)
      let record = new File([checksum, '\n', bytes], 'file-cache')
      await withLockedCache(async (entries, storage) => {
        // Remove the replaced record before eviction so only the new size is counted.
        if (entries.delete(digest)) await storage.remove(digest)
        entries.set(digest, record.size)
        await trim(entries, storage)
        await storage.set(digest, record)
      })
    },
  }
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

function isCacheIndex(value: unknown): value is [string, number][] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry: unknown) =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === 'string' &&
        /^[a-f0-9]{64}$/.test(entry[0]) &&
        typeof entry[1] === 'number' &&
        Number.isSafeInteger(entry[1]) &&
        entry[1] > 0,
    )
  )
}

function isFileError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function hash(bytes: Uint8Array): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', Buffer.from(bytes))
  return Buffer.from(digest).toString('hex')
}
