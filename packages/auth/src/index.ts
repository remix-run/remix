export { createAuthClient } from './lib/client.ts'
export type {
  AuthClientConfig,
  AuthClient,
  AuthClientBase,
  AuthUser,
  OAuthAccount,
} from './lib/client.ts'

// Storage
export type { Storage, Where } from './lib/storage.ts'

// Schema
export type { AuthSchema, ModelSchema, FieldSchema } from './lib/schema.ts'

// OAuth (from features)
export type { OAuthProvider, OAuthProviderConfig } from './lib/features/oauth/index.ts'
