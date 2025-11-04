import { Cookie } from '@remix-run/cookie'
import type { SessionStorage, SessionIdStorageStrategy } from '../session.ts'
import { warnOnceAboutSigningSessionCookie, Session } from '../session.ts'

interface CookieSessionStorageOptions {
  /**
   * The Cookie used to store the session data on the client, or options used
   * to automatically create one.
   */
  cookie?: SessionIdStorageStrategy['cookie']
}

/**
 * Creates and returns a SessionStorage object that stores all session data
 * directly in the session cookie itself.
 *
 * This has the advantage that no database or other backend services are
 * needed, and can help to simplify some load-balanced scenarios. However, it
 * also has the limitation that serialized session data may not exceed the
 * browser's maximum cookie size. Trade-offs!
 */
export function createCookieSessionStorage({
  cookie: cookieArg,
}: CookieSessionStorageOptions = {}): SessionStorage {
  let cookie =
    cookieArg instanceof Cookie ? cookieArg : new Cookie(cookieArg?.name || '__session', cookieArg)

  warnOnceAboutSigningSessionCookie(cookie)

  return {
    async getSession(cookieHeader, options) {
      if (cookieHeader) {
        let data = await cookie.parse(cookieHeader, options)
        if (data) {
          return new Session(JSON.parse(data))
        }
      }
      return new Session()
    },
    async commitSession(session, options) {
      let serializedCookie = await cookie.serialize(JSON.stringify(session.data), options)
      if (serializedCookie.length > 4096) {
        throw new Error(
          'Cookie length will exceed browser maximum. Length: ' + serializedCookie.length,
        )
      }
      return serializedCookie
    },
    async destroySession(_session, options) {
      return cookie.serialize('', {
        ...options,
        maxAge: undefined,
        expires: new Date(0),
      })
    },
  }
}
