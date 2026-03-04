import type { FileStorage, ListResult } from '@remix-run/file-storage'

interface FileLikeCacheArg {
  size: number
  lastModified: number
  name: string
  type: string
}

export type CacheableArg = FileLikeCacheArg | string | number | boolean | null
export type CacheKey = CacheableArg | CacheableArg[]

export interface FileCacheOptions {
  maxSize?: number
  version?: string
}

export type FileCacheFactory = () => File | Promise<File>

export interface FileCache {
  get(key: CacheKey): Promise<File | null>
  set(key: CacheKey, value: File): Promise<void>
  getOrSet(key: CacheKey, factory: FileCacheFactory): Promise<File>
  prune(): Promise<void>
  clear(): Promise<void>
}

interface CacheEntry {
  key: string
  size: number
  lastUsed: number
}

export function createFileCache(storage: FileStorage, options: FileCacheOptions = {}): FileCache {
  let version = options.version ?? crypto.randomUUID()
  let prefix = `${version}/`
  let maxSize = options.maxSize

  if (maxSize != null && maxSize < 0) {
    throw new TypeError('`maxSize` must be greater than or equal to 0')
  }

  let entriesByStorageKey = new Map<string, CacheEntry>()
  let totalSize = 0
  let indexLoaded = false
  let indexLoadPromise: Promise<void> | null = null
  let inFlight = new Map<string, Promise<File>>()

  async function get(key: CacheKey): Promise<File | null> {
    let storageKey = await getStorageKey(key)
    return getByStorageKey(storageKey)
  }

  async function set(key: CacheKey, value: File): Promise<void> {
    let storageKey = await getStorageKey(key)
    await setByStorageKey(storageKey, value)
  }

  async function getOrSet(key: CacheKey, factory: FileCacheFactory): Promise<File> {
    let storageKey = await getStorageKey(key)
    let cached = await getByStorageKey(storageKey)
    if (cached) return cached

    let pending = inFlight.get(storageKey)
    if (pending) return pending

    let next = (async () => {
      let generated = await factory()
      return setByStorageKey(storageKey, generated)
    })()

    inFlight.set(storageKey, next)

    try {
      return await next
    } finally {
      inFlight.delete(storageKey)
    }
  }

  async function prune(): Promise<void> {
    let files = await listAllFiles(storage)
    await Promise.all(
      files.filter((file) => !file.key.startsWith(prefix)).map((file) => storage.remove(file.key)),
    )

    if (maxSize != null) {
      entriesByStorageKey.clear()
      totalSize = 0
      indexLoaded = false
      indexLoadPromise = null
    }
  }

  async function clear(): Promise<void> {
    let files = await listAllFiles(storage, { prefix })
    await Promise.all(files.map((file) => storage.remove(file.key)))

    if (maxSize != null) {
      entriesByStorageKey.clear()
      totalSize = 0
      indexLoaded = true
      indexLoadPromise = null
    }
  }

  async function getByStorageKey(storageKey: string): Promise<File | null> {
    let file = await storage.get(storageKey)
    if (!file) return null

    if (maxSize == null) return file

    await ensureIndexLoaded()
    upsertEntry(storageKey, file.size, Date.now())
    await evictToMaxSize()
    return file
  }

  async function setByStorageKey(storageKey: string, value: File): Promise<File> {
    if (maxSize != null && value.size > maxSize) {
      return value
    }

    if (maxSize != null) {
      await ensureIndexLoaded()
    }

    let stored = await storage.put(storageKey, await cloneWithLastModified(value, Date.now()))

    if (maxSize != null) {
      upsertEntry(storageKey, stored.size, stored.lastModified)
      await evictToMaxSize()
    }

    return stored
  }

  function upsertEntry(storageKey: string, size: number, lastUsed: number): void {
    let existing = entriesByStorageKey.get(storageKey)
    if (existing) {
      totalSize -= existing.size
    }

    entriesByStorageKey.set(storageKey, {
      key: storageKey,
      size,
      lastUsed,
    })
    totalSize += size
  }

  async function ensureIndexLoaded(): Promise<void> {
    if (indexLoaded) return
    if (indexLoadPromise) {
      await indexLoadPromise
      return
    }

    indexLoadPromise = (async () => {
      entriesByStorageKey.clear()
      totalSize = 0

      let files = await listAllFiles(storage, { prefix, includeMetadata: true })
      for (let file of files) {
        upsertEntry(file.key, file.size, file.lastModified)
      }

      indexLoaded = true
      indexLoadPromise = null
    })()

    await indexLoadPromise
  }

  async function evictToMaxSize(): Promise<void> {
    if (maxSize == null || totalSize <= maxSize) return

    let entries = Array.from(entriesByStorageKey.values()).sort((a, b) => a.lastUsed - b.lastUsed)

    for (let entry of entries) {
      await storage.remove(entry.key)
      entriesByStorageKey.delete(entry.key)
      totalSize -= entry.size
      if (totalSize <= maxSize) break
    }
  }

  async function getStorageKey(key: CacheKey): Promise<string> {
    let digest = await hashCacheKey(key, version)
    return `${prefix}${digest}`
  }

  return { get, set, getOrSet, prune, clear }
}

async function cloneWithLastModified(file: File, lastModified: number): Promise<File> {
  try {
    let bytes = new Uint8Array(await file.arrayBuffer())
    return new File([bytes], file.name, { type: file.type, lastModified })
  } catch {
    // Fall back if the source file cannot be cloned for metadata update.
    return file
  }
}

async function hashCacheKey(key: CacheKey, version: string): Promise<string> {
  let parts = [`version:${version}`]
  let normalized = Array.isArray(key) ? key : [key]
  for (let arg of normalized) {
    parts.push(serializeCacheableArg(arg))
  }
  return hashText(parts.join('\u0000'))
}

function serializeCacheableArg(arg: CacheableArg): string {
  if (isFileLikeCacheArg(arg)) {
    return [
      'file',
      serializeString(String(arg.size)),
      serializeString(String(arg.lastModified)),
      serializeString(arg.name),
      serializeString(arg.type),
    ].join(':')
  }

  switch (typeof arg) {
    case 'string':
      return `string:${arg}`
    case 'number':
      return `number:${String(arg)}`
    case 'boolean':
      return `boolean:${arg ? 'true' : 'false'}`
    case 'object':
      if (arg === null) return 'null'
  }

  throw new TypeError('Invalid cache key argument')
}

function isFileLikeCacheArg(value: CacheableArg): value is FileLikeCacheArg {
  if (value == null || typeof value !== 'object') return false
  if (
    !('size' in value) ||
    !('lastModified' in value) ||
    !('name' in value) ||
    !('type' in value)
  ) {
    return false
  }
  return (
    typeof value.size === 'number' &&
    typeof value.lastModified === 'number' &&
    typeof value.name === 'string' &&
    typeof value.type === 'string'
  )
}

function serializeString(value: string): string {
  return `${value.length}:${value}`
}

async function hashText(value: string): Promise<string> {
  let data = new TextEncoder().encode(value)
  let digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

type ListFilesOptions = {
  prefix?: string
  includeMetadata?: boolean
}

type ListFile = ListResult<{ includeMetadata: true }>['files'][number]

async function listAllFiles(
  storage: FileStorage,
  options: ListFilesOptions,
): Promise<ListResult<{ includeMetadata: true }>['files']>
async function listAllFiles(storage: FileStorage): Promise<ListResult<{}>['files']>
async function listAllFiles(
  storage: FileStorage,
  options: ListFilesOptions = {},
): Promise<ListResult<{ includeMetadata: true }>['files'] | ListResult<{}>['files']> {
  if (options.includeMetadata) {
    let files: ListFile[] = []
    let cursor: string | undefined

    while (true) {
      let result = await storage.list({
        cursor,
        includeMetadata: true,
        prefix: options.prefix,
      })
      files.push(...result.files)
      if (result.cursor == null) break
      cursor = result.cursor
    }

    return files
  }

  let files: ListResult<{}>['files'] = []
  let cursor: string | undefined

  while (true) {
    let result = await storage.list({ cursor, prefix: options.prefix })
    files.push(...result.files)
    if (result.cursor == null) break
    cursor = result.cursor
  }

  return files
}
