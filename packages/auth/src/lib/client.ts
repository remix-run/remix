import type { Session } from '@remix-run/session'
import type { Storage } from './storage.ts'
import type { AuthSchema, ModelSchema } from './schema.ts'
import type { AuthUser } from './types.ts'
import {
  passwordFeature,
  oauthFeature,
  emailVerificationFeature,
  type PasswordFeatureMethods,
  type OAuthFeatureMethods,
  type EmailVerificationFeatureMethods,
  type OAuthProvider,
  type OAuthAccount,
  type PasswordSignInErrorCode,
  type PasswordSignUpErrorCode,
  type PasswordChangeErrorCode,
  type PasswordResetRequestErrorCode,
  type PasswordResetCompleteErrorCode,
  type OAuthSignInErrorCode,
  type EmailVerificationRequestErrorCode,
  type EmailVerificationCompleteErrorCode,
  type FeatureContext,
} from './features/index.ts'

export interface AuthClientConfig {
  /**
   * Secret key used for cryptographic operations (encryption, signing, etc.)
   * This should be a long, random string.
   * Generate one with: `openssl rand -base64 32`
   *
   * ⚠️ Keep this secret! Never commit it to version control.
   */
  secret: string

  /**
   * Session key for storing the user ID.
   * @default '@remix-run/auth:userId'
   */
  sessionKey?: string

  /**
   * Lifecycle hooks for auth events
   */
  hooks?: {
    /**
     * Called after a new user is created (via any signup method)
     * Useful for sending welcome emails, analytics, etc.
     */
    onUserCreated?: (user: AuthUser) => void | Promise<void>
  }

  /**
   * Password authentication configuration
   */
  password?: {
    /**
     * Enable password authentication
     * When true, password signin/signup methods become available
     */
    enabled: true

    /**
     * Custom password hashing algorithm
     * @default 'pbkdf2'
     */
    algorithm?:
      | 'pbkdf2'
      | {
          hash: (password: string) => Promise<string>
          verify: (password: string, hash: string) => Promise<boolean>
        }

    /**
     * Callback invoked when a password reset is requested
     * Use this to send a password reset email with the token
     */
    sendReset(data: { user: AuthUser; token: string }): void | Promise<void>
  }

  /**
   * OAuth provider configurations
   */
  oauth?: {
    /**
     * Enable OAuth authentication
     * When true, OAuth signin methods become available
     */
    enabled: true

    /**
     * OAuth provider configurations
     */
    providers: Record<
      string,
      {
        provider: OAuthProvider
        clientId: string
        clientSecret: string
        scopes?: string[]
      }
    >

    /**
     * Base URL for the application (used to construct callback URLs)
     * Can be a string or a function that extracts it from the request
     */
    baseURL: string | ((request: Request) => string)

    /**
     * URL to redirect to after successful authentication
     */
    successURL: string

    /**
     * URL to redirect to after a new user signs up via OAuth
     * @default successURL
     */
    newUserURL?: string

    /**
     * URL to redirect to if an error occurs during authentication
     */
    errorURL: string
  }

  /**
   * Email verification configuration
   */
  emailVerification?: {
    /**
     * Enable email verification
     * When true, email verification methods become available
     */
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
   * Storage adapter implementing the generic Storage interface
   *
   * @example Using memory storage adapter
   * ```ts
   * import { createMemoryStorageAdapter } from '@remix-run/auth/storage-adapters/memory'
   *
   * storage: createMemoryStorageAdapter()
   * ```
   *
   * @example Custom storage adapter
   * ```ts
   * storage: {
   *   async findOne({ model, where }) { ... },
   *   async create({ model, data }) { ... },
   *   // ... etc
   * }
   * ```
   */
  storage: Storage
}

/**
 * Base auth client interface (always present)
 */
export interface AuthClientBase<TUser extends AuthUser = AuthUser> {
  /**
   * Schema definition for the auth models
   *
   * This schema describes the data requirements based on your configuration.
   * You can use this to generate ORM schemas, SQL migrations, or for documentation.
   */
  schema: AuthSchema

  /**
   * Get the current authenticated user from session
   */
  getUser(session: Session): Promise<TUser | null>

  /**
   * Sign out (destroy session)
   */
  signOut(session: Session): Promise<void>
}

/**
 * Full auth client type - conditionally includes Password, OAuth, and EmailVerification based on config
 * Feature methods come from their respective feature files
 */
export type AuthClient<TConfig extends AuthClientConfig = AuthClientConfig> =
  AuthClientBase<AuthUser> &
    (TConfig['password'] extends { enabled: true } ? { password: PasswordFeatureMethods } : {}) &
    (TConfig['oauth'] extends { enabled: true } ? { oauth: OAuthFeatureMethods } : {}) &
    (TConfig['emailVerification'] extends { enabled: true }
      ? { emailVerification: EmailVerificationFeatureMethods }
      : {})

/**
 * Compose schema from enabled features
 * Supports both adding new models and extending existing models with additional fields
 */
function composeSchema(config: AuthClientConfig): AuthSchema {
  let modelMap = new Map<string, ModelSchema>()

  // Start with base user model
  modelMap.set('user', {
    name: 'user',
    fields: {
      id: { type: 'string', required: true },
      email: { type: 'string', required: true },
      name: { type: 'string', required: true },
      image: { type: 'string', required: false },
      emailVerified: { type: 'boolean', required: true },
      createdAt: { type: 'date', required: true },
      updatedAt: { type: 'date', required: true },
    },
  })

  // Merge in feature schemas
  let features = [passwordFeature, oauthFeature, emailVerificationFeature] as const
  for (let feature of features) {
    if (feature.isEnabled(config)) {
      let featureSchema = feature.getSchema(config as any)
      if (featureSchema.models) {
        for (let model of featureSchema.models) {
          let existing = modelMap.get(model.name)
          if (existing) {
            // Merge fields into existing model
            existing.fields = { ...existing.fields, ...model.fields }
            // Merge indexes
            if (model.indexes) {
              existing.indexes = [...(existing.indexes || []), ...model.indexes]
            }
          } else {
            // Add new model
            modelMap.set(model.name, model)
          }
        }
      }
    }
  }

  return { models: Array.from(modelMap.values()) }
}

export function createAuthClient<const TConfig extends AuthClientConfig>(
  config: TConfig,
): AuthClient<TConfig> {
  let sessionKey = config.sessionKey ?? '@remix-run/auth:userId'

  // Compose schema from enabled features
  let schema = composeSchema(config)

  // Compose onUserCreated hook from features and user config
  let features = [passwordFeature, oauthFeature, emailVerificationFeature] as const
  let featureHooks = features
    .filter((f) => f.isEnabled(config))
    .map((f) => f.hooks?.onUserCreated)
    .filter((hook): hook is NonNullable<typeof hook> => hook !== undefined)

  let onUserCreatedHook = async (user: AuthUser) => {
    // Call feature hooks first (e.g., email verification)
    for (let hook of featureHooks) {
      await hook(user, featureContext)
    }

    // Then call user-defined hook
    if (config.hooks?.onUserCreated) {
      await config.hooks.onUserCreated(user)
    }
  }

  // Create feature context with composed hook
  let featureContext: FeatureContext = {
    config,
    storage: config.storage,
    secret: config.secret,
    sessionKey,
    onUserCreatedHook,
  }

  // Build client by composing features
  let client = {
    schema,

    ...(passwordFeature.isEnabled(config)
      ? {
          password: passwordFeature.createMethods(featureContext),
        }
      : {}),

    ...(oauthFeature.isEnabled(config)
      ? {
          oauth: oauthFeature.createMethods(featureContext),
        }
      : {}),

    ...(emailVerificationFeature.isEnabled(config)
      ? {
          emailVerification: emailVerificationFeature.createMethods(featureContext),
        }
      : {}),

    async getUser(session: Session): Promise<AuthUser | null> {
      let userId = session.get(sessionKey)
      if (typeof userId !== 'string') {
        return null
      }

      return await config.storage.findOne<AuthUser>({
        model: 'user',
        where: [{ field: 'id', value: userId }],
      })
    },

    async signOut(session: Session): Promise<void> {
      session.destroy()
    },
  }

  return client as AuthClient<TConfig>
}

// Re-export core types for convenience
export type {
  AuthUser,
  OAuthAccount,
  PasswordSignInErrorCode,
  PasswordSignUpErrorCode,
  PasswordChangeErrorCode,
  PasswordResetRequestErrorCode,
  PasswordResetCompleteErrorCode,
  OAuthSignInErrorCode,
}
