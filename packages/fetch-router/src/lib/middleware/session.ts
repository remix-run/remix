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
  return async (context, next) => {
    // No session creation - that's handled by the router when we create the
    // RouterContext.  This middleware just handles auto-committing sessions
    // TODO: If we wanted to do the session creation in here and also keep
    // `context.session` typed as `Session` (without an `| undefined`), we could
    // go with a Symbol-driven empty session that we could detect in here and
    // overwrite
    let response = await next()

    // TODO: Implement session dirty check
    let cookie = await options.sessionStorage.commitSession(context.session)
    response.headers.append('Set-Cookie', cookie)

    return response
  }
}
