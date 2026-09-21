import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { openLazyFile } from '@remix-run/fs'
import type { LazyFile } from '@remix-run/lazy-file'

import type {
  FileStorage,
  FileLike,
  FileMetadata,
  ListOptions,
  ListResult,
} from '../file-storage.ts'

/**
 * Creates a {@link FileStorage} that is backed by a filesystem directory using `node:fs`.
 *
 * Important: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * Failed writes preserve the previous file. Callers must coordinate overlapping reads, writes,
 * removals, and listings across all instances and processes sharing the directory. This includes
 * consuming files returned by `get()` or `put()` before allowing replacement or removal.
 *
 * Note: Keys have no correlation to file names on disk, so they may be any string including
 * characters that are not valid in file names. Additionally, individual `File` names have no
 * correlation to names of files on disk, so multiple files with the same name may be stored in the
 * same storage object.
 *
 * @param directory The directory where files are stored
 * @returns A new {@link FileStorage} backed by a filesystem directory
 */
export function createFsFileStorage(directory: string): FileStorage<LazyFile> {
  let rootDir = path.resolve(directory)

  try {
    let stats = fs.statSync(rootDir)

    if (!stats.isDirectory()) {
      throw new Error(`Path "${rootDir}" is not a directory`)
    }
  } catch (error) {
    if (!isNoEntityError(error)) {
      throw error
    }

    fs.mkdirSync(rootDir, { recursive: true })
  }

  async function getPaths(
    key: string,
  ): Promise<{ directory: string; filePath: string; metaPath: string }> {
    let hash = await computeHash(key)
    let directory = path.join(rootDir, hash.slice(0, 2))

    return {
      directory,
      filePath: path.join(directory, `${hash}.dat`),
      metaPath: path.join(directory, `${hash}.meta.json`),
    }
  }

  async function putFile(key: string, file: FileLike): Promise<LazyFile> {
    let { directory, filePath, metaPath } = await getPaths(key)
    let previous = await readMetadata(metaPath)
    let version = crypto.randomUUID()
    let dataPath = filePath.replace(/\.dat$/, `.${version}.dat`)
    let tempMetaPath = `${metaPath}.${version}.tmp`

    await fsp.mkdir(directory, { recursive: true })
    let handle = await fsp.open(dataPath, 'wx')
    let tempMetadataCreated = false
    let published = false

    try {
      let metadata: StoredMetadata
      try {
        for await (let chunk of file.stream()) {
          await handle.writeFile(chunk)
        }
        // FileUpload metadata can change while its stream is consumed.
        metadata = {
          key,
          lastModified: file.lastModified,
          name: file.name,
          size: (await handle.stat()).size,
          type: file.type,
          dataFile: path.basename(dataPath),
        }
      } finally {
        await handle.close()
      }

      let stored = openLazyFile(dataPath, metadata)
      let metaHandle = await fsp.open(tempMetaPath, 'wx')
      tempMetadataCreated = true
      try {
        await metaHandle.writeFile(JSON.stringify(metadata))
      } finally {
        await metaHandle.close()
      }

      // Only the metadata rename publishes the replacement. Until then the old entry is intact.
      await fsp.rename(tempMetaPath, metaPath)
      published = true

      // Cleanup must not turn a committed replacement into a reported failure.
      if (previous !== null) {
        await fsp.rm(getDataPath(metaPath, previous.dataFile), { force: true }).catch(() => {})
      }
      return stored
    } finally {
      if (!published) {
        await fsp.rm(dataPath, { force: true }).catch(() => {})
        if (tempMetadataCreated) {
          await fsp.rm(tempMetaPath, { force: true }).catch(() => {})
        }
      }
    }
  }

  return {
    async get(key: string): Promise<LazyFile | null> {
      let { metaPath } = await getPaths(key)

      try {
        let meta = await readMetadata(metaPath)

        return meta === null ? null : openLazyFile(getDataPath(metaPath, meta.dataFile), meta)
      } catch (error) {
        if (!isNoEntityError(error)) {
          throw error
        }

        return null
      }
    },
    async has(key: string): Promise<boolean> {
      let { metaPath } = await getPaths(key)

      try {
        await fsp.access(metaPath)
        return true
      } catch {
        return false
      }
    },
    async list<opts extends ListOptions>(options?: opts): Promise<ListResult<opts>> {
      let { cursor, includeMetadata = false, limit = 32, prefix } = options ?? {}

      let files: FileMetadata[] = []
      let foundCursor = cursor === undefined
      let nextCursor: string | undefined
      let lastHash: string | undefined

      outerLoop: for await (let subdir of await fsp.opendir(rootDir)) {
        if (!subdir.isDirectory()) continue

        for await (let file of await fsp.opendir(path.join(rootDir, subdir.name))) {
          if (!file.isFile() || !file.name.endsWith('.meta.json')) continue

          let hash = file.name.slice(0, -10) // Remove ".meta.json"

          if (foundCursor) {
            let record = await readMetadata(path.join(rootDir, subdir.name, file.name))
            if (record === null) continue
            let { dataFile, ...meta } = record

            if (prefix != null && !meta.key.startsWith(prefix)) {
              continue
            }

            if (files.length >= limit) {
              nextCursor = lastHash
              break outerLoop
            }

            files.push(meta)
          } else if (hash === cursor) {
            foundCursor = true
          }

          lastHash = hash
        }
      }

      return {
        cursor: nextCursor,
        files: (includeMetadata
          ? files
          : files.map(({ key }) => ({ key }))) as ListResult<opts>['files'],
      }
    },
    put(key: string, file: FileLike): Promise<LazyFile> {
      return putFile(key, file)
    },
    async remove(key: string): Promise<void> {
      let { directory, metaPath } = await getPaths(key)
      let metadata = await readMetadata(metaPath)
      if (metadata === null) return

      await fsp.rm(metaPath, { force: true })
      await fsp.rm(getDataPath(metaPath, metadata.dataFile), { force: true })
      try {
        await fsp.rmdir(directory)
      } catch (error) {
        if (
          !isNoEntityError(error) &&
          !hasErrorCode(error, 'ENOTEMPTY') &&
          !hasErrorCode(error, 'EEXIST')
        ) {
          throw error
        }
      }
    },
    async set(key: string, file: FileLike): Promise<void> {
      await putFile(key, file)
    },
  }
}

interface StoredMetadata extends FileMetadata {
  dataFile?: string
}

function getDataPath(metaPath: string, dataFile?: string): string {
  return dataFile === undefined
    ? metaPath.replace(/\.meta\.json$/, '.dat')
    : path.join(path.dirname(metaPath), dataFile)
}

async function readMetadata(metaPath: string): Promise<StoredMetadata | null> {
  let json: string
  try {
    json = await fsp.readFile(metaPath, 'utf-8')
  } catch (error) {
    if (isNoEntityError(error)) return null
    throw error
  }
  let value: unknown = JSON.parse(json)
  if (
    value === null ||
    typeof value !== 'object' ||
    !('key' in value) ||
    typeof value.key !== 'string' ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('type' in value) ||
    typeof value.type !== 'string' ||
    !('lastModified' in value) ||
    typeof value.lastModified !== 'number'
  ) {
    throw new Error('Invalid stored file metadata')
  }
  let dataFile = 'dataFile' in value ? value.dataFile : undefined
  if (
    dataFile !== undefined &&
    (typeof dataFile !== 'string' ||
      !/^[a-f0-9]{64}\.[a-f0-9-]{36}\.dat$/.test(dataFile) ||
      !dataFile.startsWith(`${path.basename(metaPath, '.meta.json')}.`))
  ) {
    throw new Error('Invalid stored file content path')
  }
  // Older entries did not store their size in metadata.
  let size = 'size' in value ? value.size : (await fsp.stat(getDataPath(metaPath, dataFile))).size
  if (typeof size !== 'number') throw new Error('Invalid stored file metadata')
  return {
    key: value.key,
    name: value.name,
    type: value.type,
    size,
    lastModified: value.lastModified,
    dataFile,
  }
}

async function computeHash(key: string, algorithm = 'SHA-256'): Promise<string> {
  let digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

function isNoEntityError(error: unknown): boolean {
  return hasErrorCode(error, 'ENOENT')
}
