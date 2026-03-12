import type { Middleware } from '@remix-run/fetch-router'
import type {
  Auth as AuthValue,
  AuthFailure,
  AuthOptions,
  AuthScheme,
  AuthSchemeFailure,
} from './types.ts'
import { Auth } from './types.ts'

/**
 * Loads auth state for the current request by running each configured auth scheme in order.
 *
 * @param options Auth scheme configuration for the middleware.
 * @returns Middleware that resolves auth state into `context.get(Auth)`.
 */
export function auth(options: AuthOptions): Middleware {
  if (options.schemes.length === 0) {
    throw new Error('auth() requires at least one authentication scheme')
  }

  return async (context, next) => {
    for (let scheme of options.schemes) {
      let result = await scheme.authenticate(context)

      if (result == null) {
        continue
      }

      if (result.status === 'success') {
        context.set(Auth, {
          ok: true,
          identity: result.identity,
          method: scheme.name,
        } satisfies AuthValue)

        return next()
      }

      if (result.status !== 'failure') {
        throw new Error(
          `Invalid result from "${scheme.name}" auth scheme. Return null/undefined to skip, or a { status: 'success' | 'failure' } object.`,
        )
      }

      context.set(Auth, {
        ok: false,
        error: createFailure(scheme, result),
      } satisfies AuthValue)

      return next()
    }

    context.set(Auth, {
      ok: false,
    } satisfies AuthValue)

    return next()
  }
}

function createFailure(
  scheme: AuthScheme,
  result: AuthSchemeFailure,
): AuthFailure {
  return {
    method: scheme.name,
    code: result.code ?? 'invalid_credentials',
    message: result.message ?? 'Invalid credentials',
    challenge: result.challenge,
  }
}
