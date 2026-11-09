import type { RequestContext } from '@remix-run/fetch-router'

import { sendEmailCredential, sha256 } from './email-auth.ts'
import type { EmailAuthSendResult } from './email-auth.ts'
import { getMagicLinkRuntime } from './providers/magic-link.ts'
import type { MagicLinkAuthProvider } from './providers/magic-link.ts'
import { createRandomToken, sanitizeReturnTo } from './utils.ts'

/**
 * Options for sending a magic link.
 */
export interface SendMagicLinkOptions {
  /** Email address to send the link to. */
  email: string
  /** Optional local path to normalize and return from `verifyMagicLink()`. */
  returnTo?: string | null
}

/**
 * Issues a single-use sign-in link and passes it to the provider's `sendEmail()` hook.
 *
 * A new link replaces any earlier link sent to the same address. Requests made before the
 * provider's `resendInterval` has passed return a `rate_limited` failure instead.
 *
 * @param provider The magic link provider that stores and delivers the link.
 * @param context The current request context.
 * @param options The recipient address and optional post-auth redirect target.
 * @returns The normalized address and link expiry, or the reason no link was sent.
 */
export async function sendMagicLink<
  context extends RequestContext<any, any> = RequestContext,
  provider extends string = string,
>(
  provider: MagicLinkAuthProvider<provider>,
  context: context,
  options: SendMagicLinkOptions,
): Promise<EmailAuthSendResult> {
  let runtime = getMagicLinkRuntime(provider)
  let returnTo = sanitizeReturnTo(options.returnTo ?? null)

  return sendEmailCredential(
    runtime.config,
    context,
    options.email,
    'token',
    async (email, expiresAt) => {
      let token = createRandomToken(32)
      let url = new URL(runtime.verifyUrl)
      url.searchParams.set('token', token)

      return {
        id: await sha256(token),
        value: JSON.stringify({ email, expiresAt: expiresAt.getTime(), returnTo }),
        deliver: () => runtime.sendEmail({ email, url: url.href, expiresAt }, context),
      }
    },
  )
}
