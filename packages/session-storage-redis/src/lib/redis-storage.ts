import { createSession } from '@remix-run/session'
import type { SessionStorage } from '@remix-run/session'

type SessionData = ReturnType<typeof createSession>['data']

export interface RedisSessionStorageClient {
  get(key: string): Promise<string | null> | string | null
  set(key: string, value: string): Promise<unknown> | unknown
  del(key: string): Promise<unknown> | unknown
  setEx?(key: string, ttlSeconds: number, value: string): Promise<unknown> | unknown
  expire?(key: string, ttlSeconds: number): Promise<unknown> | unknown
}

export interface RedisSessionStorageOptions {
  /**
   * Prefix for session keys in Redis.
   *
   * @default 'session:'
   */
  keyPrefix?: string

  /**
   * Session TTL in seconds. If set, the session key expires automatically.
   *
   * @default undefined
   */
  ttl?: number

  /**
   * Whether to reuse session IDs sent from the client that are not found in storage.
   *
   * @default false
   */
  useUnknownIds?: boolean
}

/**
 * Creates a session storage backed by Redis.
 *
 * @param client Redis client with get/set/del methods
 * @param options Session storage options
 * @returns The session storage
 */
export function createRedisSessionStorage(
  client: RedisSessionStorageClient,
  options?: RedisSessionStorageOptions,
): SessionStorage {
  let keyPrefix = options?.keyPrefix ?? 'session:'
  let useUnknownIds = options?.useUnknownIds ?? false
  let ttl = normalizeTtl(options?.ttl)

  if (ttl != null && client.setEx == null && client.expire == null) {
    throw new Error('Redis client must implement setEx() or expire() when ttl is configured')
  }

  function keyForSession(id: string): string {
    return keyPrefix + id
  }

  return {
    async read(cookie) {
      let id = cookie

      if (id != null && id !== '') {
        let value = await client.get(keyForSession(id))

        if (value != null) {
          let data = JSON.parse(value) as SessionData
          return createSession(id, data)
        }
      }

      return createSession(useUnknownIds && id != null && id !== '' ? id : undefined)
    },
    async save(session) {
      if (session.deleteId) {
        await client.del(keyForSession(session.deleteId))
      }

      if (session.destroyed) {
        await client.del(keyForSession(session.id))
        return ''
      }
      if (session.dirty) {
        let key = keyForSession(session.id)
        let value = JSON.stringify(session.data)

        if (ttl == null) {
          await client.set(key, value)
        } else if (client.setEx) {
          await client.setEx(key, ttl, value)
        } else {
          let expire = client.expire

          if (expire == null) {
            throw new Error(
              'Redis client must implement setEx() or expire() when ttl is configured',
            )
          }

          await client.set(key, value)
          await expire.call(client, key, ttl)
        }

        return session.id
      }

      return null
    },
  }
}

function normalizeTtl(value: number | undefined): number | undefined {
  if (value == null) {
    return undefined
  }

  return Math.max(1, Math.floor(value))
}
