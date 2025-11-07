import { type CookieProperties } from '@remix-run/headers'
import { type CookieOptions, Cookie } from '@remix-run/cookie'
import { type SessionStorage } from '@remix-run/session'
import { CookieSessionStorage } from '@remix-run/session/cookie-storage'

import type { Middleware } from '../middleware.ts'
import type { RequestContext } from '../request-context.ts'

export interface SessionOptions {
  /**
   * The properties to use for the session cookie, or a function that returns the cookie
   * properties based on the request context.
   *
   * Note: Session cookies default to `HttpOnly` to prevent client-side JavaScript from accessing
   * the cookie. You can override this default using `{ httpOnly: false }`.
   */
  cookie?: CookieProperties | ((context: RequestContext) => CookieProperties)
  /**
   * A custom session storage implementation to use for reading and writing sessions. By default,
   * session data is stored in the session cookie itself, which has a limit of 4096 bytes.
   */
  storage?: SessionStorage
}

/**
 * Middleware that manages `context.session` based on the session cookie.
 * @param cookie (optional) The cookie to use for the session (should be signed)
 * @param options (optional) The options for the session middleware
 * @returns The session middleware
 */
export function session(
  cookie?: Cookie | (CookieOptions & { name?: string }),
  options?: SessionOptions,
): Middleware {
  let sessionCookie =
    cookie instanceof Cookie ? cookie : new Cookie(cookie?.name ?? 'remix_session', cookie)
  let sessionStorage = options?.storage ?? new CookieSessionStorage()

  warnOnce(
    sessionCookie.signed,
    `Session cookie "${sessionCookie.name}" should be signed to prevent tampering`,
  )

  return async (context, next) => {
    if (context.sessionStarted) {
      throw new Error('Existing session found, refusing to overwrite')
    }

    let cookieValue = await sessionCookie.parse(context.headers.get('Cookie'))
    let session = await sessionStorage.read(cookieValue)
    let originalId = session.id

    context.session = session

    let response = await next()

    if (session !== context.session) {
      throw new Error('Cannot save session that was initialized by another middleware/handler')
    }

    let newCookieValue: string
    if (session.destroyed) {
      newCookieValue = await sessionStorage.delete(session.id)
    } else if (session.dirty) {
      if (originalId !== session.id) {
        // Session id was regenerated, delete the previous session data
        await sessionStorage.delete(originalId)
      }

      newCookieValue = await sessionStorage.update(session.id, session.data)
    } else {
      // No changes to the session, no Set-Cookie needed in the response
      return
    }

    let cookieProps = Object.assign(
      { httpOnly: true }, // default for session cookies
      typeof options?.cookie === 'function' ? options.cookie(context) : options?.cookie,
    )

    response.headers.append(
      'Set-Cookie',
      await sessionCookie.serialize(newCookieValue, cookieProps),
    )
  }
}

const warnings = new Set<string>()

function warnOnce(condition: boolean, message: string) {
  if (!condition && !warnings.has(message)) {
    warnings.add(message)
    console.warn(message)
  }
}
