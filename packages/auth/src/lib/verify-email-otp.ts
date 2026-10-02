import type { RequestContext } from '@remix-run/fetch-router'

import {
  getCredentialKey,
  isRateLimited,
  normalizeEmail,
  parseStoredObject,
  readEmailPointer,
  timingSafeEqual,
} from './email-auth.ts'
import { getEmailOTPRuntime } from './providers/email-otp.ts'
import type { EmailOTPAuthProvider } from './providers/email-otp.ts'

/**
 * Options for verifying an email OTP code.
 */
export interface VerifyEmailOTPOptions {
  /** Email address the code was sent to. */
  email: string
  /** Code submitted by the user. Spaces and hyphens are ignored. */
  code: string
}

/**
 * Result returned when an email OTP code is verified.
 */
export interface EmailOTPVerifySuccess<provider extends string = string> {
  /** Marks the code as verified and consumed. */
  status: 'success'
  /** Name of the provider that verified the code. */
  provider: provider
  /** Normalized email address the code was sent to. */
  email: string
}

/**
 * Result returned when an email OTP code cannot be verified.
 */
export interface EmailOTPVerifyFailure {
  /** Marks the code as rejected. */
  status: 'failure'
  /**
   * `invalid_code` when the code is wrong, malformed, already used, or replaced by a newer code;
   * `expired_code` when it is past its expiry; `too_many_attempts` when it is locked after too many
   * incorrect submissions; or `rate_limited` when the application's `checkRateLimit()` hook
   * rejected the request.
   */
  code: 'invalid_code' | 'expired_code' | 'too_many_attempts' | 'rate_limited'
  /** Incorrect submissions left before the code is locked, reported after a wrong code. */
  attemptsRemaining?: number
}

/**
 * Result returned by `verifyEmailOTP()`.
 */
export type EmailOTPVerifyResult<provider extends string = string> =
  | EmailOTPVerifySuccess<provider>
  | EmailOTPVerifyFailure

interface StoredCode {
  email: string
  hash: string
  attempts: number
  expiresAt: number
}

/**
 * Verifies and consumes an email OTP code.
 *
 * Each check consumes the stored code atomically, so concurrent requests with the correct code
 * produce at most one success and every incorrect submission counts toward `maxAttempts`.
 *
 * @param provider The email OTP provider that issued the code.
 * @param context The current request context.
 * @param options The email address and submitted code.
 * @returns The verified email address, or the reason verification failed.
 */
export async function verifyEmailOTP<
  context extends RequestContext<any, any> = RequestContext,
  provider extends string = string,
>(
  provider: EmailOTPAuthProvider<provider>,
  context: context,
  options: VerifyEmailOTPOptions,
): Promise<EmailOTPVerifyResult<provider>> {
  let runtime = getEmailOTPRuntime(provider)
  let { config } = runtime
  let email = normalizeEmail(options.email)
  let code = normalizeCode(options.code)

  if (email == null || code == null || code.length !== runtime.codeLength) {
    return { status: 'failure', code: 'invalid_code' }
  }

  if (await isRateLimited(config, context, 'verify', email)) {
    return { status: 'failure', code: 'rate_limited' }
  }

  let pointer = await readEmailPointer(config, email)
  if (pointer == null) {
    return { status: 'failure', code: 'invalid_code' }
  }

  // Taking the code before comparing it means a racing request finds nothing to check, so no two
  // checks can share one attempt and a correct code can only be redeemed once.
  let key = getCredentialKey(config, 'code', pointer.id)
  let stored = await config.storage.take(key)
  let record = parseStoredCode(stored)

  if (stored == null || record == null || record.email !== email) {
    return { status: 'failure', code: 'invalid_code' }
  }

  if (record.expiresAt <= Date.now()) {
    return { status: 'failure', code: 'expired_code' }
  }

  let expiresAt = new Date(record.expiresAt)

  if (record.attempts >= runtime.maxAttempts) {
    await config.storage.set(key, stored, expiresAt)
    return { status: 'failure', code: 'too_many_attempts' }
  }

  let hash = await runtime.hashCode(pointer.id, email, code)
  if (timingSafeEqual(hash, record.hash)) {
    return { status: 'success', provider: provider.name, email }
  }

  let attempts = record.attempts + 1
  await config.storage.set(key, JSON.stringify({ ...record, attempts }), expiresAt)

  if (attempts >= runtime.maxAttempts) {
    return { status: 'failure', code: 'too_many_attempts' }
  }

  return {
    status: 'failure',
    code: 'invalid_code',
    attemptsRemaining: runtime.maxAttempts - attempts,
  }
}

function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  let code = value.replace(/[\s-]/g, '')
  return /^\d+$/.test(code) ? code : null
}

function parseStoredCode(value: string | null): StoredCode | null {
  let data = parseStoredObject(value)
  if (
    data == null ||
    typeof data.email !== 'string' ||
    typeof data.hash !== 'string' ||
    typeof data.attempts !== 'number' ||
    typeof data.expiresAt !== 'number'
  ) {
    return null
  }

  return {
    email: data.email,
    hash: data.hash,
    attempts: data.attempts,
    expiresAt: data.expiresAt,
  }
}
