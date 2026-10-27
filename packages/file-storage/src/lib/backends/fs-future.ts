import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { openLazyFile } from '@remix-run/fs'
import type { LazyFile } from '@remix-run/lazy-file'

import type {
  FileStorage,
  FileLike,
  FileKey,
  FileMetadata,
  ListOptions,
  ListResult,
} from '../file-storage.ts'

/**
 * Creates a filesystem-backed {@link FileStorage} with atomic replacement writes.
 *
 * This future API is unstable. Failed writes preserve the previous entry by publishing complete
 * content and metadata together. Existing entries written by the stable filesystem backend can
 * be read and are migrated only when successfully replaced; no bulk migration is required.
 *
 * Use a directory dedicated to this backend. Stop all access through the stable backend before
 * switching a directory to this API; stable backends cannot read the versioned content format.
 * The process needs read and write access to content and metadata, and permission to create,
 * rename, and remove files in the directory. Existing POSIX permission modes are preserved.
 *
 * Callers must coordinate overlapping reads, writes, removals, and listings across all instances
 * and processes, including consumption of returned lazy files. Requires atomic rename within a
 * directory and does not guarantee persistence across power loss.
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

  async function putFile<result>(
    key: string,
    file: FileLike,
    prepareResult: (filePath: string, meta: FileMetadata) => result,
  ): Promise<result> {
    let { directory, filePath, metaPath } = await getPaths(key)
    let previousDataPaths: string[]
    try {
      let previous = await readMetadata(metaPath)
      previousDataPaths = previous === null ? [] : [getDataPath(metaPath, previous.dataFile)]
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      previousDataPaths = await findDataPaths(filePath)
    }

    await fsp.mkdir(directory, { recursive: true })

    let metaMode = await readFileMode(metaPath)
    let dataMode: number | undefined
    // Corrupt metadata may leave multiple versions. Retain only permissions allowed by all of them.
    for (let previousDataPath of previousDataPaths) {
      let mode = await readFileMode(previousDataPath)
      if (mode !== undefined) dataMode = (dataMode ?? 0o777) & mode
    }
    dataMode ??= metaMode

    let version = crypto.randomUUID()
    let dataPath = filePath.replace(/\.dat$/, `.${version}.dat`)
    let tempMetaPath = `${metaPath}.${version}.tmp`

    let handle = await fsp.open(dataPath, 'wx', dataMode)
    let tempMetadataCreated = false
    let published = false

    try {
      let metadata: FileMetadata & { dataFile: string }
      try {
        // Restore the existing mode even if the process umask has changed since the last write.
        if (dataMode !== undefined) await handle.chmod(dataMode)
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

      // Prepare the return value before publication so preparation errors preserve the old entry.
      let result = prepareResult(dataPath, metadata)
      let metaHandle = await fsp.open(tempMetaPath, 'wx', metaMode)
      tempMetadataCreated = true
      try {
        if (metaMode !== undefined) await metaHandle.chmod(metaMode)
        await metaHandle.writeFile(JSON.stringify(metadata))
      } finally {
        await metaHandle.close()
      }

      // Only the metadata rename publishes the replacement. Until then the old entry is intact.
      await fsp.rename(tempMetaPath, metaPath)
      published = true

      // Cleanup must not turn a committed replacement into a reported failure.
      for (let previousDataPath of previousDataPaths) {
        await fsp.rm(previousDataPath, { force: true }).catch(() => {})
      }
      return result
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

      let files: (FileKey | FileMetadata)[] = []
      let foundCursor = cursor === undefined
      let nextCursor: string | undefined
      let lastHash: string | undefined

      outerLoop: for await (let subdir of await fsp.opendir(rootDir)) {
        if (!subdir.isDirectory()) continue

        for await (let file of await fsp.opendir(path.join(rootDir, subdir.name))) {
          if (!file.isFile() || !file.name.endsWith('.meta.json')) continue

          let hash = file.name.slice(0, -10) // Remove ".meta.json"

          if (foundCursor) {
            let metaPath = path.join(rootDir, subdir.name, file.name)
            let record = await readMetadata(metaPath)
            if (record === null) continue
            let { dataFile, ...meta } = record

            if (prefix != null && !meta.key.startsWith(prefix)) {
              continue
            }

            if (files.length >= limit) {
              nextCursor = lastHash
              break outerLoop
            }

            if (includeMetadata) {
              // Older entries did not store their size in metadata.
              files.push({
                ...meta,
                size: meta.size ?? (await fsp.stat(getDataPath(metaPath, dataFile))).size,
              })
            } else {
              files.push({ key: meta.key })
            }
          } else if (hash === cursor) {
            foundCursor = true
          }

          lastHash = hash
        }
      }

      return {
        cursor: nextCursor,
        files: files as ListResult<opts>['files'],
      }
    },
    put(key: string, file: FileLike): Promise<LazyFile> {
      return putFile(key, file, openLazyFile)
    },
    async remove(key: string): Promise<void> {
      let { directory, filePath, metaPath } = await getPaths(key)
      let dataPaths: string[]
      try {
        let metadata = await readMetadata(metaPath)
        dataPaths = [getDataPath(metaPath, metadata?.dataFile)]
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
        // Corrupt metadata cannot identify the current version. Callers serialize removal, so
        // all content versions belonging to this key can be removed without following its pointer.
        dataPaths = await findDataPaths(filePath)
      }

      await fsp.rm(metaPath, { force: true })
      for (let dataPath of dataPaths) {
        await fsp.rm(dataPath, { force: true })
      }
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
      await putFile(key, file, () => {})
    },
  }
}

interface StoredMetadata extends Omit<FileMetadata, 'size'> {
  size?: number
  dataFile?: string
}

function getDataPath(metaPath: string, dataFile?: string): string {
  return dataFile === undefined
    ? metaPath.replace(/\.meta\.json$/, '.dat')
    : path.join(path.dirname(metaPath), dataFile)
}

function isVersionedDataFile(name: string, hash: string): boolean {
  return /^[a-f0-9]{64}\.[a-f0-9-]{36}\.dat$/.test(name) && name.startsWith(`${hash}.`)
}

async function findDataPaths(filePath: string): Promise<string[]> {
  let directory = path.dirname(filePath)
  let hash = path.basename(filePath, '.dat')
  return (await fsp.readdir(directory))
    .filter((name) => name === `${hash}.dat` || isVersionedDataFile(name, hash))
    .map((name) => path.join(directory, name))
}

async function readFileMode(filePath: string): Promise<number | undefined> {
  try {
    return (await fsp.stat(filePath)).mode & 0o777
  } catch (error) {
    if (isNoEntityError(error)) return undefined
    throw error
  }
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
    throw new SyntaxError('Invalid stored file metadata')
  }
  let dataFile = 'dataFile' in value ? value.dataFile : undefined
  if (
    dataFile !== undefined &&
    (typeof dataFile !== 'string' ||
      !isVersionedDataFile(dataFile, path.basename(metaPath, '.meta.json')))
  ) {
    throw new SyntaxError('Invalid stored file content path')
  }
  let size = 'size' in value ? value.size : undefined
  if (size !== undefined && typeof size !== 'number') {
    throw new SyntaxError('Invalid stored file metadata')
  }
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
