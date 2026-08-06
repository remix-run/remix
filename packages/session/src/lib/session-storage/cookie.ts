import * as s from '@remix-run/data-schema'

import { createSession } from '../session.ts'
import type { SessionStorage } from '../session-storage.ts'

const cookieSessionSchema = s.object({
  i: s.string(),
  d: s.tuple([s.record(s.string(), s.any()), s.record(s.string(), s.any())]),
})

/**
 * Creates a session storage that stores all session data in the session cookie itself.
 *
 * Note: This is suitable for use in production. However, the total size of the session cookie is limited
 * to the browser's maximum cookie size, typically 4096 bytes.
 *
 * @returns The session storage
 */
export function createCookieSessionStorage(): SessionStorage {
  return {
    async read(cookie) {
      if (cookie) {
        try {
          let result = s.parseSafe(cookieSessionSchema, JSON.parse(cookie))
          if (result.success) {
            return createSession(result.value.i, [result.value.d[0], result.value.d[1]])
          }
        } catch {
          // Invalid JSON, fall through to create new session
        }
      }

      return createSession()
    },
    async save(session) {
      if (session.deleteId) {
        console.warn(
          `Session ID ${session.deleteId} was regenerated, but the old session cannot ` +
            'be deleted when using cookie storage',
        )
      }

      if (session.destroyed) {
        return ''
      }
      if (session.dirty) {
        return JSON.stringify({ i: session.id, d: session.data })
      }

      return null
    },
  }
}
