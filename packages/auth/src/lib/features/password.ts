import type { Session } from '@remix-run/session'
import type {
  Feature,
  FeatureContext,
  FeatureSchema,
  FeatureRoutes,
  OperationDefinition,
  OperationResult,
} from './types.ts'
import type { AuthUser, AuthAccount } from '../types.ts'

// ============================================================================
// Error Codes (without rate_limited - framework adds it automatically)
// ============================================================================

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
export type PasswordResetErrorCode = 'invalid_or_expired_token' | 'user_not_found'

/**
 * Error codes returned by password change
 */
export type PasswordChangeErrorCode = 'not_authenticated' | 'invalid_password' | 'no_password'

/**
 * Error codes returned by password set (adding password to OAuth-only account)
 */
export type PasswordSetErrorCode = 'not_authenticated' | 'password_already_set'

// ============================================================================
// Password Hashing (PBKDF2 via Web Crypto API)
// ============================================================================

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
  let salt = new Uint8Array(SALT_LENGTH)
  crypto.getRandomValues(salt)
  let key = await deriveKey(password, salt)
  return `pbkdf2:${ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(key)}`
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    let parts = hash.split(':')
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

    let iterations = parseInt(parts[1], 10)
    let salt = hexToBytes(parts[2])
    let expectedKey = hexToBytes(parts[3])
    let actualKey = await deriveKey(password, salt, iterations)

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
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    passwordKey,
    KEY_LENGTH * 8,
  )

  return new Uint8Array(derivedBits)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  let bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

// ============================================================================
// Configuration
// ============================================================================

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

// ============================================================================
// Operation Definitions (internal - with rate limit metadata)
// ============================================================================

interface SignInArgs {
  session: Session
  email: string
  password: string
  request: Request
}

interface SignUpArgs {
  session: Session
  email: string
  password: string
  request: Request
  name?: string
  image?: string
  [key: string]: unknown
}

interface SetArgs {
  session: Session
  password: string
  request: Request
}

interface ChangeArgs {
  session: Session
  currentPassword: string
  newPassword: string
  request: Request
}

interface GetResetTokenArgs {
  email: string
  request: Request
}

interface ResetArgs {
  session: Session
  token: string
  newPassword: string
  request: Request
}

export interface PasswordOperationsDef {
  signIn: OperationDefinition<SignInArgs, 'signed_in', { user: AuthUser }, PasswordSignInErrorCode>
  signUp: OperationDefinition<SignUpArgs, 'signed_up', { user: AuthUser }, PasswordSignUpErrorCode>
  set: OperationDefinition<SetArgs, 'password_set', {}, PasswordSetErrorCode>
  change: OperationDefinition<ChangeArgs, 'password_changed', {}, PasswordChangeErrorCode>
  getResetToken: OperationDefinition<
    GetResetTokenArgs,
    'token_generated',
    { user: AuthUser; token: string },
    PasswordGetResetTokenErrorCode
  >
  reset: OperationDefinition<
    ResetArgs,
    'password_reset',
    { user: AuthUser },
    PasswordResetErrorCode
  >
}

// ============================================================================
// Public API Types (what consumers see after framework wrapping)
// ============================================================================

/**
 * Password feature methods
 */
export interface PasswordOperations {
  signIn(
    args: SignInArgs,
  ): Promise<OperationResult<'signed_in', { user: AuthUser }, PasswordSignInErrorCode>>

  signUp(
    args: SignUpArgs,
  ): Promise<OperationResult<'signed_up', { user: AuthUser }, PasswordSignUpErrorCode>>

  /**
   * Set a password for an OAuth-only account (no current password required)
   */
  set(args: SetArgs): Promise<OperationResult<'password_set', {}, PasswordSetErrorCode>>

  /**
   * Change an existing password (requires current password)
   */
  change(
    args: ChangeArgs,
  ): Promise<OperationResult<'password_changed', {}, PasswordChangeErrorCode>>

  /**
   * Generate a password reset token for a user.
   * Returns the user and token on success - you handle sending the email.
   */
  getResetToken(
    args: GetResetTokenArgs,
  ): Promise<
    OperationResult<
      'token_generated',
      { user: AuthUser; token: string },
      PasswordGetResetTokenErrorCode
    >
  >

  reset(
    args: ResetArgs,
  ): Promise<OperationResult<'password_reset', { user: AuthUser }, PasswordResetErrorCode>>
}

export interface PasswordHelpers {
  // No helpers currently - use authClient.getAccounts() instead
}

export interface PasswordFeatureMethods extends PasswordOperations, PasswordHelpers {}

// ============================================================================
// Route Definitions (empty - password uses app-level forms)
// ============================================================================

export let passwordRoutes = {} satisfies FeatureRoutes

// ============================================================================
// Feature Implementation
// ============================================================================

export const passwordFeature: Feature<
  PasswordFeatureConfig,
  PasswordOperationsDef,
  PasswordHelpers,
  typeof passwordRoutes
> = {
  name: 'password',
  routes: passwordRoutes,

  isEnabled(config: any): config is PasswordFeatureConfig {
    return config?.password?.enabled === true
  },

  getSchema(): FeatureSchema {
    return {
      models: [
        {
          name: 'authAccount',
          fields: {
            id: { type: 'string', required: true },
            userId: { type: 'string', required: true },
            strategy: { type: 'string', required: true },
            accountId: { type: 'string', required: false },
            passwordHash: { type: 'string', required: false },
            createdAt: { type: 'date', required: true },
            updatedAt: { type: 'date', required: true },
          },
        },
        {
          name: 'authVerification',
          fields: {
            id: { type: 'string', required: true },
            identifier: { type: 'string', required: true },
            value: { type: 'string', required: true },
            expiresAt: { type: 'date', required: true },
            createdAt: { type: 'date', required: true },
            updatedAt: { type: 'date', required: true },
          },
        },
      ],
    }
  },

  createOperations(context: FeatureContext): PasswordOperationsDef {
    let { config, storage, sessionKey } = context
    let passwordConfig = config.password as PasswordFeatureConfig

    let algorithm = passwordConfig.algorithm ?? 'pbkdf2'
    let { hash, verify } =
      algorithm === 'pbkdf2' ? { hash: hashPassword, verify: verifyPassword } : algorithm

    return {
      signIn: {
        rateLimit: { window: 60, max: 5 },
        async handler({ session, email, password }) {
          email = email.toLowerCase().trim()

          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'email', value: email }],
          })
          if (!user) {
            return { type: 'error', code: 'invalid_credentials' }
          }

          let account = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: [
              { field: 'userId', value: user.id },
              { field: 'strategy', value: 'password' },
            ],
          })
          if (!account || !account.passwordHash) {
            return { type: 'error', code: 'invalid_credentials' }
          }

          let isValid = await verify(password, account.passwordHash)
          if (!isValid) {
            return { type: 'error', code: 'invalid_credentials' }
          }

          session.regenerateId(true)
          session.set(sessionKey, user.id)

          return { type: 'success', code: 'signed_in', data: { user } }
        },
      },

      signUp: {
        rateLimit: { window: 60, max: 5 },
        async handler({ session, email, password, request, name, image, ...extraData }) {
          email = email.toLowerCase().trim()

          let existing = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'email', value: email }],
          })
          if (existing) {
            return { type: 'error', code: 'email_taken' }
          }

          let passwordHash = await hash(password)
          let now = new Date()

          // Create user
          let user = await storage.create<AuthUser>({
            model: 'authUser',
            data: {
              email,
              name: name || email.split('@')[0],
              image: image || undefined,
              emailVerified: false,
              createdAt: now,
              updatedAt: now,
              ...extraData,
            },
          })

          // Create password account
          await storage.create<AuthAccount>({
            model: 'authAccount',
            data: {
              userId: user.id,
              strategy: 'password',
              passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          })

          session.regenerateId(true)
          session.set(sessionKey, user.id)

          if (context.onUserCreatedHook) {
            await context.onUserCreatedHook({ user, request })
          }

          return { type: 'success', code: 'signed_up', data: { user } }
        },
      },

      set: {
        rateLimit: { window: 60, max: 5 },
        async handler({ session, password }) {
          let userId = session.get(sessionKey)
          if (typeof userId !== 'string') {
            return { type: 'error', code: 'not_authenticated' }
          }

          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'id', value: userId }],
          })
          if (!user) {
            return { type: 'error', code: 'not_authenticated' }
          }

          let existingAccount = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: [
              { field: 'userId', value: user.id },
              { field: 'strategy', value: 'password' },
            ],
          })
          if (existingAccount) {
            return { type: 'error', code: 'password_already_set' }
          }

          let passwordHash = await hash(password)
          let now = new Date()
          await storage.create<AuthAccount>({
            model: 'authAccount',
            data: {
              userId: user.id,
              strategy: 'password',
              passwordHash,
              createdAt: now,
              updatedAt: now,
            },
          })

          return { type: 'success', code: 'password_set', data: {} }
        },
      },

      change: {
        rateLimit: { window: 60, max: 5 },
        async handler({ session, currentPassword, newPassword }) {
          let userId = session.get(sessionKey)
          if (typeof userId !== 'string') {
            return { type: 'error', code: 'not_authenticated' }
          }

          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'id', value: userId }],
          })
          if (!user) {
            return { type: 'error', code: 'not_authenticated' }
          }

          let account = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: [
              { field: 'userId', value: user.id },
              { field: 'strategy', value: 'password' },
            ],
          })
          if (!account || !account.passwordHash) {
            return { type: 'error', code: 'no_password' }
          }

          let isValid = await verify(currentPassword, account.passwordHash)
          if (!isValid) {
            return { type: 'error', code: 'invalid_password' }
          }

          let passwordHash = await hash(newPassword)
          await storage.update({
            model: 'authAccount',
            where: [
              { field: 'userId', value: user.id },
              { field: 'strategy', value: 'password' },
            ],
            data: { passwordHash, updatedAt: new Date() },
          })

          return { type: 'success', code: 'password_changed', data: {} }
        },
      },

      getResetToken: {
        rateLimit: { window: 300, max: 3 },
        async handler({ email }) {
          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'email', value: email }],
          })
          if (!user) {
            return { type: 'error', code: 'user_not_found' }
          }

          let account = await storage.findOne<AuthAccount>({
            model: 'authAccount',
            where: [
              { field: 'userId', value: user.id },
              { field: 'strategy', value: 'password' },
            ],
          })
          if (!account) {
            return { type: 'error', code: 'user_not_found' }
          }

          let tokenBytes = new Uint8Array(32)
          crypto.getRandomValues(tokenBytes)
          let token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('')

          let now = new Date()
          let expiresAt = new Date(Date.now() + 3600000)
          await storage.create({
            model: 'authVerification',
            data: {
              identifier: `password-reset:${token}`,
              value: user.id,
              expiresAt,
              createdAt: now,
              updatedAt: now,
            },
          })

          return { type: 'success', code: 'token_generated', data: { user, token } }
        },
      },

      reset: {
        rateLimit: { window: 60, max: 5 },
        async handler({ session, token, newPassword }) {
          let identifier = `password-reset:${token}`
          let verification = await storage.findOne<{ value: string; expiresAt: Date }>({
            model: 'authVerification',
            where: [{ field: 'identifier', value: identifier }],
          })
          if (!verification || verification.expiresAt < new Date()) {
            return { type: 'error', code: 'invalid_or_expired_token' }
          }

          let user = await storage.findOne<AuthUser>({
            model: 'authUser',
            where: [{ field: 'id', value: verification.value }],
          })
          if (!user) {
            return { type: 'error', code: 'user_not_found' }
          }

          let passwordHash = await hash(newPassword)
          await storage.update({
            model: 'authAccount',
            where: [
              { field: 'userId', value: user.id },
              { field: 'strategy', value: 'password' },
            ],
            data: { passwordHash, updatedAt: new Date() },
          })

          await storage.delete({
            model: 'authVerification',
            where: [{ field: 'identifier', value: identifier }],
          })

          session.regenerateId(true)
          session.set(sessionKey, user.id)

          return { type: 'success', code: 'password_reset', data: { user } }
        },
      },
    }
  },

  createHelpers(): PasswordHelpers {
    return {}
  },
}
