/**
 * User type for authentication
 *
 * The user table contains identity information only.
 * Authentication methods are stored in the accounts table.
 */
export interface AuthUser {
  id: string
  email: string
  name: string
  image?: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Account type for authentication methods
 *
 * All authentication methods (password, OAuth, passkeys, etc.) are stored
 * in a unified accounts table with a strategy field to distinguish them.
 *
 * Strategy values:
 * - `password` - Email/password authentication
 * - `oauth` - OAuth authentication (provider field specifies which)
 *
 * For OAuth accounts, the `provider` field contains the provider name
 * (e.g., 'github', 'google') matching the config key.
 */
export interface AuthAccount {
  id: string
  userId: string
  strategy: string // 'password', 'oauth', etc.
  provider?: string // Strategy-specific provider name (e.g., 'github', 'google', etc.)
  accountId?: string // Provider-specific ID (e.g., provider user ID for OAuth)

  // Password-specific (strategy: 'password')
  passwordHash?: string

  // OAuth-specific (strategy: 'oauth')
  accessToken?: string
  refreshToken?: string
  accessTokenExpiresAt?: Date
  refreshTokenExpiresAt?: Date
  scopes?: string // Comma-separated list of granted scopes

  createdAt: Date
  updatedAt: Date
}

/**
 * Verification type for ephemeral tokens
 *
 * Used for password reset tokens, 2FA OTP codes, magic links, etc.
 *
 * Identifier format:
 * - `password-reset:{token}` - Password reset token
 * - `2fa-otp:{userId}` - 2FA one-time password (future)
 * - `magic-link:{token}` - Magic link token (future)
 * - etc.
 */
export interface AuthVerification {
  id: string
  identifier: string // Namespaced key (e.g., 'password-reset:{token}')
  value: string // The payload (e.g., userId)
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
