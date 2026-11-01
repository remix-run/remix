import type { RequestContext } from '@remix-run/fetch-router'

import { createNumericCode, sendEmailCredential } from './email-auth.ts'
import type { EmailAuthSendResult } from './email-auth.ts'
import { getEmailOTPRuntime } from './providers/email-otp.ts'
import type { EmailOTPAuthProvider } from './providers/email-otp.ts'
import { createRandomToken } from './utils.ts'

/**
 * Options for sending an email OTP code.
 */
export interface SendEmailOTPOptions {
  /** Email address to send the code to. */
  email: string
}

/**
 * Issues a one-time sign-in code and passes it to the provider's `sendEmail()` hook.
 *
 * A new code replaces any earlier code sent to the same address and resets the attempt count.
 * Requests made before the provider's `resendInterval` has passed return a `rate_limited` failure
 * instead.
 *
 * @param provider The email OTP provider that stores and delivers the code.
 * @param context The current request context.
 * @param options The recipient address.
 * @returns The normalized address and code expiry, or the reason no code was sent.
 */
export async function sendEmailOTP<
  context extends RequestContext<any, any> = RequestContext,
  provider extends string = string,
>(
  provider: EmailOTPAuthProvider<provider>,
  context: context,
  options: SendEmailOTPOptions,
): Promise<EmailAuthSendResult> {
  let runtime = getEmailOTPRuntime(provider)

  return sendEmailCredential(
    runtime.config,
    context,
    options.email,
    'code',
    async (email, expiresAt) => {
      let id = createRandomToken(16)
      let code = createNumericCode(runtime.codeLength)

      return {
        id,
        value: JSON.stringify({
          email,
          hash: await runtime.hashCode(id, email, code),
          attempts: 0,
          expiresAt: expiresAt.getTime(),
        }),
        deliver: () => runtime.sendEmail({ email, code, expiresAt }, context),
      }
    },
  )
}
