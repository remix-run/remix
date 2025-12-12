import type { Cookie } from '@remix-run/cookie'
import type { Middleware } from '@remix-run/fetch-router'
import type { SessionStorage } from '@remix-run/session'

/**
 * Middleware that manages `context.session` based on the session cookie.
 *
 * @param sessionCookie The session cookie to use
 * @param sessionStorage The storage backend for session data
 * @returns The session middleware
 */
export function session(sessionCookie: Cookie, sessionStorage: SessionStorage): Middleware {
  if (!sessionCookie.signed) {
    throw new Error('Session cookie must be signed')
  }

  return async (context, next) => {
    if (context.sessionStarted) {
      throw new Error('Existing session found, refusing to overwrite')
    }

    let cookieValue = await sessionCookie.parse(context.headers.get('Cookie'))
    let session = await sessionStorage.read(cookieValue)

    context.session = session

    let response = await next()

    if (session !== context.session) {
      throw new Error('Cannot save session that was initialized by another middleware/handler')
    }

    let setCookieValue = await sessionStorage.save(session)
    if (setCookieValue != null) {
      response.headers.append('Set-Cookie', await sessionCookie.serialize(setCookieValue))
    }

    return response
  }
}
