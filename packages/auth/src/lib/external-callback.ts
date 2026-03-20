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
export interface ExternalAuthCallbackOptions<
  profile,
  provider extends string,
  context extends RequestContext<any, any> = RequestContext,
> {
  /** Session key used to read and clear the in-progress OAuth transaction. */
  transactionKey?: string
  /** Writes application-defined auth state into the session after a successful callback. */
  writeSession(
    session: Session,
    result: OAuthResult<profile, provider>,
    context: context,
  ): void | Promise<void>
  /** Redirect target used when callback succeeds and `onSuccess` is not provided. */
  successRedirectTo?: string | URL
  /** Redirect target used when callback fails and `onFailure` is not provided. */
  failureRedirectTo?: string | URL
  /** Custom success response builder for a completed OAuth callback. */
  onSuccess?(
    result: OAuthResult<profile, provider>,
    context: context,
  ): Response | Promise<Response>
  /** Custom failure response builder for callback validation or provider errors. */
  onFailure?(error: unknown, context: context): Response | Promise<Response>
}

/**
 * Creates a request handler for an OAuth or OIDC callback route.
 *
 * @param provider The external provider that initiated the login flow.
 * @param options Options for writing session data and handling callback success or failure.
 * @returns A request handler for the provider callback route.
 */
export function createExternalAuthCallbackRequestHandler<
  context extends RequestContext<any, any> = RequestContext,
  profile = never,
  provider extends string = string,
>(
  provider: OAuthProvider<profile, provider>,
  options: ExternalAuthCallbackOptions<profile, provider, context>,
): RequestHandler<{}, context> {
  return async context => {
    let session: Session | undefined
    let transactionKey = options.transactionKey ?? '__auth'
    let transaction: OAuthTransaction | undefined

    try {
      session = getSession(context, 'createExternalAuthCallbackRequestHandler()')
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

      let result = await getOAuthProviderRuntime(provider).handleCallback(context, transaction)
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
