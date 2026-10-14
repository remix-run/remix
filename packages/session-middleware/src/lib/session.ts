import type { Cookie } from '@remix-run/cookie'
import type { Middleware } from '@remix-run/fetch-router'
import { Session, type SessionStorage } from '@remix-run/session'

/**
 * Middleware that manages request session state on request context.
 * Session cookies default to HTTP-only and use Secure for HTTPS requests.
 * Explicit cookie settings take precedence.
 * Configured cookie lifetimes are also checked before loading session data.
 *
 * @param sessionCookie The session cookie to use
 * @param sessionStorage The storage backend for session data
 * @returns The session middleware
 */
export function session(
  sessionCookie: Cookie,
  sessionStorage: SessionStorage,
): Middleware<{ key: typeof Session; value: Session; property: 'session' }> {
  if (!sessionCookie.signed) {
    throw new Error('Session cookie must be signed')
  }

  if (sessionCookie.httpOnly === false) {
    console.warn(
      `Session cookie "${sessionCookie.name}" is configured with httpOnly: false and may be accessible to client-side JavaScript.`,
    )
  }

  let maxAge = sessionCookie.maxAge
  let expires = sessionCookie.expires
  let hasExpiration = maxAge != null || expires != null

  return async (context, next) => {
    if (context.has(Session)) {
      throw new Error('Existing session found, refusing to overwrite')
    }

    let cookieValue = await sessionCookie.parse(context.headers.get('Cookie'))
    if (hasExpiration) {
      cookieValue = readExpiringCookie(cookieValue)
    }
    let session = await sessionStorage.read(cookieValue)

    context.set(Session, session, { property: 'session' })

    let response = await next()

    if (session !== context.get(Session)) {
      throw new Error('Cannot save session that was initialized by another middleware/handler')
    }

    let setCookieValue = await sessionStorage.save(session)
    if (setCookieValue != null) {
      if (hasExpiration && setCookieValue !== '') {
        setCookieValue = JSON.stringify({
          value: setCookieValue,
          expires:
            maxAge != null
              ? Date.now() + maxAge * 1000
              : Math.floor((expires?.getTime() ?? 0) / 1000) * 1000,
        })
      }
      // make sure the response is mutable
      response = new Response(response.body, response)
      response.headers.append(
        'Set-Cookie',
        await sessionCookie.serialize(setCookieValue, {
          httpOnly: sessionCookie.httpOnly ?? true,
          secure: sessionCookie.secure ?? context.url.protocol === 'https:',
        }),
      )
    }

    return response
  }
}

function readExpiringCookie(cookie: string | null): string | null {
  if (cookie) {
    try {
      let data: unknown = JSON.parse(cookie)
      if (
        typeof data === 'object' &&
        data !== null &&
        'value' in data &&
        typeof data.value === 'string' &&
        'expires' in data &&
        typeof data.expires === 'number' &&
        Number.isFinite(data.expires) &&
        data.expires > Date.now()
      ) {
        return data.value
      }
    } catch {
      // Cookies issued without expiration metadata must start a new session.
    }
  }

  return null
}
