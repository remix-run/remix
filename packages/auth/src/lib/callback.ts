import type { RequestHandler } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import { getOAuthProviderRuntime } from './provider.ts'
import type {
  CallbackOptions,
  OAuthProvider,
  OAuthTransaction,
  SessionAuthData,
} from './types.ts'
import {
  createRedirectResponse,
  getRequiredSearchParam,
  getSession,
  resolveRedirectTarget,
} from './utils.ts'

export function callback<
  profile,
  provider extends string,
  session_auth extends SessionAuthData = SessionAuthData,
>(
  provider: OAuthProvider<profile, provider>,
  options: CallbackOptions<profile, provider, session_auth>,
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
      let sessionAuth = await options.createSessionAuth(result, context)

      session.unset(transactionKey)
      session.regenerateId(true)
      session.set(options.sessionKey ?? 'auth', sessionAuth)

      if (options.onSuccess) {
        return options.onSuccess(result, sessionAuth, context)
      }

      return createRedirectResponse(resolveRedirectTarget(transaction, options.successRedirectTo))
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
