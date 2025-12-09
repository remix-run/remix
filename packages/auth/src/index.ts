export { createAuthClient } from './lib/client.ts'
export type {
  AuthClientConfig,
  AuthClient,
  AuthClientBase,
  AuthHandler,
  AuthHandlerOptions,
  AuthUser,
  OAuthAccount,
} from './lib/client.ts'

// Storage
export type { Storage, Where } from './lib/storage.ts'

// Schema
export type { AuthSchema, ModelSchema, FieldSchema } from './lib/schema.ts'

// OAuth (from features)
export type {
  OAuthProvider,
  OAuthProviderConfig,
  OAuthProviderInfo,
  OAuthSignInErrorCode,
  OAuthFeatureMethods,
} from './lib/features/oauth/index.ts'

// Password (from features)
export type {
  PasswordSignInErrorCode,
  PasswordSignUpErrorCode,
  PasswordChangeErrorCode,
  PasswordSetErrorCode,
  PasswordGetResetTokenErrorCode,
  PasswordResetCompleteErrorCode,
  PasswordFeatureMethods,
} from './lib/features/password.ts'

// Email verification (from features)
export type {
  EmailVerificationRequestErrorCode,
  EmailVerificationCompleteErrorCode,
  EmailVerificationFeatureMethods,
} from './lib/features/email-verification.ts'

// Flash types
export type {
  AuthFlash,
  AuthFlashFilter,
  EmailVerificationFlash,
  EmailVerificationVerifyFlash,
  OAuthFlash,
  OAuthCallbackFlash,
} from './lib/flash.ts'
