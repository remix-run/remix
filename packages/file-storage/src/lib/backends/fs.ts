import * as fs from 'node:fs'
import fsp from 'node:fs/promises'
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
 * Use a directory dedicated to this backend and managed by the application, with consistent
 * filesystem user, groups, and directory inheritance rules across restarts and deployments.
 * Existing storage directories can be reused; storing a file under an existing key replaces
 * that entry.
 *
 * Writes stage complete content and metadata before replacing their existing files with two
 * atomic renames. Upload failures during staging preserve the previous entry. If the content
 * rename succeeds but the metadata rename fails, or the process stops between them, new content
 * remains with old metadata (or no metadata for a new key). A rejected write may have changed
 * the content. The storage format remains compatible with older versions.
 *
 * Requires a filesystem that supports atomic rename and permission to create, rename, and remove
 * files in the storage subdirectories. Existing POSIX read/write/execute mode bits are preserved;
 * owner, group, and ACLs follow the filesystem's rules for newly created files. Custom per-file
 * ownership and ACL changes are not preserved. Callers must coordinate overlapping operations,
 * including consumption of returned lazy files. Temporary cleanup is best-effort, and power-loss
 * durability is not guaranteed.
 *
 * Keys are hashed to determine paths on disk, so they may contain characters that are not valid
 * in filenames. A file's name and other metadata do not affect its storage path; files with the
 * same name can be stored under different keys.
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

  async function putFile(
    key: string,
    file: FileLike,
  ): Promise<{ filePath: string; meta: FileMetadata }> {
    let { directory, filePath, metaPath } = await getPaths(key)

    await fsp.mkdir(directory, { recursive: true })

    let metaMode = await readFileMode(metaPath)
    let dataMode = (await readFileMode(filePath)) ?? metaMode
    let uploadId = crypto.randomUUID()
    let tempDataPath = `${filePath}.${uploadId}.upload`
    let tempMetaPath = `${metaPath}.${uploadId}.upload`
    let dataHandle = await fsp.open(tempDataPath, 'wx', dataMode)
    let tempMetadataCreated = false

    try {
      let meta: FileMetadata
      try {
        // Preserve the previous mode even when the process umask has changed.
        if (dataMode !== undefined) await dataHandle.chmod(dataMode)
        for await (let chunk of file.stream()) {
          await dataHandle.writeFile(chunk)
        }
        // Streaming uploads may not expose their metadata until their content has been consumed.
        meta = {
          key,
          lastModified: file.lastModified,
          name: file.name,
          size: (await dataHandle.stat()).size,
          type: file.type,
        }
      } finally {
        await dataHandle.close()
      }

      let metaHandle = await fsp.open(tempMetaPath, 'wx', metaMode)
      tempMetadataCreated = true
      try {
        if (metaMode !== undefined) await metaHandle.chmod(metaMode)
        await metaHandle.writeFile(JSON.stringify(meta))
      } finally {
        await metaHandle.close()
      }

      // Both files are complete before publication, but the two renames are not a transaction.
      await fsp.rename(tempDataPath, filePath)
      await fsp.rename(tempMetaPath, metaPath)

      return { filePath, meta }
    } finally {
      // Cleanup must not mask a write error or turn a successful publication into a failure.
      await fsp.rm(tempDataPath, { force: true }).catch(() => {})
      if (tempMetadataCreated) {
        await fsp.rm(tempMetaPath, { force: true }).catch(() => {})
      }
    }
  }

  return {
    async get(key: string): Promise<LazyFile | null> {
      let { filePath, metaPath } = await getPaths(key)

      try {
        let meta = await readMetadata(metaPath)

        return openLazyFile(filePath, {
          lastModified: meta.lastModified,
          name: meta.name,
          type: meta.type,
        })
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

      let files: any[] = []
      let foundCursor = cursor === undefined
      let nextCursor: string | undefined
      let lastHash: string | undefined

      outerLoop: for await (let subdir of await fsp.opendir(rootDir)) {
        if (!subdir.isDirectory()) continue

        for await (let file of await fsp.opendir(path.join(rootDir, subdir.name))) {
          if (!file.isFile() || !file.name.endsWith('.meta.json')) continue

          let hash = file.name.slice(0, -10) // Remove ".meta.json"

          if (foundCursor) {
            let meta = await readMetadata(path.join(rootDir, subdir.name, file.name))

            if (prefix != null && !meta.key.startsWith(prefix)) {
              continue
            }

            if (files.length >= limit) {
              nextCursor = lastHash
              break outerLoop
            }

            if (includeMetadata) {
              files.push(meta)
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
        files,
      }
    },
    async put(key: string, file: FileLike): Promise<LazyFile> {
      let { filePath, meta } = await putFile(key, file)
      return openLazyFile(filePath, {
        lastModified: meta.lastModified,
        name: meta.name,
        type: meta.type,
      })
    },
    async remove(key: string): Promise<void> {
      let { directory, filePath, metaPath } = await getPaths(key)

      try {
        await Promise.all([fsp.unlink(filePath), fsp.unlink(metaPath)])

        // Check if directory is empty and remove it if so
        let files = await fsp.readdir(directory)
        if (files.length === 0) {
          await fsp.rmdir(directory)
        }
      } catch (error) {
        if (!isNoEntityError(error)) {
          throw error
        }
      }
    },
    async set(key: string, file: FileLike): Promise<void> {
      await putFile(key, file)
    },
  }
}

async function readFileMode(filePath: string): Promise<number | undefined> {
  try {
    return (await fsp.stat(filePath)).mode & 0o777
  } catch (error) {
    if (isNoEntityError(error)) return undefined
    throw error
  }
}

async function readMetadata(metaPath: string): Promise<FileMetadata> {
  return JSON.parse(await fsp.readFile(metaPath, 'utf-8'))
}

async function computeHash(key: string, algorithm = 'SHA-256'): Promise<string> {
  let digest = await crypto.subtle.digest(algorithm, new TextEncoder().encode(key))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function isNoEntityError(obj: unknown): obj is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return obj instanceof Error && 'code' in obj && (obj as NodeJS.ErrnoException).code === 'ENOENT'
}
