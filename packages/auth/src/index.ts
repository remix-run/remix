export { callback } from './lib/callback.ts'
export { createCredentialsAuthProvider } from './lib/providers/credentials.ts'
export { login } from './lib/login.ts'
export { createAuth0AuthProvider } from './lib/providers/auth0.ts'
export { createFacebookAuthProvider } from './lib/providers/facebook.ts'
export { createGitHubAuthProvider } from './lib/providers/github.ts'
export { createGoogleAuthProvider } from './lib/providers/google.ts'
export { createMicrosoftAuthProvider } from './lib/providers/microsoft.ts'
export { createOIDCAuthProvider } from './lib/providers/oidc.ts'
export { createOktaAuthProvider } from './lib/providers/okta.ts'
export { createXAuthProvider } from './lib/providers/x.ts'

export type { CredentialsAuthProviderOptions } from './lib/providers/credentials.ts'
export type { Auth0AuthProviderOptions, Auth0AuthProviderProfile } from './lib/providers/auth0.ts'
export type {
  FacebookAuthProviderOptions,
  FacebookAuthProviderPicture,
  FacebookAuthProviderProfile,
} from './lib/providers/facebook.ts'
export type {
  GitHubAuthProviderEmail,
  GitHubAuthProviderOptions,
  GitHubAuthProviderProfile,
} from './lib/providers/github.ts'
export type { GoogleAuthProviderOptions, GoogleAuthProviderProfile } from './lib/providers/google.ts'
export type { MicrosoftAuthProviderOptions, MicrosoftAuthProviderProfile } from './lib/providers/microsoft.ts'
export type { OIDCAuthProviderMetadata, OIDCAuthProviderOptions, OIDCAuthProviderProfile } from './lib/providers/oidc.ts'
export type { OktaAuthProviderOptions, OktaAuthProviderProfile } from './lib/providers/okta.ts'
export type { XAuthProviderOptions, XAuthProviderProfile } from './lib/providers/x.ts'

export type {
  OAuthAccount,
  OAuthProvider,
  OAuthResult,
  OAuthTokens,
} from './lib/provider.ts'
export type { CredentialsAuthProvider } from './lib/providers/credentials.ts'
export type { LoginOptions, OAuthLoginOptions } from './lib/login.ts'
export type { CallbackOptions } from './lib/callback.ts'
