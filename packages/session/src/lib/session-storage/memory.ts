import { createSession, type SessionData } from '../session.ts'
import type { SessionStorage } from '../session-storage.ts'

export interface MemorySessionStorageOptions {
  /**
   * Whether to reuse session IDs sent from the client that are not found in storage.
   * Default is `false`.
   */
  useUnknownIds?: boolean
}

/**
 * Creates a session storage that stores all session data in memory.
 *
 * Note: This is useful for testing and development. All session data is lost when the
 * server restarts.
 *
 * @param options The options for the session storage
 * @returns The session storage
 */
export function createMemorySessionStorage(options?: MemorySessionStorageOptions): SessionStorage {
  let useUnknownIds = options?.useUnknownIds ?? false
  let map = new Map<string, SessionData>()

  return {
    async read(cookie) {
      let id = cookie

      if (id == null) {
        return createSession()
      }
      if (id !== '' && map.has(id)) {
        return createSession(id, map.get(id))
      }

      return createSession(useUnknownIds && id !== '' ? id : undefined)
    },
    async save(session) {
      if (session.deleteId) {
        map.delete(session.deleteId)
      }

      if (session.destroyed) {
        map.delete(session.id)
        return ''
      }
      if (session.dirty) {
        map.set(session.id, session.data)
        return session.id
      }

      return null
    },
  }
}
