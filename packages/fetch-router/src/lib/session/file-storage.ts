import * as path from 'node:path'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'

import {
  type SessionData,
  type SessionStorage,
  type SessionStorageOptions,
  Session,
} from '../session.ts'

/**
 * Stores session data in files on the filesystem.
 *
 * Session files are organized in subdirectories based on a hash of the session ID for
 * efficient lookups and to avoid having too many files in a single directory.
 */
export class FileSessionStorage implements SessionStorage {
  constructor(directory: string, options?: SessionStorageOptions) {
    this.#root = path.resolve(directory)
    this.#useUnknownIds = options?.useUnknownIds ?? false

    try {
      let stats = fs.statSync(this.#root)
      if (!stats.isDirectory()) {
        throw new Error(`Path "${this.#root}" is not a directory`)
      }
    } catch (error) {
      if (!isNoEntityError(error)) {
        throw error
      }

      fs.mkdirSync(this.#root, { recursive: true })
    }
  }

  #root: string
  #useUnknownIds: boolean

  async read(cookieValue: string | null): Promise<Session> {
    let id = cookieValue

    if (id != null) {
      try {
        let filePath = await this.#getFilePath(id)
        let content = await fsp.readFile(filePath, 'utf-8')
        let data = JSON.parse(content) as SessionData
        return new Session(id, data)
      } catch (error) {
        if (!isNoEntityError(error)) {
          throw error
        }
        // File doesn't exist, fall through to create new session
      }
    }

    let session = new Session(id != null && this.#useUnknownIds ? id : undefined)
    await this.#store(session.id, session.data)

    return session
  }

  async update(id: string, data: SessionData): Promise<string> {
    await this.#store(id, data)
    return id
  }

  async delete(id: string): Promise<string> {
    try {
      let filePath = await this.#getFilePath(id)
      await fsp.unlink(filePath)
    } catch (error) {
      // Ignore errors if file doesn't exist
      if (!isNoEntityError(error)) {
        throw error
      }
    }
    return ''
  }

  async #getFilePath(id: string): Promise<string> {
    let hash = await computeHash(id)
    let subdir = hash.slice(0, 2)
    let filename = hash.slice(2)
    return path.join(this.#root, subdir, filename)
  }

  async #store(id: string, data: SessionData): Promise<void> {
    let filePath = await this.#getFilePath(id)
    await fsp.mkdir(path.dirname(filePath), { recursive: true })
    await fsp.writeFile(filePath, JSON.stringify(data), 'utf-8')
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
