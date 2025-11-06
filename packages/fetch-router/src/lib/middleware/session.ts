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
 * @param cookie The cookie to use for the session (should be signed)
 * @param options The options for the session middleware
 * @returns The session middleware
 */
export function session(
  cookie: Cookie | (CookieOptions & { name: string }),
  options?: SessionOptions,
): Middleware {
  let sessionCookie: Cookie
  if (!(cookie instanceof Cookie)) {
    sessionCookie = new Cookie(cookie.name, cookie)
  } else {
    sessionCookie = cookie
  }

  if (!sessionCookie.signed) {
    warnOnce(
      sessionCookie.name,
      `Session cookie "${sessionCookie.name}" should be signed to prevent tampering`,
    )
  }

  let sessionStorage = options?.storage ?? new CookieSessionStorage()

  return async (context, next) => {
    let cookieValue = await sessionCookie.parse(context.request.headers.get('Cookie'))
    context.session = await sessionStorage.read(cookieValue)
    let originalId = context.session.id

    let response = await next()

    let newCookieValue: string | undefined
    if (context.session.destroyed) {
      newCookieValue = await sessionStorage.delete(context.session.id)
    } else if (context.session.dirty) {
      if (originalId !== context.session.id) {
        // Session id changed, delete the previous session data
        await sessionStorage.delete(originalId)
      }

      newCookieValue = await sessionStorage.update(context.session.id, context.session.data)
    }

    if (newCookieValue != null) {
      let cookieProps =
        typeof options?.cookie === 'function' ? options.cookie(context) : options?.cookie

      response.headers.append(
        'Set-Cookie',
        await sessionCookie.serialize(newCookieValue, cookieProps),
      )
    }
  }
}

const warnings = new Set<string>()

function warnOnce(key: string, message: string) {
  if (!warnings.has(key)) {
    warnings.add(key)
    console.warn(message)
  }
}
