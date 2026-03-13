export { callback } from './lib/callback.ts'
export { createCredentialsAuthProvider } from './lib/credentials.ts'
export { login } from './lib/login.ts'
export { createAuth0AuthProvider } from './lib/providers/auth0.ts'
export { createFacebookAuthProvider } from './lib/providers/facebook.ts'
export { createGitHubAuthProvider } from './lib/providers/github.ts'
export { createGoogleAuthProvider } from './lib/providers/google.ts'
export { createMicrosoftAuthProvider } from './lib/providers/microsoft.ts'
export { createOIDCAuthProvider } from './lib/providers/oidc.ts'
export { createOktaAuthProvider } from './lib/providers/okta.ts'
export { createXAuthProvider } from './lib/providers/x.ts'

export type { CredentialsOptions } from './lib/credentials.ts'
export type { Auth0Options, Auth0Profile } from './lib/providers/auth0.ts'
export type {
  FacebookOptions,
  FacebookPicture,
  FacebookProfile,
} from './lib/providers/facebook.ts'
export type {
  GitHubEmail,
  GitHubOptions,
  GitHubProfile,
} from './lib/providers/github.ts'
export type { GoogleOptions, GoogleProfile } from './lib/providers/google.ts'
export type { MicrosoftOptions, MicrosoftProfile } from './lib/providers/microsoft.ts'
export type { OIDCOptions } from './lib/providers/oidc.ts'
export type { OktaOptions, OktaProfile } from './lib/providers/okta.ts'
export type { XOptions, XProfile } from './lib/providers/x.ts'

export type {
  CallbackOptions,
  CredentialsProvider,
  LoginOptions,
  OIDCMetadata,
  OIDCProfile,
  OAuthAccount,
  OAuthLoginOptions,
  OAuthProvider,
  OAuthResult,
  OAuthTokens,
} from './lib/types.ts'
