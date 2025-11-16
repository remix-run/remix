import type { Cookie } from '@remix-run/cookie'

import { createSession, type SessionData } from '../session.ts'
import type { SessionStorage } from '../session-storage.ts'

/**
 * Creates a session storage that stores all session data in the session cookie itself.
 *
 * Note: This is suitable for use in production. However, the total size of the session cookie is limited
 * to the browser's maximum cookie size, typically 4096 bytes.
 *
 * @param cookie The cookie to use for the session
 * @returns The session storage
 */
export function createCookieStorage(cookie: Cookie): SessionStorage {
  if (!cookie.signed) {
    throw new Error('Session cookie must be signed')
  }

  return {
    async read(request) {
      let cookieValue = await cookie.parse(request.headers.get('Cookie'))
      if (!cookieValue) {
        return createSession()
      }

      try {
        let parsed = JSON.parse(cookieValue) as { i: string; d: SessionData }
        return createSession(parsed.i, parsed.d)
      } catch {
        // Invalid JSON, fall through to create new session
      }

      return createSession()
    },
    async save(session, response) {
      if (session.deleteId) {
        console.warn(
          `Session ID ${session.deleteId} was regenerated, but the old session cannot ` +
            'be deleted when using cookie storage',
        )
      }

      response.headers.append(
        'Set-Cookie',
        await cookie.serialize(
          session.destroyed ? '' : JSON.stringify({ i: session.id, d: session.data }),
        ),
      )
    },
  }
}
