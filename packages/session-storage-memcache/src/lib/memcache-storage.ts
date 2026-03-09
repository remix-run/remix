import { createSession } from '@remix-run/session'
import type { SessionStorage } from '@remix-run/session'
import { createMemcacheClient } from './memcache-client.ts'

const DEFAULT_KEY_PREFIX = 'remix:session:'
const MAX_MEMCACHE_KEY_LENGTH = 250
const HASH_LENGTH = 64
type SessionData = ReturnType<typeof createSession>['data']

export interface MemcacheSessionStorageOptions {
  /**
   * Whether to reuse session IDs sent from the client that are not found in storage.
   * Default is `false`.
   */
  useUnknownIds?: boolean

  /**
   * Prefix prepended to all session keys in Memcache.
   * Default is `'remix:session:'`.
   */
  keyPrefix?: string

  /**
   * Session TTL in seconds.
   * Default is `0` (never expire).
   */
  ttlSeconds?: number
}

/**
 * Creates a session storage that stores all session data in Memcache.
 *
 * Note: This storage requires a Node.js runtime with TCP socket support.
 *
 * @param server The Memcache server in `host:port` format
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export function createMemcacheSessionStorage(
  server: string,
  options?: MemcacheSessionStorageOptions,
): SessionStorage {
  let client = createMemcacheClient(server)
  let useUnknownIds = options?.useUnknownIds ?? false
  let keyPrefix = options?.keyPrefix ?? DEFAULT_KEY_PREFIX
  let ttlSeconds = options?.ttlSeconds ?? 0

  assertValidKeyPrefix(keyPrefix)
  assertValidTtl(ttlSeconds)

  return {
    async read(cookie) {
      let id = cookie

      if (id) {
        let data = await readSessionData(id)
        if (data != null) {
          return createSession(id, data)
        }
      }

      return createSession(useUnknownIds && id ? id : undefined)
    },
    async save(session) {
      if (session.deleteId) {
        await deleteSessionData(session.deleteId)
      }

      if (session.destroyed) {
        await deleteSessionData(session.id)
        return ''
      }
      if (session.dirty) {
        await writeSessionData(session.id, session.data)
        return session.id
      }

      return null
    },
  }

  async function readSessionData(id: string): Promise<SessionData | null> {
    let key = await getMemcacheKey(keyPrefix, id)
    let value = await client.get(key)

    if (value == null) {
      return null
    }

    try {
      return JSON.parse(value) as SessionData
    } catch (error) {
      throw new Error(
        `Failed to parse session data for session ID ${id}: ${getErrorMessage(error)}`,
      )
    }
  }

  async function writeSessionData(id: string, data: SessionData): Promise<void> {
    let key = await getMemcacheKey(keyPrefix, id)
    await client.set(key, JSON.stringify(data), ttlSeconds)
  }

  async function deleteSessionData(id: string): Promise<void> {
    let key = await getMemcacheKey(keyPrefix, id)
    await client.delete(key)
  }
}

async function getMemcacheKey(prefix: string, id: string): Promise<string> {
  return `${prefix}${await computeHash(id)}`
}

function assertValidKeyPrefix(keyPrefix: string): void {
  if (!/^[\x21-\x7e]*$/.test(keyPrefix)) {
    throw new Error('Memcache keyPrefix may only contain printable ASCII characters without spaces')
  }

  let keyPrefixBytes = Buffer.byteLength(keyPrefix, 'utf8')
  if (keyPrefixBytes + HASH_LENGTH > MAX_MEMCACHE_KEY_LENGTH) {
    throw new Error(
      `Memcache keyPrefix is too long. Maximum length is ${MAX_MEMCACHE_KEY_LENGTH - HASH_LENGTH} bytes`,
    )
  }
}

function assertValidTtl(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 0) {
    throw new Error(`Memcache ttlSeconds must be a non-negative integer. Received: ${ttlSeconds}`)
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function computeHash(id: string, algorithm = 'SHA-256'): Promise<string> {
  let encoder = new TextEncoder()
  let data = encoder.encode(id)
  let hashBuffer = await crypto.subtle.digest(algorithm, data)
  let hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
