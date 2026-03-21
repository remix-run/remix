import type { RequestContext } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import { createRedirectResponse } from './utils.ts'

export interface CompleteAuthSessionOptions<
  result,
  context extends RequestContext<any, any> = RequestContext,
> {
  session: Session
  result: result
  context: context
  writeSession(session: Session, result: result, context: context): void | Promise<void>
  onSuccess?(result: result, context: context): Response | Promise<Response>
  successRedirectTo: string | URL
}

export async function completeAuthSession<
  result,
  context extends RequestContext<any, any> = RequestContext,
>(options: CompleteAuthSessionOptions<result, context>): Promise<Response> {
  options.session.regenerateId(true)
  await options.writeSession(options.session, options.result, options.context)

  if (options.onSuccess) {
    return options.onSuccess(options.result, options.context)
  }

  return createRedirectResponse(options.successRedirectTo)
}
