import { createCookieSessionStorage, Session, type SessionStorage } from '@remix-run/session'
import type { Middleware } from '../middleware.ts'

export interface SessionOptions {
  /**
   * Session storage instance to create user sessions.
   */
  sessionStorage?: SessionStorage
}

export const NoOpSession: Session = new Session()

/**
 * Creates a middleware handler that manages user sessions.
 */
export function session(options?: SessionOptions): Middleware {
  let sessionStorage =
    options?.sessionStorage ?? createCookieSessionStorage({ cookie: { httpOnly: true } })

  return async (context, next) => {
    let cookie = context.headers.get('Cookie')?.toString()
    context.session = await sessionStorage.getSession(cookie)

    let response = await next()

    let { session } = context
    if (session.status === 'destroyed') {
      let cookie = await sessionStorage.destroySession(session)
      response.headers.append('Set-Cookie', cookie)
    } else if (session.status === 'dirty') {
      // Commit the session to persist the data to the backing store
      let cookie = await sessionStorage.commitSession(session)

      // But only add the Set-Cookie header if info serialized in the cookie has changed:
      // - For cookie-backed session, `session.id` is always empty - they store all
      //   data in the cookie and thus _always_ need to be committed when the session
      //   is new or dirty
      // - For non-cookie-backed sessions (file, memory, etc), `session.id` is only
      //   empty on initial creation, which means we need to commit. `session.id will
      //   be populated for existing sessions read in from a cookie, and when that
      //   happens we don't need to send up a new cookie because we already have the
      //   ID in there
      if (session.id === '') {
        response.headers.append('Set-Cookie', cookie)
      }
    }

    return response
  }
}
