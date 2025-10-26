import type { Session, SessionStorage } from '@remix-run/session'
import type { Middleware } from '../middleware.ts'

export interface SessionOptions {
  /**
   * Session storage instance to create user sessions.
   */
  sessionStorage: SessionStorage
}

// We use this no-op session approach so we can keep session logic contained
// in this middleware.  Otherwise, in order to ensure `context.session` is always
// populated, we would have to create it prior to creating the `RequestContext`
// because session parsing is async so it can't be done in the constructor or a
// `context.session` getter method.
export const NoOpSession: Session = {
  id: '',
  data: {},
  status: 'clean',
  has: () => false,
  get: () => undefined,
  set() {},
  unset() {},
  flash() {},
  destroy() {},
}

/**
 * Creates a middleware handler that manages user sessions.
 */
export function session(options: SessionOptions): Middleware {
  return async (context, next) => {
    if (context.session === NoOpSession) {
      let cookie = context.request.headers.get('Cookie')
      context.session = await options.sessionStorage.getSession(cookie)
    }

    let response = await next()

    let { session } = context
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
