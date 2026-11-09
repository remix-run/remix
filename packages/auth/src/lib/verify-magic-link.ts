import type { RequestContext } from '@remix-run/fetch-router'

import { getCredentialKey, parseStoredObject, readEmailPointer, sha256 } from './email-auth.ts'
import { getMagicLinkRuntime } from './providers/magic-link.ts'
import type { MagicLinkAuthProvider } from './providers/magic-link.ts'
import { sanitizeReturnTo } from './utils.ts'

const tokenPattern = /^[A-Za-z0-9_-]{43}$/

/**
 * Options for verifying a magic link.
 */
export interface VerifyMagicLinkOptions {
  /** Token to verify. Defaults to the `token` search param of the current request URL. */
  token?: string | null
}

/**
 * Result returned when a magic link is verified.
 */
export interface MagicLinkVerifySuccess<provider extends string = string> {
  /** Marks the link as verified and consumed. */
  status: 'success'
  /** Name of the provider that verified the link. */
  provider: provider
  /** Normalized email address the link was sent to. */
  email: string
  /** Normalized local post-auth redirect path, when one was stored with the link. */
  returnTo?: string
}

/**
 * Result returned when a magic link cannot be verified.
 */
export interface MagicLinkVerifyFailure {
  /** Marks the link as rejected. */
  status: 'failure'
  /**
   * `expired_token` when the link is past its expiry, or `invalid_token` when it is malformed,
   * unknown, already used, or replaced by a newer link.
   */
  code: 'invalid_token' | 'expired_token'
}

/**
 * Result returned by `verifyMagicLink()`.
 */
export type MagicLinkVerifyResult<provider extends string = string> =
  | MagicLinkVerifySuccess<provider>
  | MagicLinkVerifyFailure

/**
 * Verifies and consumes a magic link token.
 *
 * Each token is consumed atomically, so concurrent requests with the same token produce at most
 * one success. Call this from a `POST` handler, because email link scanners may follow `GET` links.
 *
 * @param provider The magic link provider that issued the link.
 * @param context The current request context.
 * @param options Optional token override.
 * @returns The verified email address and stored `returnTo` path, or the reason verification failed.
 */
export async function verifyMagicLink<
  context extends RequestContext<any, any> = RequestContext,
  provider extends string = string,
>(
  provider: MagicLinkAuthProvider<provider>,
  context: context,
  options: VerifyMagicLinkOptions = {},
): Promise<MagicLinkVerifyResult<provider>> {
  let { config } = getMagicLinkRuntime(provider)
  let token = options.token !== undefined ? options.token : context.url.searchParams.get('token')

  if (token == null || !tokenPattern.test(token)) {
    return { status: 'failure', code: 'invalid_token' }
  }

  let id = await sha256(token)
  let record = parseStoredObject(await config.storage.take(getCredentialKey(config, 'token', id)))

  if (record == null || typeof record.email !== 'string' || typeof record.expiresAt !== 'number') {
    return { status: 'failure', code: 'invalid_token' }
  }

  if (record.expiresAt <= Date.now()) {
    return { status: 'failure', code: 'expired_token' }
  }

  let pointer = await readEmailPointer(config, record.email)
  if (pointer?.id !== id) {
    return { status: 'failure', code: 'invalid_token' }
  }

  return {
    status: 'success',
    provider: provider.name,
    email: record.email,
    returnTo: sanitizeReturnTo(typeof record.returnTo === 'string' ? record.returnTo : null),
  }
}
