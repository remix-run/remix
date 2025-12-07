import type { Session } from '@remix-run/session'
import type { AuthUser } from '../types.ts'
import type { Feature, FeatureContext } from './types.ts'
import { signJWT, verifyJWT } from '../jwt.ts'

/**
 * Email verification error codes
 */
export type EmailVerificationRequestErrorCode = 'user_not_found'
export type EmailVerificationCompleteErrorCode = 'invalid_or_expired_token' | 'user_not_found'

/**
 * Email verification feature configuration
 */
export interface EmailVerificationFeatureConfig {
  enabled: true
  /**
   * Callback to send verification email with token
   * @param data.user - The user to send verification email to
   * @param data.token - JWT token to include in verification URL
   * @param data.isNewUser - Whether this is a new user signup (for welcome messages)
   */
  sendVerification(data: {
    user: AuthUser
    token: string
    isNewUser: boolean
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
}

/**
 * Email verification feature methods
 */
export interface EmailVerificationFeatureMethods {
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
  EmailVerificationFeatureMethods
> = {
  isEnabled(config: any): config is EmailVerificationFeatureConfig {
    return config?.emailVerification?.enabled === true
  },

  getSchema() {
    // No additional models needed - uses JWT tokens
    return { models: [] }
  },

  hooks: {
    async onUserCreated(user: AuthUser, context: FeatureContext) {
      // Only trigger if email verification is enabled
      if (!context.config.emailVerification?.enabled) {
        return
      }

      let emailVerificationConfig = context.config.emailVerification
      let expiresIn = emailVerificationConfig.expiresIn ?? 3600

      let token = await signJWT({ email: user.email }, context.secret, expiresIn)

      await emailVerificationConfig.sendVerification({
        user,
        token,
        isNewUser: true,
      })
    },
  },

  createMethods(context: FeatureContext) {
    let { config, storage, secret, sessionKey } = context
    let emailVerificationConfig = config.emailVerification!
    let expiresIn = emailVerificationConfig.expiresIn ?? 3600

    return {
      async requestVerification(email: string) {
        // Find user by email
        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: email }],
        })

        if (!user) {
          return { error: 'user_not_found' as const }
        }

        // Generate JWT token
        let token = await signJWT({ email }, secret, expiresIn)

        // Send verification email (isNewUser = false for manual requests)
        await emailVerificationConfig.sendVerification({
          user,
          token,
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
