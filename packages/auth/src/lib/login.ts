import type { RequestContext, RequestHandler } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import type { CredentialsAuthProvider } from './providers/credentials.ts'
import { getOAuthProviderRuntime } from './provider.ts'
import type { OAuthProvider } from './provider.ts'
import { completeAuthSession } from './session-flow.ts'
import { createOAuthTransaction, createRedirectResponse, getSession, sanitizeReturnTo } from './utils.ts'

/**
 * Options for handling a successful credentials login.
 */
export interface CredentialsAuthLoginOptions<result> {
  /** Writes application-defined auth state into the session after successful login. */
  writeSession(
    session: Session,
    result: result,
    context: RequestContext,
  ): void | Promise<void>
  /** Redirect target used when login succeeds and `onSuccess` is not provided. */
  successRedirectTo?: string | URL
  /** Redirect target used when login fails and `onFailure` is not provided. */
  failureRedirectTo?: string | URL
  /** Custom success response builder for a completed credentials login. */
  onSuccess?(result: result, context: RequestContext): Response | Promise<Response>
  /** Custom failure response builder for rejected credentials. */
  onFailure?(context: RequestContext): Response | Promise<Response>
  /** Custom error response builder for unexpected login errors. */
  onError?(error: unknown, context: RequestContext): Response | Promise<Response>
}

/**
 * Options for starting an OAuth or OIDC login redirect flow.
 */
export interface OAuthLoginOptions {
  /** Session key used to store the in-progress OAuth transaction. */
  transactionKey?: string
  /** Query parameter used to capture a post-login return target. */
  returnToParam?: string
  /** Redirect target used when login setup fails and `onError` is not provided. */
  failureRedirectTo?: string | URL
  /** Custom error response builder for unexpected OAuth login setup errors. */
  onError?(error: unknown, context: RequestContext): Response | Promise<Response>
}

/**
 * Creates a request handler that starts an OAuth or OIDC login redirect flow.
 *
 * @param provider The OAuth or OIDC provider to redirect to.
 * @param options Options for transaction storage, error handling, and return-to behavior.
 * @returns A request handler for the provider login route.
 */
export function createAuthLoginRequestHandler<profile>(
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
export function createAuthLoginRequestHandler<input, result>(
  provider: CredentialsAuthProvider<input, result>,
  options: CredentialsAuthLoginOptions<result>,
): RequestHandler

/**
 * Creates an auth login request handler for either OAuth/OIDC redirects or credentials submissions.
 *
 * @param provider The provider to use for the login flow.
 * @param options Options for the selected provider type.
 * @returns A request handler for a login route.
 */
export function createAuthLoginRequestHandler(
  provider: OAuthProvider<any> | CredentialsAuthProvider<any, any>,
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
    let session = getSession(context, 'createAuthLoginRequestHandler()')
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
  provider: CredentialsAuthProvider<any, any>,
  options: CredentialsAuthLoginOptions<any>,
  context: Parameters<RequestHandler>[0],
): Promise<Response> {
  try {
    let session = getSession(context, 'createAuthLoginRequestHandler()')
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
