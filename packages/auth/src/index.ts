export { createExternalAuthCallbackRequestHandler } from './lib/external-callback.ts'
export { createCredentialsAuthLoginRequestHandler } from './lib/credentials-login.ts'
export { createCredentialsAuthProvider } from './lib/providers/credentials.ts'
export { createExternalAuthLoginRequestHandler } from './lib/external-login.ts'
export { createAuth0AuthProvider } from './lib/providers/auth0.ts'
export { createFacebookAuthProvider } from './lib/providers/facebook.ts'
export { createGitHubAuthProvider } from './lib/providers/github.ts'
export { createGoogleAuthProvider } from './lib/providers/google.ts'
export { createMicrosoftAuthProvider } from './lib/providers/microsoft.ts'
export { createOIDCAuthProvider } from './lib/providers/oidc.ts'
export { createOktaAuthProvider } from './lib/providers/okta.ts'
export { createXAuthProvider } from './lib/providers/x.ts'

export type { CredentialsAuthProviderOptions } from './lib/providers/credentials.ts'
export type { Auth0AuthProviderOptions, Auth0AuthProfile } from './lib/providers/auth0.ts'
export type {
  FacebookAuthProviderOptions,
  FacebookAuthProviderPicture,
  FacebookAuthProfile,
} from './lib/providers/facebook.ts'
export type {
  GitHubAuthProviderEmail,
  GitHubAuthProviderOptions,
  GitHubAuthProfile,
} from './lib/providers/github.ts'
export type { GoogleAuthProviderOptions, GoogleAuthProfile } from './lib/providers/google.ts'
export type {
  MicrosoftAuthProviderOptions,
  MicrosoftAuthProfile,
} from './lib/providers/microsoft.ts'
export type {
  OIDCAuthProviderMetadata,
  OIDCAuthProviderOptions,
  OIDCAuthProfile,
} from './lib/providers/oidc.ts'
export type { OktaAuthProviderOptions, OktaAuthProfile } from './lib/providers/okta.ts'
export type { XAuthProviderOptions, XAuthProfile } from './lib/providers/x.ts'

export type { OAuthAccount, OAuthProvider, OAuthResult, OAuthTokens } from './lib/provider.ts'
export type { CredentialsAuthProvider } from './lib/providers/credentials.ts'
export type { CredentialsAuthLoginOptions } from './lib/credentials-login.ts'
export type { ExternalAuthLoginOptions } from './lib/external-login.ts'
export type { ExternalAuthCallbackOptions } from './lib/external-callback.ts'
