export { callback } from './lib/callback.ts'
export { credentials } from './lib/credentials.ts'
export { login } from './lib/login.ts'
export { auth0 } from './lib/providers/auth0.ts'
export { facebook } from './lib/providers/facebook.ts'
export { github } from './lib/providers/github.ts'
export { google } from './lib/providers/google.ts'
export { microsoft } from './lib/providers/microsoft.ts'
export { oidc } from './lib/providers/oidc.ts'
export { okta } from './lib/providers/okta.ts'

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
  SessionAuthData,
} from './lib/types.ts'
