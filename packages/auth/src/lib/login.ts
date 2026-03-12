import type { RequestHandler } from '@remix-run/fetch-router'

import { getOAuthProviderRuntime } from './provider.ts'
import type {
  CredentialsProvider,
  LoginOptions,
  OAuthLoginOptions,
  OAuthProvider,
} from './types.ts'
import { completeAuthSession } from './session-flow.ts'
import { createOAuthTransaction, createRedirectResponse, getSession, sanitizeReturnTo } from './utils.ts'

/**
 * Creates a request handler that starts an OAuth or OIDC login redirect flow.
 *
 * @param provider The OAuth or OIDC provider to redirect to.
 * @param options Options for transaction storage, error handling, and return-to behavior.
 * @returns A request handler for the provider login route.
 */
export function login<profile>(
  provider: OAuthProvider<profile>,
  options?: OAuthLoginOptions,
): RequestHandler

/**
 * Creates a request handler that verifies submitted credentials and persists session state.
 *
 * @param provider The credentials provider that parses and verifies the submitted input.
 * @param options Options for writing session data and handling success or failure.
 * @returns A request handler for the credentials login route.
 */
export function login<input, result>(
  provider: CredentialsProvider<input, result>,
  options: LoginOptions<result>,
): RequestHandler

/**
 * Creates a login request handler for either OAuth/OIDC redirects or credentials submissions.
 *
 * @param provider The provider to use for the login flow.
 * @param options Options for the selected provider type.
 * @returns A request handler for a login route.
 */
export function login(
  provider: OAuthProvider<any> | CredentialsProvider<any, any>,
  options: any = {},
): RequestHandler {
  if (provider.kind === 'oauth') {
    return (context) => loginWithOAuthProvider(provider, options, context)
  }

  return (context) => loginWithCredentialsProvider(provider, options, context)
}

async function loginWithOAuthProvider(
  provider: OAuthProvider<any>,
  options: OAuthLoginOptions,
  context: Parameters<RequestHandler>[0],
): Promise<Response> {
  try {
    let session = getSession(context, 'login()')
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

async function loginWithCredentialsProvider(
  provider: CredentialsProvider<any, any>,
  options: LoginOptions<any>,
  context: Parameters<RequestHandler>[0],
): Promise<Response> {
  try {
    let session = getSession(context, 'login()')
    let input = await provider.parse(context)
    let result = await provider.verify(input, context)

    if (result == null) {
      if (options.onFailure) {
        return options.onFailure(context)
      }

      if (options.failureRedirectTo != null) {
        return createRedirectResponse(options.failureRedirectTo)
      }

      return new Response('Invalid credentials', { status: 401 })
    }

    return await completeAuthSession({
      session,
      result,
      context,
      writeSession: options.writeSession,
      onSuccess: options.onSuccess,
      successRedirectTo: options.successRedirectTo ?? '/',
    })
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
