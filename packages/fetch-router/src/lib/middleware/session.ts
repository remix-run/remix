import type { SessionStorage } from '@remix-run/session'

import type { Middleware } from '../middleware.ts'
import type { RequestContext } from '../request-context.ts'

/**
 * Middleware that manages `context.session` based on the session cookie.
 *
 * The `sessionStorage` argument may either be a pre-configured `SessionStorage` object, or a
 * function that returns one based on the current request context. The function is useful when
 * anything about the session cookie and/or storage must be configured at request time.
 *
 * @param sessionStorage The storage for sessions, or a function that returns the session storage for the current request
 * @returns The session middleware
 */
export function session(
  sessionStorage: SessionStorage | ((context: RequestContext) => SessionStorage),
): Middleware {
  return async (context, next) => {
    let storage = typeof sessionStorage === 'function' ? sessionStorage(context) : sessionStorage

    if (context.sessionStarted) {
      throw new Error('Existing session found, refusing to overwrite')
    }

    let session = await storage.read(context.request)

    context.session = session

    let response = await next()

    if (session !== context.session) {
      throw new Error('Cannot save session that was initialized by another middleware/handler')
    }

    await storage.save(session, response)
  }
}
