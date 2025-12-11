export { createAuthClient } from './lib/client.ts'
export type { AuthClient } from './lib/client.ts'

// Core types
export type { AuthUser, AuthAccount, AuthVerification } from './lib/types.ts'

// Storage (for implementing adapters)
export type { Storage } from './lib/storage.ts'
export type { SecondaryStorage } from './lib/secondary-storage/types.ts'

// OAuth provider types (for creating custom providers)
export type { OAuthProvider, OAuthProviderConfig } from './lib/features/oauth/index.ts'
