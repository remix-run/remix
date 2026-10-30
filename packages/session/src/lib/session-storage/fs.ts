import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { createSession, type SessionData } from '../session.ts'
import type { SessionStorage } from '../session-storage.ts'

/**
 * Options for filesystem-backed session storage.
 */
export interface FsSessionStorageOptions {
  /**
   * Whether to reuse session IDs sent from the client that are not found in storage.
   * Default is `false`.
   */
  useUnknownIds?: boolean
}

/**
 * Creates a session storage that stores all session data in a filesystem directory using
 * Node's fs module.
 *
 * Note: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * @param directory The directory to store the session files in
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export function createFsSessionStorage(
  directory: string,
  options?: FsSessionStorageOptions,
): SessionStorage {
  let root = path.resolve(directory)
  let useUnknownIds = options?.useUnknownIds ?? false

  try {
    let stats = fs.statSync(root)
    if (!stats.isDirectory()) {
      throw new Error(`Path "${root}" is not a directory`)
    }
  } catch (error) {
    if (!isNoEntityError(error)) {
      throw error
    }

    fs.mkdirSync(root, { recursive: true })
  }

  async function getFilePath(id: string): Promise<string> {
    let hash = await computeHash(id)
    let subdir = hash.slice(0, 2)
    let filename = hash.slice(2)
    return path.join(root, subdir, filename)
  }

  async function deleteFile(id: string): Promise<void> {
    try {
      await fsp.unlink(await getFilePath(id))
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error
      }
    }
  }

  // Writing in place lets overlapping saves of one session interleave into invalid JSON, and lets
  // reads see a truncated file. Renaming a complete file over the old one replaces it in one step.
  async function writeFileAtomically(file: string, content: string): Promise<void> {
    let mode = await readFileMode(file)
    // The same directory keeps the rename on one filesystem, where it is atomic.
    let tempFile = `${file}.${crypto.randomUUID()}.tmp`
    let handle = await fsp.open(tempFile, 'wx', mode)

    try {
      try {
        // Restore the existing mode even if the process umask has changed since the last write.
        if (mode !== undefined) await handle.chmod(mode)
        await handle.writeFile(content, 'utf-8')
      } finally {
        await handle.close()
      }
      await replaceFile(tempFile, file)
    } catch (error) {
      await fsp.rm(tempFile, { force: true }).catch(() => {})
      throw error
    }
  }

  // Windows refuses to replace a file while it is open, and a visitor's overlapping requests keep
  // their session file open with reads and replaces. So in this process a replace waits for the
  // replaces of that file before it, and reads that start meanwhile wait for the replaces. Reads
  // already open when a replace starts close within milliseconds, which its retries outlast.
  let replacing = new Map<string, Promise<void>>()

  function replaceFile(source: string, destination: string): Promise<void> {
    let replace = (replacing.get(destination) ?? Promise.resolve()).then(() =>
      renameWithRetries(source, destination),
    )
    let settled = replace.then(release, release)
    replacing.set(destination, settled)
    return replace

    function release() {
      if (replacing.get(destination) === settled) {
        replacing.delete(destination)
      }
    }
  }

  return {
    async read(cookie) {
      let id = cookie

      if (id) {
        try {
          let file = await getFilePath(id)
          await replacing.get(file)
          let content = await fsp.readFile(file, 'utf-8')
          let data = JSON.parse(content) as SessionData
          return createSession(id, data)
        } catch (error) {
          // A crash during a save, or an earlier version's overlapping saves, can leave a file
          // that isn't valid JSON. Its data is gone, so treat it as missing rather than failing
          // every request that sends this cookie.
          if (!isNoEntityError(error) && !(error instanceof SyntaxError)) {
            throw error
          }
          // Fall through to create new session
        }
      }

      return createSession(useUnknownIds && id ? id : undefined)
    },
    async save(session) {
      if (session.deleteId) {
        await deleteFile(session.deleteId)
      }

      if (session.destroyed) {
        await deleteFile(session.id)
        return ''
      }
      if (session.dirty) {
        let file = await getFilePath(session.id)
        await fsp.mkdir(path.dirname(file), { recursive: true })
        await writeFileAtomically(file, JSON.stringify(session.data))
        return session.id
      }

      return null
    },
  }
}

// On Windows, a replace can still meet a file that another handle has open, such as a virus
// scanner's or another process's, so it retries for about a second before failing the save.
async function renameWithRetries(source: string, destination: string): Promise<void> {
  for (let delay = 10; ; delay *= 2) {
    try {
      return await fsp.rename(source, destination)
    } catch (error) {
      if (process.platform !== 'win32' || delay > 640 || !isFileInUseError(error)) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

async function readFileMode(file: string): Promise<number | undefined> {
  try {
    return (await fsp.stat(file)).mode & 0o777
  } catch (error) {
    if (isNoEntityError(error)) return undefined
    throw error
  }
}

function isFileInUseError(error: unknown): boolean {
  let code = error instanceof Error && 'code' in error ? error.code : undefined
  return code === 'EACCES' || code === 'EBUSY' || code === 'EPERM'
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

async function computeHash(id: string, algorithm = 'SHA-256'): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(id)
  let hashBuffer = await crypto.subtle.digest(algorithm, data)
  let hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
