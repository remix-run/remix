import type { Session } from '@remix-run/session'
import type { AuthUser } from '../types.ts'
import type {
  Feature,
  FeatureContext,
  FeatureRoutes,
  FeatureHandlers,
  FeatureRouteHelpers,
  OperationDefinition,
  OperationResult,
} from './types.ts'
import { signJWT, verifyJWT } from '../jwt.ts'
import { setAuthFlash, getAuthFlash, type EmailVerificationFlash } from '../flash.ts'

// ============================================================================
// Error Codes (without rate_limited - framework adds it)
// ============================================================================

/**
 * Email verification error codes
 */
export type EmailVerificationRequestErrorCode = 'user_not_found' | 'already_verified'
export type EmailVerificationCompleteErrorCode = 'invalid_or_expired_token' | 'user_not_found'

// ============================================================================
// Configuration
// ============================================================================

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

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * Email verification route definitions
 * Following fetch-router idiom: { routeName: { method, pattern } }
 */
export let emailVerificationRoutes = {
  verify: { method: 'GET' as const, pattern: '/verify/:token' },
} satisfies FeatureRoutes

// ============================================================================
// Operation Definitions (internal)
// ============================================================================

interface RequestVerificationArgs {
  email: string
  request: Request
}

interface VerifyArgs {
  session: Session
  token: string
  request: Request
}

export interface EmailVerificationOperationsDef {
  requestVerification: OperationDefinition<
    RequestVerificationArgs,
    'verification_sent',
    {},
    EmailVerificationRequestErrorCode
  >
  verify: OperationDefinition<
    VerifyArgs,
    'verified',
    { user: AuthUser },
    EmailVerificationCompleteErrorCode
  >
}

// ============================================================================
// Public API Types
// ============================================================================

/**
 * Email verification feature methods
 */
export interface EmailVerificationOperations {
  /**
   * Request email verification for a user
   * Sends verification email via configured callback
   */
  requestVerification(
    args: RequestVerificationArgs,
  ): Promise<OperationResult<'verification_sent', {}, EmailVerificationRequestErrorCode>>

  /**
   * Verify email with token
   * Updates user's emailVerified field and optionally signs in
   */
  verify(
    args: VerifyArgs,
  ): Promise<OperationResult<'verified', { user: AuthUser }, EmailVerificationCompleteErrorCode>>
}

export interface EmailVerificationHelpers {
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
}

export interface EmailVerificationFeatureMethods
  extends EmailVerificationOperations,
    EmailVerificationHelpers {}

// ============================================================================
// Feature Implementation
// ============================================================================

export let emailVerificationFeature: Feature<
  EmailVerificationFeatureConfig,
  EmailVerificationOperationsDef,
  EmailVerificationHelpers,
  typeof emailVerificationRoutes
> = {
  name: 'email-verification',
  routes: emailVerificationRoutes,

  isEnabled(config: any): config is EmailVerificationFeatureConfig {
    return config?.emailVerification?.enabled === true
  },

  getSchema() {
    return { models: [] }
  },

  hooks: {
    async onUserCreated({ user, context, request }) {
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

        let user = await storage.findOne<AuthUser>({
          model: 'authUser',
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

        let updatedUser = await storage.update<AuthUser>({
          model: 'authUser',
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

        session.set(sessionKey, updatedUser.id)

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

  createOperations(context): EmailVerificationOperationsDef {
    let { config, storage, secret, sessionKey } = context
    let emailVerificationConfig = config.emailVerification!
    let expiresIn = emailVerificationConfig.expiresIn ?? 3600

    return {
      requestVerification: {
        rateLimit: { window: 300, max: 3 },
        async handler({ email, request }) {
          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'email', value: email }],
          })

          if (!user) {
            return { type: 'error', code: 'user_not_found' }
          }

          if (user.emailVerified) {
            return { type: 'error', code: 'already_verified' }
          }

          let token = await signJWT({ email }, secret, expiresIn)
          let href = context.routes.verify.url({ token }, request)

          await emailVerificationConfig.sendVerification({
            user,
            token,
            href,
            isNewUser: false,
            request,
          })

          return { type: 'success', code: 'verification_sent', data: {} }
        },
      },

      verify: {
        rateLimit: { window: 60, max: 10 },
        async handler({ session, token }) {
          let decoded = await verifyJWT<{ email: string }>(token, secret)
          if (!decoded || !decoded.email) {
            return { type: 'error', code: 'invalid_or_expired_token' }
          }

          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'email', value: decoded.email }],
          })

          if (!user) {
            return { type: 'error', code: 'user_not_found' }
          }

          let updatedUser = await storage.update<AuthUser>({
            model: 'authUser',
            where: [{ field: 'id', value: user.id }],
            data: { emailVerified: true, updatedAt: new Date() },
          })

          if (!updatedUser) {
            return { type: 'error', code: 'user_not_found' }
          }

          session.set(sessionKey, updatedUser.id)

          if (emailVerificationConfig.onVerified) {
            await emailVerificationConfig.onVerified(updatedUser)
          }

          return { type: 'success', code: 'verified', data: { user: updatedUser } }
        },
      },
    }
  },

  createHelpers(context): EmailVerificationHelpers {
    return {
      routes: context.routes,
      getFlash(session: Session): EmailVerificationFlash | null {
        return getAuthFlash(session, { feature: 'emailVerification' })
      },
    }
  },
}
