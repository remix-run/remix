export { completeAuth } from './lib/complete-auth.ts'
export { createOAuthProvider } from './lib/provider.ts'
export { createCredentialsAuthProvider } from './lib/providers/credentials.ts'
export { createPasskeyAuthProvider } from './lib/providers/passkey.ts'
export { createMemoryPasskeyChallengeStore } from './lib/memory-passkey-challenge-store.ts'
export { createAuth0AuthProvider } from './lib/providers/auth0.ts'
export { createFacebookAuthProvider } from './lib/providers/facebook.ts'
export { finishExternalAuth } from './lib/finish-external-auth.ts'
export { finishPasskeyAuthentication } from './lib/finish-passkey-authentication.ts'
export { finishPasskeyRegistration } from './lib/finish-passkey-registration.ts'
export { refreshExternalAuth } from './lib/refresh-external-auth.ts'
export { createGitHubAuthProvider } from './lib/providers/github.ts'
export { createGoogleAuthProvider } from './lib/providers/google.ts'
export { createMicrosoftAuthProvider } from './lib/providers/microsoft.ts'
export { createOIDCAuthProvider } from './lib/providers/oidc.ts'
export { createOktaAuthProvider } from './lib/providers/okta.ts'
export { startExternalAuth } from './lib/start-external-auth.ts'
export { startPasskeyAuthentication } from './lib/start-passkey-authentication.ts'
export { startPasskeyRegistration } from './lib/start-passkey-registration.ts'
export { verifyCredentials } from './lib/verify-credentials.ts'
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
export type {
  FindPasskeyCredential,
  PasskeyAuthProvider,
  PasskeyAuthProviderOptions,
  PasskeyChallengeStore,
  PasskeyCredential,
  PasskeyCredentialDescriptor,
} from './lib/providers/passkey.ts'
export type { XAuthProviderOptions, XAuthProfile } from './lib/providers/x.ts'

export type { CredentialsAuthProvider } from './lib/providers/credentials.ts'
export type {
  FinishedExternalAuthResult,
  FinishExternalAuthOptions,
} from './lib/finish-external-auth.ts'
export type { RefreshedExternalAuthResult } from './lib/refresh-external-auth.ts'
export type {
  OAuthAccount,
  OAuthProvider,
  OAuthProviderRuntime,
  OAuthResult,
  OAuthTokens,
  OAuthTransaction,
} from './lib/provider.ts'
export type { StartExternalAuthOptions } from './lib/start-external-auth.ts'
export type {
  FinishPasskeyAuthenticationOptions,
  PasskeyAuthenticationResult,
  PasskeyAuthenticationSuccess,
} from './lib/finish-passkey-authentication.ts'
export type {
  FinishPasskeyRegistrationOptions,
  PasskeyRegistrationResult,
  PasskeyRegistrationSuccess,
} from './lib/finish-passkey-registration.ts'
export type { StartPasskeyAuthenticationOptions } from './lib/start-passkey-authentication.ts'
export type {
  PasskeyUser,
  StartPasskeyRegistrationOptions,
} from './lib/start-passkey-registration.ts'
export type { PasskeyError, PasskeyErrorCode, PasskeyFailure } from './lib/passkey/errors.ts'
export type {
  PasskeyAssertionResponseJSON,
  PasskeyAttestationResponseJSON,
  PasskeyAuthenticationResponseJSON,
  PasskeyAuthenticatorSelectionJSON,
  PasskeyCreationOptionsJSON,
  PasskeyCredentialDescriptorJSON,
  PasskeyCredentialParametersJSON,
  PasskeyRegistrationResponseJSON,
  PasskeyRelyingPartyJSON,
  PasskeyRequestOptionsJSON,
  PasskeyUserJSON,
  PasskeyUserVerification,
} from './lib/passkey/json.ts'
