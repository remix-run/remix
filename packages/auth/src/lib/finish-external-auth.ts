import type { RequestContext } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider, OAuthResult, OAuthTransaction } from './provider.ts'
import { getRequiredSearchParam, getSession } from './utils.ts'

/**
 * Options for finishing an OAuth or OIDC callback flow.
 */
export interface FinishExternalAuthOptions {
  /** Session key used to read and clear the in-progress OAuth transaction. */
  transactionKey?: string
}

/**
 * Completed result returned from a successful OAuth or OIDC callback flow.
 */
export interface FinishedExternalAuthResult<profile, provider extends string = string> {
  /** Normalized OAuth or OIDC result returned by the provider runtime. */
  result: OAuthResult<profile, provider>
  /** Preserved post-auth redirect target, when one was stored in the transaction. */
  returnTo?: string
}

/**
 * Finishes an OAuth or OIDC callback flow for an external provider.
 *
 * @param provider The external provider that initiated the login flow.
 * @param context The current request context.
 * @param options Transaction lookup settings.
 * @returns The normalized provider result plus the preserved `returnTo` target, when available.
 */
export async function finishExternalAuth<
  context extends RequestContext<any, any> = RequestContext,
  profile = never,
  provider extends string = string,
>(
  provider: OAuthProvider<profile, provider>,
  context: context,
  options: FinishExternalAuthOptions = {},
): Promise<FinishedExternalAuthResult<profile, provider>> {
  let session: Session | undefined
  let transactionKey = options.transactionKey ?? '__auth'
  let transaction: OAuthTransaction | undefined

  try {
    session = getSession(context, 'finishExternalAuth()')
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

    return {
      result,
      returnTo: transaction.returnTo,
    }
  } catch (error) {
    if (session?.has(transactionKey)) {
      session.unset(transactionKey)
    }

    throw error
  }
}
