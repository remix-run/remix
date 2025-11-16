import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import type { Cookie } from '@remix-run/cookie'

import { createSession, type SessionData } from '../session.ts'
import type { SessionStorage } from '../session-storage.ts'

export interface FileStorageOptions {
  /**
   * Whether to reuse session IDs sent from the client that are not found in storage.
   * Default is `false`.
   */
  useUnknownIds?: boolean
}

/**
 * Creates a session storage that stores all session data in files on the filesystem.
 *
 * Note: No attempt is made to avoid overwriting existing files, so the directory used should
 * be a new directory solely dedicated to this storage object.
 *
 * @param cookie The cookie to use for the session
 * @param directory The directory to store the session files in
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export function createFileStorage(
  cookie: Cookie,
  directory: string,
  options?: FileStorageOptions,
): SessionStorage {
  if (!cookie.signed) {
    throw new Error('Session cookie must be signed')
  }

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

  return {
    async read(request) {
      let id = await cookie.parse(request.headers.get('Cookie'))

      if (id) {
        try {
          let file = await getFilePath(id)
          let content = await fsp.readFile(file, 'utf-8')
          let data = JSON.parse(content) as SessionData
          return createSession(id, data)
        } catch (error) {
          if (!isNoEntityError(error)) {
            throw error
          }
          // File doesn't exist, fall through to create new session
        }
      }

      return createSession(useUnknownIds && id ? id : undefined)
    },
    async save(session, response) {
      if (session.deleteId) {
        await deleteFile(session.deleteId)
      }

      let cookieValue: string | undefined = undefined
      if (session.destroyed) {
        await deleteFile(session.id)
        cookieValue = ''
      } else if (session.dirty) {
        let file = await getFilePath(session.id)
        await fsp.mkdir(path.dirname(file), { recursive: true })
        await fsp.writeFile(file, JSON.stringify(session.data), 'utf-8')
        cookieValue = session.id
      }

      if (cookieValue != null) {
        response.headers.append('Set-Cookie', await cookie.serialize(cookieValue))
      }
    },
  }
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
