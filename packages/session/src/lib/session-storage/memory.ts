import type { Cookie } from '@remix-run/cookie'

import { createSession, type SessionData } from '../session.ts'
import type { SessionStorage } from '../session-storage.ts'

export interface MemoryStorageOptions {
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
 * @param cookie The cookie to use for the session
 * @param options (optional) The options for the session storage
 * @returns The session storage
 */
export function createMemoryStorage(
  cookie: Cookie,
  options?: MemoryStorageOptions,
): SessionStorage {
  if (!cookie.signed) {
    throw new Error('Session cookie must be signed')
  }

  let useUnknownIds = options?.useUnknownIds ?? false
  let map = new Map<string, SessionData>()

  return {
    async read(request) {
      let id = await cookie.parse(request.headers.get('Cookie'))

      if (id == null) {
        return createSession()
      }
      if (id !== '' && map.has(id)) {
        return createSession(id, map.get(id))
      }

      return createSession(useUnknownIds && id !== '' ? id : undefined)
    },
    async save(session, response) {
      if (session.destroyed) {
        map.delete(session.id)
      } else {
        map.set(session.id, session.data)
      }

      if (session.deleteId) {
        map.delete(session.deleteId)
      }

      response.headers.append(
        'Set-Cookie',
        await cookie.serialize(session.destroyed ? '' : session.id),
      )
    },
  }
}
