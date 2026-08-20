import type { RequestContext } from '@remix-run/fetch-router'

import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider } from './provider.ts'
import {
  createOAuthTransaction,
  createRedirectResponse,
  getSession,
  sanitizeReturnTo,
} from './utils.ts'

/**
 * Options for starting an OAuth or OIDC login redirect flow.
 */
export interface StartExternalAuthOptions {
  /** Session key used to store the in-progress OAuth transaction. */
  transactionKey?: string
  /** Optional post-auth redirect target to preserve in the OAuth transaction. */
  returnTo?: string | null
}

/**
 * Starts an OAuth or OIDC login redirect flow for an external provider.
 *
 * @param provider The external provider to redirect to.
 * @param context The current request context.
 * @param options Transaction storage and optional return-to settings.
 * @returns A redirect response to the provider authorization URL.
 */
export async function startExternalAuth<
  context extends RequestContext<any, any> = RequestContext,
  profile = never,
>(
  provider: OAuthProvider<profile>,
  context: context,
  options: StartExternalAuthOptions = {},
): Promise<Response> {
  let session = getSession(context, 'startExternalAuth()')
  let transaction = createOAuthTransaction(
    provider.name,
    sanitizeReturnTo(options.returnTo ?? null),
  )
  let authorizationURL = await getOAuthProviderRuntime(provider).createAuthorizationURL(transaction)

  session.set(options.transactionKey ?? '__auth', transaction)

  return createRedirectResponse(authorizationURL)
}
