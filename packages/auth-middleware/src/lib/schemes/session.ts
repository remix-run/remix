import type { RequestContext } from '@remix-run/fetch-router'
import { Session } from '@remix-run/session'

import type { AuthFailure, AuthScheme } from '../types.ts'

export interface SessionAuthOptions<
  identity,
  session_value = unknown,
  scheme extends string = 'session',
> {
  name?: scheme
  read(session: Session, context: RequestContext): session_value | null | undefined
  verify(
    value: session_value,
    context: RequestContext,
  ): identity | null | Promise<identity | null>
  invalidate?(session: Session, context: RequestContext): void | Promise<void>
  code?: AuthFailure['code']
  message?: string
}

export function sessionAuth<
  identity,
  session_value = unknown,
  scheme extends string = 'session',
>(options: SessionAuthOptions<identity, session_value, scheme>): AuthScheme<identity, scheme> {
  let name = options.name ?? ('session' as scheme)

  return {
    name,
    async authenticate(context) {
      if (!context.has(Session)) {
        throw new Error(
          'Session not found. Make sure session() middleware runs before sessionAuth().',
        )
      }

      let session = context.get(Session)
      let value = options.read(session, context)

      if (value == null) {
        return
      }

      let identity = await options.verify(value, context)
      if (identity != null) {
        return {
          status: 'success',
          identity,
        }
      }

      await options.invalidate?.(session, context)

      return {
        status: 'failure',
        code: options.code ?? 'invalid_credentials',
        message: options.message ?? 'Invalid session',
      }
    },
  }
}
