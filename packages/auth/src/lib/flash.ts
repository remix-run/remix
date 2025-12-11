import type { Session } from '@remix-run/session'
import type { EmailVerificationCompleteErrorCode } from './features/email-verification.ts'
import type { OAuthErrorCode } from './features/oauth/index.ts'

/**
 * Session key used for auth flash data
 */
export const AUTH_FLASH_KEY = '@remix-run/auth:flash'

/**
 * Email verification flash types
 */
export type EmailVerificationVerifyFlash =
  | {
      feature: 'emailVerification'
      route: 'verify'
      type: 'success'
      code: 'verified'
    }
  | {
      feature: 'emailVerification'
      route: 'verify'
      type: 'error'
      code: EmailVerificationCompleteErrorCode
    }

export type EmailVerificationFlash = EmailVerificationVerifyFlash

/**
 * OAuth flash types
 */
export type OAuthCallbackFlash =
  | {
      feature: 'oauth'
      route: 'callback'
      type: 'success'
      code: 'sign_in' | 'sign_up' | 'account_linked'
    }
  | {
      feature: 'oauth'
      route: 'callback'
      type: 'error'
      code: OAuthErrorCode
    }

export type OAuthFlash = OAuthCallbackFlash

/**
 * Union of all auth flash types
 */
export type AuthFlash = EmailVerificationFlash | OAuthFlash

/**
 * Filter options for getFlash
 */
export type AuthFlashFilter =
  | { feature: 'emailVerification'; route?: 'verify' }
  | { feature: 'oauth'; route?: 'callback' }

/**
 * Helper to narrow flash type based on filter
 */
export type FilteredFlash<TFilter extends AuthFlashFilter | undefined> = TFilter extends {
  feature: 'emailVerification'
  route: 'verify'
}
  ? EmailVerificationVerifyFlash
  : TFilter extends { feature: 'emailVerification' }
    ? EmailVerificationFlash
    : TFilter extends { feature: 'oauth'; route: 'callback' }
      ? OAuthCallbackFlash
      : TFilter extends { feature: 'oauth' }
        ? OAuthFlash
        : AuthFlash

/**
 * Set auth flash data in session
 */
export function setAuthFlash(session: Session, flash: AuthFlash): void {
  session.flash(AUTH_FLASH_KEY, flash)
}

/**
 * Get auth flash data from session with optional filtering
 *
 * @example
 * ```ts
 * // Get any auth flash
 * let flash = getAuthFlash(session)
 *
 * // Narrow to email verification
 * let flash = getAuthFlash(session, { feature: 'emailVerification' })
 *
 * // Narrow to specific route
 * let flash = getAuthFlash(session, { feature: 'emailVerification', route: 'verify' })
 * ```
 */
export function getAuthFlash<TFilter extends AuthFlashFilter | undefined = undefined>(
  session: Session,
  filter?: TFilter,
): FilteredFlash<TFilter> | null {
  let flash = session.get(AUTH_FLASH_KEY) as AuthFlash | undefined

  if (!flash) {
    return null
  }

  // Apply filter if provided
  if (filter) {
    if (flash.feature !== filter.feature) {
      return null
    }
    if (filter.route && flash.route !== filter.route) {
      return null
    }
  }

  return flash as FilteredFlash<TFilter>
}
