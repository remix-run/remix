import type { RequestContext, RequestHandler } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider, OAuthResult, OAuthTransaction } from './provider.ts'
import { completeAuthSession } from './session-flow.ts'
import {
  createRedirectResponse,
  getRequiredSearchParam,
  getSession,
  resolveRedirectTarget,
} from './utils.ts'

/**
 * Options for handling an OAuth or OIDC callback request.
 */
export interface CallbackOptions<profile, provider extends string> {
  transactionKey?: string
  writeSession(
    session: Session,
    result: OAuthResult<profile, provider>,
    context: RequestContext,
  ): void | Promise<void>
  successRedirectTo?: string | URL
  failureRedirectTo?: string | URL
  onSuccess?(
    result: OAuthResult<profile, provider>,
    context: RequestContext,
  ): Response | Promise<Response>
  onFailure?(error: unknown, context: RequestContext): Response | Promise<Response>
}

/**
 * Creates a request handler for an OAuth or OIDC callback route.
 *
 * @param provider The provider that initiated the login flow.
 * @param options Options for writing session data and handling callback success or failure.
 * @returns A request handler for the provider callback route.
 */
export function callback<profile, provider extends string>(
  provider: OAuthProvider<profile, provider>,
  options: CallbackOptions<profile, provider>,
): RequestHandler {
  return async context => {
    let session: Session | undefined
    let transactionKey = options.transactionKey ?? '__auth'
    let transaction: OAuthTransaction | undefined

    try {
      session = getSession(context, 'callback()')
      transaction = session.get(transactionKey) as OAuthTransaction | undefined

      let callbackError = context.url.searchParams.get('error')
      if (callbackError != null) {
        let description = context.url.searchParams.get('error_description')
        throw new Error(description ?? callbackError)
      }

      if (transaction == null || transaction.provider !== provider.name) {
        throw new Error(`Missing OAuth transaction for "${provider.name}".`)
      }

      let state = getRequiredSearchParam(context, 'state')
      if (state !== transaction.state) {
        throw new Error('Invalid OAuth state.')
      }

      let result = await getOAuthProviderRuntime(provider).authenticate(context, transaction)
      session.unset(transactionKey)
      return await completeAuthSession({
        session,
        result,
        context,
        writeSession: options.writeSession,
        onSuccess: options.onSuccess,
        successRedirectTo: resolveRedirectTarget(transaction, options.successRedirectTo),
      })
    } catch (error) {
      if (session?.has(transactionKey)) {
        session.unset(transactionKey)
      }

      if (options.onFailure) {
        return options.onFailure(error, context)
      }

      if (options.failureRedirectTo != null) {
        return createRedirectResponse(options.failureRedirectTo)
      }

      let message = error instanceof Error ? error.message : 'Authentication failed'
      return new Response(message, { status: 401 })
    }
  }
}
