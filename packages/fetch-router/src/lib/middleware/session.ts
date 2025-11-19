import type { Cookie } from '@remix-run/cookie'
import type { SessionStorage } from '@remix-run/session'

import type { Middleware } from '../middleware.ts'

/**
 * Middleware that manages `context.session` based on the session cookie.
 * @param cookie The session cookie to use
 * @param storage The storage backend for session data
 * @returns The session middleware
 */
export function session(cookie: Cookie, storage: SessionStorage): Middleware {
  if (!cookie.signed) {
    throw new Error('Session cookie must be signed')
  }

  return async (context, next) => {
    if (context.sessionStarted) {
      throw new Error('Existing session found, refusing to overwrite')
    }

    let cookieValue = await cookie.parse(context.headers.get('Cookie'))
    let session = await storage.read(cookieValue)

    context.session = session

    let response = await next()

    if (session !== context.session) {
      throw new Error('Cannot save session that was initialized by another middleware/handler')
    }

    let setCookieValue = await storage.save(session)
    if (setCookieValue != null) {
      response.headers.set('Set-Cookie', await cookie.serialize(setCookieValue))
    }
  }
}
