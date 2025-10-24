import type { SessionStorage } from '@remix-run/session'
import type { Middleware } from '../middleware.ts'

export interface SessionOptions {
  /**
   * Session storage instance to create user sessions.
   */
  sessionStorage: SessionStorage
}

/**
 * Creates a middleware handler that manages user sessions.
 */
export function session(options: SessionOptions): Middleware {
  return async ({ session }, next) => {
    // No session creation - that's handled by the router when we create the
    // RouterContext.  This middleware just handles auto-committing sessions

    // TODO: If we wanted to do the session creation in here and also keep
    // `context.session` typed as `Session` (without an `| undefined`), we could
    // go with a Symbol-driven empty session that we could detect in here and
    // overwrite

    let response = await next()

    if (session.status === 'destroyed') {
      let cookie = await options.sessionStorage.destroySession(session)
      response.headers.append('Set-Cookie', cookie)
    } else if (session.status === 'new' || session.status === 'dirty') {
      // Commit the session to persist the data to the backing store
      let cookie = await options.sessionStorage.commitSession(session)

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
