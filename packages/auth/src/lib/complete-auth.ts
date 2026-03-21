import type { RequestContext } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import { getSession } from './utils.ts'

/**
 * Rotates the current session id and returns the fresh session for auth writes.
 *
 * @param context Current request context with session middleware installed.
 * @returns The current session after its id has been regenerated.
 */
export function completeAuth<context extends RequestContext<any, any> = RequestContext>(
  context: context,
): Session {
  let session = getSession(context, 'completeAuth()')
  session.regenerateId(true)
  return session
}
