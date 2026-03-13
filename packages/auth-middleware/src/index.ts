export { auth, Auth } from './lib/auth.ts'
export { requireAuth } from './lib/require-auth.ts'
export { createBearerTokenAuthScheme } from './lib/schemes/bearer.ts'
export { createAPIAuthScheme } from './lib/schemes/api-key.ts'
export { createSessionAuthScheme } from './lib/schemes/session.ts'
export type { BearerTokenAuthSchemeOptions } from './lib/schemes/bearer.ts'
export type { APIAuthSchemeOptions } from './lib/schemes/api-key.ts'
export type { SessionAuthSchemeOptions } from './lib/schemes/session.ts'

export type {
  AuthFailure,
  AuthOptions,
  AuthScheme,
  AuthSchemeFailure,
  AuthSchemeAuthenticateResult,
  AuthSchemeResult,
  AuthSchemeSuccess,
  AuthenticatedAuth,
  UnauthenticatedAuth,
} from './lib/auth.ts'
export type { RequireAuthOptions } from './lib/require-auth.ts'
