import type { FileStorage } from '@remix-run/file-storage'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import * as path from 'node:path'
import type { FileCache } from './file-cache.ts'

const maxCacheSlots = 256
const maxCacheFileSize = 4 * 1024 * 1024

/**
 * Creates a bounded filesystem cache with up to 256 reusable slots and 4 MiB per
 * stored entry, including metadata. Entries that share a slot replace one another;
 * oversized files are not cached. All instances using the same directory share
 * these limits and may reuse cached files.
 *
 * @param directory A directory dedicated to this cache, created on first use if needed.
 * Relative paths resolve from `process.cwd()` when this function is called.
 * @returns A file cache suitable for `files.cache` in `createAssetServer()`.
 */
export function createFsFileCache(directory: string): FileCache {
  let rootDir = path.resolve(directory)
  let storage: FileStorage | undefined

  function getStorage(): FileStorage {
    return (storage ??= createFsFileStorage(rootDir))
  }

  return {
    async get(key) {
      let digest = await hash(new TextEncoder().encode(key))
      let file: File | null
      try {
        file = await getStorage().get(getSlot(digest))
      } catch (error) {
        // Another writer may be replacing the backing store's JSON metadata.
        if (error instanceof SyntaxError) return null
        throw error
      }
      if (!file || file.size > maxCacheFileSize) return null

      let bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.length > maxCacheFileSize || bytes[64] !== 10) return null
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
    },
    async put(key, file) {
      if (file.size > maxCacheFileSize) return
      let digest = await hash(new TextEncoder().encode(key))
      let header = JSON.stringify([digest, file.name, file.type, file.lastModified])
      let content = new Blob([header, '\n', file])
      if (65 + content.size > maxCacheFileSize) return

      // FileStorage replaces bytes and metadata separately, so keep the entire record in the body.
      let bytes = new Uint8Array(await content.arrayBuffer())
      let checksum = await hash(bytes)
      try {
        await getStorage().set(getSlot(digest), new File([checksum, '\n', bytes], 'file-cache'))
      } catch (error) {
        // FileStorage rereads metadata after writing; concurrent replacement can interrupt that read.
        if (!(error instanceof SyntaxError)) throw error
      }
    },
  }
}

export function createTransformCacheKey(namespace: string, identity: string): Promise<string> {
  return hash(
    new TextEncoder().encode(JSON.stringify(['transformed-file-v3', namespace, identity])),
  )
}

function getSlot(digest: string): string {
  return String(parseInt(digest.slice(0, 8), 16) % maxCacheSlots)
}

async function hash(bytes: Uint8Array): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', Buffer.from(bytes))
  return Buffer.from(digest).toString('hex')
}
