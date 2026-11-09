import type { RequestContext } from '@remix-run/fetch-router'

import { createEmailAuthConfig, hmacSha256, importHmacKey } from '../email-auth.ts'
import type { EmailAuthAttempt, EmailAuthConfig, EmailAuthStorage } from '../email-auth.ts'

const emailOTPProvider = Symbol('email-otp-provider')
const minCodeLength = 6
const maxCodeLength = 12

/**
 * One-time sign-in code passed to an email OTP provider's `sendEmail()` hook.
 */
export interface EmailOTPMessage {
  /** Normalized recipient email address. */
  email: string
  /** Numeric one-time code to include in the email. */
  code: string
  /** Time when the code stops working. */
  expiresAt: Date
}

/**
 * Options for building an email OTP auth provider.
 */
export interface EmailOTPAuthProviderOptions<provider extends string = 'email-otp'> {
  /** Provider name used to namespace stored codes and reported on verified results. */
  name?: provider
  /** Persistent storage for pending codes. */
  storage: EmailAuthStorage
  /**
   * Server-side secret used to HMAC codes before they are stored, so stored values cannot be
   * reversed by guessing every possible code.
   */
  secret: string
  /** Delivers the code with the application's email service. */
  sendEmail(message: EmailOTPMessage, context: RequestContext): void | Promise<void>
  /** Number of digits in each code, from 6 to 12. Defaults to `6`. */
  codeLength?: number
  /** Seconds until a code expires. Defaults to `600` (10 minutes). */
  expiresIn?: number
  /** Incorrect submissions allowed before a code is locked. Defaults to `3`. */
  maxAttempts?: number
  /** Seconds before another code can be sent to the same address. Defaults to `60`. */
  resendInterval?: number
  /**
   * Applies application rate limits before a code is sent or checked. Return `false` to reject
   * the request.
   */
  checkRateLimit?(
    attempt: EmailAuthAttempt<provider>,
    context: RequestContext,
  ): boolean | Promise<boolean>
}

/**
 * Public shape for an email OTP provider used by `sendEmailOTP()` and `verifyEmailOTP()`.
 */
export interface EmailOTPAuthProvider<provider extends string = string> {
  /** Provider name used to namespace stored codes and reported on verified results. */
  name: provider
  /**
   * Distinguishes email OTP providers from other email auth providers.
   *
   * @internal
   */
  readonly [emailOTPProvider]: true
}

export interface EmailOTPRuntime<provider extends string = string> {
  config: EmailAuthConfig<provider>
  codeLength: number
  maxAttempts: number
  sendEmail: EmailOTPAuthProviderOptions<provider>['sendEmail']
  hashCode(id: string, email: string, code: string): Promise<string>
}

const runtimes = new WeakMap<object, EmailOTPRuntime<any>>()

/**
 * Creates a provider for passwordless sign-in with one-time codes delivered by email.
 *
 * @param options Code storage, delivery, secret, length, expiry, and attempt settings.
 * @returns A provider that can be passed to `sendEmailOTP()` and `verifyEmailOTP()`.
 */
export function createEmailOTPAuthProvider<provider extends string = 'email-otp'>(
  options: EmailOTPAuthProviderOptions<provider>,
): EmailOTPAuthProvider<provider> {
  let name = options.name ?? ('email-otp' as provider)
  let config = createEmailAuthConfig(name, options, 10 * 60)

  if (typeof options.secret !== 'string' || options.secret.length === 0) {
    throw new Error(`Missing secret for the "${name}" email auth provider.`)
  }

  if (typeof options.sendEmail !== 'function') {
    throw new Error(`Missing sendEmail() for the "${name}" email auth provider.`)
  }

  let codeLength = options.codeLength ?? 6
  if (!Number.isInteger(codeLength) || codeLength < minCodeLength || codeLength > maxCodeLength) {
    throw new Error(
      `Expected "codeLength" for "${name}" to be an integer from ${minCodeLength} to ${maxCodeLength}.`,
    )
  }

  let maxAttempts = options.maxAttempts ?? 3
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error(`Expected "maxAttempts" for "${name}" to be a positive integer.`)
  }

  let secret = options.secret
  let keyPromise: Promise<CryptoKey> | undefined

  let provider: EmailOTPAuthProvider<provider> = {
    name,
    [emailOTPProvider]: true,
  }

  runtimes.set(provider, {
    config,
    codeLength,
    maxAttempts,
    sendEmail: options.sendEmail,
    async hashCode(id, email, code) {
      keyPromise ??= importHmacKey(secret)
      return hmacSha256(await keyPromise, [name, id, email, code].join('\n'))
    },
  })

  return provider
}

export function getEmailOTPRuntime<provider extends string>(
  provider: EmailOTPAuthProvider<provider>,
): EmailOTPRuntime<provider> {
  let runtime = runtimes.get(provider)
  if (runtime == null) {
    throw new Error(`Invalid email OTP provider "${provider.name}".`)
  }

  return runtime
}
