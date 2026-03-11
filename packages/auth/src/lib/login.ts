import type { RequestHandler } from '@remix-run/fetch-router'

import { getOAuthProviderRuntime } from './provider.ts'
import type {
  CredentialsProvider,
  LoginOptions,
  OAuthLoginOptions,
  OAuthProvider,
  SessionAuthData,
} from './types.ts'
import { createOAuthTransaction, createRedirectResponse, getSession, sanitizeReturnTo } from './utils.ts'

export function login<profile>(
  provider: OAuthProvider<profile>,
  options?: OAuthLoginOptions,
): RequestHandler

export function login<input, result, session_auth extends SessionAuthData>(
  provider: CredentialsProvider<input, result>,
  options: LoginOptions<result, session_auth>,
): RequestHandler

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
  options: LoginOptions<any, any>,
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

    let sessionAuth = await options.createSessionAuth(result, context)
    session.regenerateId(true)
    session.set(options.sessionKey ?? 'auth', sessionAuth)

    if (options.onSuccess) {
      return options.onSuccess(result, sessionAuth, context)
    }

    return createRedirectResponse(options.successRedirectTo ?? '/')
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
