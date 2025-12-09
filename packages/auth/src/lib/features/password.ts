import type { Session } from '@remix-run/session'
import type { Feature, FeatureContext, FeatureSchema, FeatureRoutes } from './types.ts'
import type { AuthUser } from '../types.ts'

/**
 * Error codes returned by password sign in
 */
export type PasswordSignInErrorCode = 'invalid_credentials'

/**
 * Error codes returned by password sign up
 */
export type PasswordSignUpErrorCode = 'email_taken'

/**
 * Error codes returned by getResetToken
 */
export type PasswordGetResetTokenErrorCode = 'user_not_found'

/**
 * Error codes returned by password reset completion
 */
export type PasswordResetCompleteErrorCode = 'invalid_or_expired_token' | 'user_not_found'

/**
 * Error codes returned by password change
 */
export type PasswordChangeErrorCode = 'not_authenticated' | 'invalid_password' | 'no_password'

/**
 * Error codes returned by password set (adding password to OAuth-only account)
 */
export type PasswordSetErrorCode = 'not_authenticated' | 'password_already_set'

/**
 * Password hashing and verification using PBKDF2 (Web Crypto API)
 *
 * Format: pbkdf2:600000:{salt_hex}:{key_hex}
 * - 600,000 iterations (OWASP minimum recommendation)
 * - 16-byte salt
 * - SHA-256 hash
 */

const ITERATIONS = 600_000
const SALT_LENGTH = 16
const KEY_LENGTH = 32

/**
 * Hash a password using PBKDF2
 */
async function hashPassword(password: string): Promise<string> {
  // Generate random salt
  let salt = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(salt)

  // Hash password
  let key = await deriveKey(password, salt)

  // Format: pbkdf2:iterations:salt_hex:key_hex
  return `pbkdf2:${ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(key)}`
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Parse hash
    let parts = hash.split(':')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
      return false
    }

    let iterations = parseInt(parts[1], 10)
    let salt = hexToBytes(parts[2])
    let expectedKey = hexToBytes(parts[3])

    // Derive key from password
    let actualKey = await deriveKey(password, salt, iterations)

    // Constant-time comparison
    return timingSafeEqual(actualKey, expectedKey)
  } catch {
    return false
  }
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = ITERATIONS,
): Promise<Uint8Array> {
  let encoder = new TextEncoder()
  let passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  let derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    KEY_LENGTH * 8,
  )

  return new Uint8Array(derivedBits)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  let bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

/**
 * Password feature configuration
 */
export interface PasswordFeatureConfig {
  enabled: true
  algorithm?:
    | 'pbkdf2'
    | {
        hash: (password: string) => Promise<string>
        verify: (password: string, hash: string) => Promise<boolean>
      }
}

/**
 * Password feature methods
 */
export interface PasswordFeatureMethods {
  signIn(options: {
    session: Session
    email: string
    password: string
    request: Request
  }): Promise<{ user: AuthUser } | { error: PasswordSignInErrorCode }>

  signUp<TData extends Record<string, unknown> = {}>(
    options: {
      session: Session
      email: string
      password: string
      request: Request
    } & TData,
  ): Promise<{ user: AuthUser } | { error: PasswordSignUpErrorCode }>

  /**
   * Check if the current user has a password credential
   */
  hasPassword(session: Session): Promise<boolean>

  /**
   * Set a password for an OAuth-only account (no current password required)
   */
  set(options: {
    session: Session
    password: string
  }): Promise<{ success: true } | { error: PasswordSetErrorCode }>

  /**
   * Change an existing password (requires current password)
   */
  change(options: {
    session: Session
    currentPassword: string
    newPassword: string
  }): Promise<{ success: true } | { error: PasswordChangeErrorCode }>

  /**
   * Generate a password reset token for a user.
   * Returns the user and token on success - you handle sending the email.
   */
  getResetToken(args: {
    email: string
  }): Promise<{ user: AuthUser; token: string } | { error: PasswordGetResetTokenErrorCode }>

  reset(options: {
    session: Session
    token: string
    newPassword: string
  }): Promise<{ success: true; user: AuthUser } | { error: PasswordResetCompleteErrorCode }>
}

/**
 * Password route definitions (empty - password auth uses app-level forms, not API routes)
 */
export let passwordRoutes = {} satisfies FeatureRoutes

/**
 * Password authentication feature
 */
export const passwordFeature: Feature<
  PasswordFeatureConfig,
  PasswordFeatureMethods,
  typeof passwordRoutes
> = {
  name: 'password',
  routes: passwordRoutes,

  isEnabled(config: any): config is PasswordFeatureConfig {
    return config?.password?.enabled === true
  },

  getSchema(config): FeatureSchema {
    return {
      models: [
        {
          name: 'password',
          fields: {
            userId: { type: 'string', required: true },
            hashedPassword: { type: 'string', required: true },
          },
        },
        {
          name: 'passwordResetToken',
          fields: {
            token: { type: 'string', required: true },
            userId: { type: 'string', required: true },
            expiresAt: { type: 'date', required: true },
          },
        },
      ],
    }
  },

  createMethods(context: FeatureContext): PasswordFeatureMethods {
    let { config, storage, sessionKey } = context
    let passwordConfig = config.password as PasswordFeatureConfig

    // Determine password hash/verify functions
    let algorithm = passwordConfig.algorithm ?? 'pbkdf2'
    let { hash, verify } =
      algorithm === 'pbkdf2' ? { hash: hashPassword, verify: verifyPassword } : algorithm

    return {
      async signIn({ session, email, password }) {
        // Normalize email
        email = email.toLowerCase().trim()

        // Find user
        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: email }],
        })
        if (!user) {
          return { error: 'invalid_credentials' }
        }

        // Find password credential
        let credential = await storage.findOne<{ hashedPassword: string }>({
          model: 'password',
          where: [{ field: 'userId', value: user.id }],
        })
        if (!credential) {
          return { error: 'invalid_credentials' }
        }

        // Verify password
        let isValid = await verify(password, credential.hashedPassword)
        if (!isValid) {
          return { error: 'invalid_credentials' }
        }

        // Set session (regenerate ID for security)
        session.regenerateId(true)
        session.set(sessionKey, user.id)

        return { user }
      },

      async hasPassword(session) {
        let userId = session.get(sessionKey)
        if (typeof userId !== 'string') {
          return false
        }

        let credential = await storage.findOne<{ hashedPassword: string }>({
          model: 'password',
          where: [{ field: 'userId', value: userId }],
        })

        return credential !== null
      },

      async set({ session, password }) {
        // Get current user from session
        let userId = session.get(sessionKey)
        if (typeof userId !== 'string') {
          return { error: 'not_authenticated' as const }
        }

        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'id', value: userId }],
        })
        if (!user) {
          return { error: 'not_authenticated' as const }
        }

        // Check if user already has a password
        let existingCredential = await storage.findOne<{ hashedPassword: string }>({
          model: 'password',
          where: [{ field: 'userId', value: user.id }],
        })
        if (existingCredential) {
          return { error: 'password_already_set' as const }
        }

        // Hash and create password credential
        let hashedPassword = await hash(password)
        await storage.create({
          model: 'password',
          data: { userId: user.id, hashedPassword },
        })

        return { success: true as const }
      },

      async signUp({ session, email, password, request, ...extraData }) {
        // Normalize email
        email = email.toLowerCase().trim()

        // Check if user exists
        let existing = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: email }],
        })
        if (existing) {
          return { error: 'email_taken' }
        }

        // Hash password
        let hashedPassword = await hash(password)

        // Create user with all provided data
        let now = new Date()
        let user = await storage.create<AuthUser>({
          model: 'user',
          data: {
            email,
            name: (extraData.name as string) || email.split('@')[0], // Default name from email
            image: (extraData.image as string) || undefined,
            emailVerified: false,
            createdAt: now,
            updatedAt: now,
            ...extraData,
          },
        })

        // Create password credential
        await storage.create({
          model: 'password',
          data: { userId: user.id, hashedPassword },
        })

        // Set session (regenerate ID for security)
        session.regenerateId(true)
        session.set(sessionKey, user.id)

        // Call onUserCreated hook with request context
        if (context.onUserCreatedHook) {
          await context.onUserCreatedHook({ user, request })
        }

        return { user }
      },

      async change({ session, currentPassword, newPassword }) {
        // Get current user from session
        let userId = session.get(sessionKey)
        if (typeof userId !== 'string') {
          return { error: 'not_authenticated' as const }
        }

        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'id', value: userId }],
        })
        if (!user) {
          return { error: 'not_authenticated' as const }
        }

        // Find password credential
        let credential = await storage.findOne<{ hashedPassword: string }>({
          model: 'password',
          where: [{ field: 'userId', value: user.id }],
        })
        if (!credential) {
          return { error: 'no_password' as const }
        }

        // Verify current password
        let isValid = await verify(currentPassword, credential.hashedPassword)
        if (!isValid) {
          return { error: 'invalid_password' as const }
        }

        // Hash and update password (no session regeneration - user stays logged in)
        let hashedPassword = await hash(newPassword)
        await storage.update({
          model: 'password',
          where: [{ field: 'userId', value: user.id }],
          data: { hashedPassword },
        })

        return { success: true as const }
      },

      async getResetToken({ email }) {
        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'email', value: email }],
        })
        if (!user) {
          return { error: 'user_not_found' as const }
        }

        // Verify user has a password credential
        let credential = await storage.findOne<{ hashedPassword: string }>({
          model: 'password',
          where: [{ field: 'userId', value: user.id }],
        })
        if (!credential) {
          return { error: 'user_not_found' as const }
        }

        // Generate secure random token (Web Crypto API)
        let tokenBytes = new Uint8Array(32)
        crypto.getRandomValues(tokenBytes)
        let token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('')

        let expiresAt = new Date(Date.now() + 3600000) // 1 hour
        await storage.create({
          model: 'passwordResetToken',
          data: { token, userId: user.id, expiresAt },
        })

        return { user, token }
      },

      async reset({ session, token, newPassword }) {
        let tokenData = await storage.findOne<{ userId: string; expiresAt: Date }>({
          model: 'passwordResetToken',
          where: [{ field: 'token', value: token }],
        })
        if (!tokenData || tokenData.expiresAt < new Date()) {
          return { error: 'invalid_or_expired_token' }
        }

        let user = await storage.findOne<AuthUser>({
          model: 'user',
          where: [{ field: 'id', value: tokenData.userId }],
        })
        if (!user) {
          return { error: 'user_not_found' }
        }

        // Hash and update password
        let hashedPassword = await hash(newPassword)
        await storage.update({
          model: 'password',
          where: [{ field: 'userId', value: user.id }],
          data: { hashedPassword },
        })

        // Clear the token
        await storage.delete({
          model: 'passwordResetToken',
          where: [{ field: 'token', value: token }],
        })

        // Set session (regenerate ID for security)
        session.regenerateId(true)
        session.set(sessionKey, user.id)

        return { success: true as const, user }
      },
    }
  },
}
