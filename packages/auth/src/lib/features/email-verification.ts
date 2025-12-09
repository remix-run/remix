import type { Session } from '@remix-run/session'
import type { AuthUser } from '../types.ts'
import type {
  Feature,
  FeatureContext,
  FeatureRoutes,
  FeatureHandlers,
  FeatureRouteHelpers,
} from './types.ts'
import { signJWT, verifyJWT } from '../jwt.ts'
import { setAuthFlash, getAuthFlash, type EmailVerificationFlash } from '../flash.ts'

/**
 * Email verification error codes
 */
export type EmailVerificationRequestErrorCode = 'user_not_found' | 'already_verified'
export type EmailVerificationCompleteErrorCode = 'invalid_or_expired_token' | 'user_not_found'

/**
 * Email verification feature configuration
 */
export interface EmailVerificationFeatureConfig {
  enabled: true
  /**
   * Callback to send verification email
   * @param data.user - The user to send verification email to
   * @param data.token - JWT token for verification
   * @param data.href - Full verification URL
   * @param data.isNewUser - Whether this is a new user signup (for welcome messages)
   * @param data.request - The original request (for deriving URLs, headers, etc.)
   */
  sendVerification(data: {
    user: AuthUser
    token: string
    href: string
    isNewUser: boolean
    request: Request
  }): void | Promise<void>
  /**
   * Optional callback after successful email verification
   * Useful for sending "welcome, you're verified!" emails or analytics
   */
  onVerified?(user: AuthUser): void | Promise<void>
  /**
   * Token expiration time in seconds
   * @default 3600 (1 hour)
   */
  expiresIn?: number
  /**
   * URL to redirect to after successful verification
   * @default '/'
   */
  successURL?: string
  /**
   * URL to redirect to if verification fails
   * @default '/'
   */
  errorURL?: string
}

/**
 * Email verification route definitions
 * Following fetch-router idiom: { routeName: { method, pattern } }
 */
export let emailVerificationRoutes = {
  verify: { method: 'GET' as const, pattern: '/verify/:token' },
} satisfies FeatureRoutes

/**
 * Email verification feature methods
 */
export interface EmailVerificationFeatureMethods {
  /**
   * Routes for URL generation
   */
  routes: FeatureRouteHelpers<typeof emailVerificationRoutes>

  /**
   * Get flash message from email verification redirect
   *
   * @example
   * ```ts
   * let flash = authClient.emailVerification.getFlash(session)
   * if (flash?.type === 'success') {
   *   // User's email was verified
   * }
   * ```
   */
  getFlash(session: Session): EmailVerificationFlash | null

  /**
   * Request email verification for a user
   * Sends verification email via configured callback
   */
  requestVerification(
    email: string,
  ): Promise<{ success: true } | { error: EmailVerificationRequestErrorCode }>

  /**
   * Verify email with token
   * Updates user's emailVerified field and optionally signs in
   */
  verify(options: {
    session: Session
    token: string
  }): Promise<{ success: true; user: AuthUser } | { error: EmailVerificationCompleteErrorCode }>
}

/**
 * Email verification feature
 * Provides JWT-based email verification with configurable callbacks
 */
export let emailVerificationFeature: Feature<
  EmailVerificationFeatureConfig,
  EmailVerificationFeatureMethods,
  typeof emailVerificationRoutes
> = {
  name: 'email-verification',
  routes: emailVerificationRoutes,

  isEnabled(config: any): config is EmailVerificationFeatureConfig {
    return config?.emailVerification?.enabled === true
  },

  getSchema() {
    // No additional models needed - uses JWT tokens
    return { models: [] }
  },

  hooks: {
    async onUserCreated({ user, context, request }) {
      // Only trigger if email verification is enabled AND user's email is not already verified
      // (e.g., if user signed up via OAuth with a verified email, skip sending verification)
      if (!context.config.emailVerification?.enabled || user.emailVerified) {
        return
      }

      let emailVerificationConfig = context.config.emailVerification
      let expiresIn = emailVerificationConfig.expiresIn ?? 3600

      let token = await signJWT({ email: user.email }, context.secret, expiresIn)
      let href = context.routes.verify.url({ token }, request)

      await emailVerificationConfig.sendVerification({
        user,
        token,
        href,
        isNewUser: true,
        request,
      })
    },
  },

  getHandlers(context): FeatureHandlers<typeof emailVerificationRoutes> {
    let { config, storage, sessionKey } = context
    let emailVerificationConfig = config.emailVerification as EmailVerificationFeatureConfig

    return {
      async verify({ params, session }) {
        let token = params.token

        if (!token) {
          setAuthFlash(session, {
            feature: 'emailVerification',
            route: 'verify',
            type: 'error',
            code: 'invalid_or_expired_token',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: emailVerificationConfig.errorURL ?? '/' },
          })
        }

        // Verify and decode JWT token
        let decoded = await verifyJWT<{ email: string }>(token, context.secret)
        if (!decoded || !decoded.email) {
          setAuthFlash(session, {
            feature: 'emailVerification',
            route: 'verify',
            type: 'error',
            code: 'invalid_or_expired_token',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: emailVerificationConfig.errorURL ?? '/' },
          })
        }

        // Find user by email from token
        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: decoded.email }],
        })

        if (!user) {
          setAuthFlash(session, {
            feature: 'emailVerification',
            route: 'verify',
            type: 'error',
            code: 'user_not_found',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: emailVerificationConfig.errorURL ?? '/' },
          })
        }

        // Update user's emailVerified field
        let updatedUser = await storage.update<AuthUser>({
          model: 'user',
          where: [{ field: 'id', value: user.id }],
          data: { emailVerified: true, updatedAt: new Date() },
        })

        if (!updatedUser) {
          setAuthFlash(session, {
            feature: 'emailVerification',
            route: 'verify',
            type: 'error',
            code: 'user_not_found',
          })
          return new Response(null, {
            status: 302,
            headers: { Location: emailVerificationConfig.errorURL ?? '/' },
          })
        }

        // Set session
        session.set(sessionKey, updatedUser.id)

        // Call onVerified callback if provided
        if (emailVerificationConfig.onVerified) {
          await emailVerificationConfig.onVerified(updatedUser)
        }

        setAuthFlash(session, {
          feature: 'emailVerification',
          route: 'verify',
          type: 'success',
          code: 'verified',
        })
        return new Response(null, {
          status: 302,
          headers: { Location: emailVerificationConfig.successURL ?? '/' },
        })
      },
    }
  },

  createMethods(context) {
    let { config, storage, secret, sessionKey } = context
    let emailVerificationConfig = config.emailVerification!
    let expiresIn = emailVerificationConfig.expiresIn ?? 3600

    return {
      // Expose auto-generated routes from context
      routes: context.routes,

      getFlash(session: Session): EmailVerificationFlash | null {
        let flash = getAuthFlash(session, { feature: 'emailVerification' })
        return flash
      },

      async requestVerification(email: string) {
        // Find user by email
        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: email }],
        })

        if (!user) {
          return { error: 'user_not_found' as const }
        }

        // Skip if already verified
        if (user.emailVerified) {
          return { error: 'already_verified' as const }
        }

        // Generate JWT token
        let token = await signJWT({ email }, secret, expiresIn)
        let href = context.routes.verify.url({ token })

        // Send verification email (isNewUser = false for manual requests)
        await emailVerificationConfig.sendVerification({
          user,
          token,
          href,
          isNewUser: false,
        })

        return { success: true as const }
      },

      async verify(options: { session: Session; token: string }) {
        let { session, token } = options

        // Verify and decode JWT token
        let decoded = await verifyJWT<{ email: string }>(token, secret)
        if (!decoded || !decoded.email) {
          return { error: 'invalid_or_expired_token' as const }
        }

        // Find user by email from token
        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: decoded.email }],
        })

        if (!user) {
          return { error: 'user_not_found' as const }
        }

        // Update user's emailVerified field
        let updatedUser = await storage.update<AuthUser>({
          model: 'user',
          where: [{ field: 'id', value: user.id }],
          data: { emailVerified: true, updatedAt: new Date() },
        })

        if (!updatedUser) {
          return { error: 'user_not_found' as const }
        }

        // Set session
        session.set(sessionKey, updatedUser.id)

        // Call onVerified callback if provided
        if (emailVerificationConfig.onVerified) {
          await emailVerificationConfig.onVerified(updatedUser)
        }

        return { success: true as const, user: updatedUser }
      },
    }
  },
}
