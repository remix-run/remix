import type { RequestContext, RequestHandler } from '@remix-run/fetch-router'

import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider } from './provider.ts'
import { createOAuthTransaction, createRedirectResponse, getSession, sanitizeReturnTo } from './utils.ts'

/**
 * Options for starting an OAuth or OIDC login redirect flow.
 */
export interface ExternalAuthLoginOptions<context extends RequestContext<any, any> = RequestContext> {
  /** Session key used to store the in-progress OAuth transaction. */
  transactionKey?: string
  /** Query parameter used to capture a post-login return target. */
  returnToParam?: string
  /** Redirect target used when login setup fails and `onError` is not provided. */
  failureRedirectTo?: string | URL
  /** Custom error response builder for unexpected OAuth login setup errors. */
  onError?(error: unknown, context: context): Response | Promise<Response>
}

/**
 * Creates a request handler that starts an OAuth or OIDC login redirect flow.
 *
 * @param provider The external provider to redirect to.
 * @param options Options for transaction storage, error handling, and return-to behavior.
 * @returns A request handler for the external login route.
 */
export function createExternalAuthLoginRequestHandler<
  context extends RequestContext<any, any> = RequestContext,
  profile = never,
>(
  provider: OAuthProvider<profile>,
  options: ExternalAuthLoginOptions<context> = {},
): RequestHandler<{}, context> {
  return async context => {
    try {
      let session = getSession(context, 'createExternalAuthLoginRequestHandler()')
      let transaction = createOAuthTransaction(
        provider.name,
        sanitizeReturnTo(context.url.searchParams.get(options.returnToParam ?? 'returnTo')),
      )
      let authorizationURL = await getOAuthProviderRuntime(provider).createAuthorizationURL(
        transaction,
      )

      session.set(options.transactionKey ?? '__auth', transaction)

      return createRedirectResponse(authorizationURL)
    } catch (error) {
      if (options.onError) {
        return options.onError(error, context)
      }

      if (options.failureRedirectTo != null) {
        return createRedirectResponse(options.failureRedirectTo)
      }

      throw error
    }
  }
}
