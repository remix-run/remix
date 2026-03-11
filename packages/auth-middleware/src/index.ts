export { auth } from './lib/auth.ts'
export { requireAuth } from './lib/require-auth.ts'
export { bearer } from './lib/schemes/bearer.ts'
export { apiKey } from './lib/schemes/api-key.ts'
export { Auth } from './lib/types.ts'
export type { BearerOptions } from './lib/schemes/bearer.ts'
export type { ApiKeyOptions } from './lib/schemes/api-key.ts'

export type {
  AuthFailure,
  AuthOptions,
  AuthScheme,
  AuthSchemeFailure,
  AuthSchemeAuthenticateResult,
  AuthSchemeResult,
  AuthSchemeSuccess,
  AuthenticatedAuth,
  RequireAuthOptions,
  UnauthenticatedAuth,
} from './lib/types.ts'
