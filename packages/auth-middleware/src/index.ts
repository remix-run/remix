import './lib/request-context.augment.ts'

export { auth } from './lib/auth.ts'
export { requireAuth } from './lib/require-auth.ts'
export { bearer } from './lib/schemes/bearer.ts'
export { apiKey } from './lib/schemes/api-key.ts'
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
  AuthState,
  AuthenticatedState,
  RequireAuthOptions,
  UnauthenticatedState,
} from './lib/types.ts'
