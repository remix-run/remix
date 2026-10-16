import type { RequestContext } from '@remix-run/fetch-router'

import { createEmailAuthConfig } from '../email-auth.ts'
import type { EmailAuthAttempt, EmailAuthConfig, EmailAuthStorage } from '../email-auth.ts'

const magicLinkProvider = Symbol('magic-link-provider')

/**
 * Sign-in link passed to a magic link provider's `sendEmail()` hook.
 */
export interface MagicLinkMessage {
  /** Normalized recipient email address. */
  email: string
  /** Absolute sign-in URL that carries the single-use token. */
  url: string
  /** Time when the link stops working. */
  expiresAt: Date
}

/**
 * Options for building a magic link auth provider.
 */
export interface MagicLinkAuthProviderOptions<provider extends string = 'magic-link'> {
  /** Provider name used to namespace stored links and reported on verified results. */
  name?: provider
  /** Persistent storage for pending links. */
  storage: EmailAuthStorage
  /**
   * Absolute URL of the route that verifies links. Each link adds its token to this URL as a
   * `token` search param. Configure it explicitly instead of deriving it from request headers.
   */
  verifyUrl: string | URL
  /** Delivers the sign-in link with the application's email service. */
  sendEmail(message: MagicLinkMessage, context: RequestContext): void | Promise<void>
  /** Seconds until a link expires. Defaults to `900` (15 minutes). */
  expiresIn?: number
  /** Seconds before another link can be sent to the same address. Defaults to `60`. */
  resendInterval?: number
  /** Applies application rate limits before a link is sent. Return `false` to reject the request. */
  checkRateLimit?(
    attempt: EmailAuthAttempt<provider>,
    context: RequestContext,
  ): boolean | Promise<boolean>
}

/**
 * Public shape for a magic link provider used by `sendMagicLink()` and `verifyMagicLink()`.
 */
export interface MagicLinkAuthProvider<provider extends string = string> {
  /** Provider name used to namespace stored links and reported on verified results. */
  name: provider
  /**
   * Distinguishes magic link providers from other email auth providers.
   *
   * @internal
   */
  readonly [magicLinkProvider]: true
}

export interface MagicLinkRuntime<provider extends string = string> {
  config: EmailAuthConfig<provider>
  verifyUrl: URL
  sendEmail: MagicLinkAuthProviderOptions<provider>['sendEmail']
}

const runtimes = new WeakMap<object, MagicLinkRuntime<any>>()

/**
 * Creates a provider for passwordless sign-in with single-use email links.
 *
 * @param options Link storage, delivery, verification URL, and expiry settings.
 * @returns A provider that can be passed to `sendMagicLink()` and `verifyMagicLink()`.
 */
export function createMagicLinkAuthProvider<provider extends string = 'magic-link'>(
  options: MagicLinkAuthProviderOptions<provider>,
): MagicLinkAuthProvider<provider> {
  let name = options.name ?? ('magic-link' as provider)
  let config = createEmailAuthConfig(name, options, 15 * 60)
  let verifyUrl = parseVerifyUrl(options.verifyUrl, name)

  if (typeof options.sendEmail !== 'function') {
    throw new Error(`Missing sendEmail() for the "${name}" email auth provider.`)
  }

  let provider: MagicLinkAuthProvider<provider> = {
    name,
    [magicLinkProvider]: true,
  }

  runtimes.set(provider, {
    config,
    verifyUrl,
    sendEmail: options.sendEmail,
  })

  return provider
}

export function getMagicLinkRuntime<provider extends string>(
  provider: MagicLinkAuthProvider<provider>,
): MagicLinkRuntime<provider> {
  let runtime = runtimes.get(provider)
  if (runtime == null) {
    throw new Error(`Invalid magic link provider "${provider.name}".`)
  }

  return runtime
}

function parseVerifyUrl(value: string | URL, name: string): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Expected "verifyUrl" for "${name}" to be an absolute URL.`)
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Expected "verifyUrl" for "${name}" to be an http: or https: URL.`)
  }

  return url
}
