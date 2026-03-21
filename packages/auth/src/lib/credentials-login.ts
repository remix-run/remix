import type { RequestContext, RequestHandler } from '@remix-run/fetch-router'
import type { Session } from '@remix-run/session'

import type { CredentialsAuthProvider } from './providers/credentials.ts'
import { completeAuthSession } from './session-flow.ts'
import { createRedirectResponse, getSession } from './utils.ts'

/**
 * Options for handling a successful credentials login.
 */
export interface CredentialsAuthLoginOptions<
  result,
  context extends RequestContext<any, any> = RequestContext,
> {
  /** Writes application-defined auth state into the session after successful login. */
  writeSession(session: Session, result: result, context: context): void | Promise<void>
  /** Redirect target used when login succeeds and `onSuccess` is not provided. */
  successRedirectTo?: string | URL
  /** Redirect target used when login fails and `onFailure` is not provided. */
  failureRedirectTo?: string | URL
  /** Custom success response builder for a completed credentials login. */
  onSuccess?(result: result, context: context): Response | Promise<Response>
  /** Custom failure response builder for rejected credentials. */
  onFailure?(context: context): Response | Promise<Response>
  /** Custom error response builder for unexpected login errors. */
  onError?(error: unknown, context: context): Response | Promise<Response>
}

/**
 * Creates a request handler that verifies submitted credentials and persists session state.
 *
 * @param provider The credentials provider that parses and verifies the submitted input.
 * @param options Options for writing session data and handling success or failure.
 * @returns A request handler for the credentials login route.
 */
export function createCredentialsAuthLoginRequestHandler<
  context extends RequestContext<any, any> = RequestContext,
  input = never,
  result = never,
>(
  provider: CredentialsAuthProvider<input, result>,
  options: CredentialsAuthLoginOptions<result, context>,
): RequestHandler<{}, context> {
  return async (context) => {
    try {
      let session = getSession(context, 'createCredentialsAuthLoginRequestHandler()')
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
}
