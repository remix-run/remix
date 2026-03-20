import type { RequestContext } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import { createRedirectResponse } from './utils.ts'

export interface CompleteAuthSessionOptions<result> {
  session: Session
  result: result
  context: RequestContext
  writeSession(session: Session, result: result, context: RequestContext): void | Promise<void>
  onSuccess?(result: result, context: RequestContext): Response | Promise<Response>
  successRedirectTo: string | URL
}

export async function completeAuthSession<result>(
  options: CompleteAuthSessionOptions<result>,
): Promise<Response> {
  options.session.regenerateId(true)
  await options.writeSession(options.session, options.result, options.context)

  if (options.onSuccess) {
    return options.onSuccess(options.result, options.context)
  }

  return createRedirectResponse(options.successRedirectTo)
}
