export { completeAuth } from './lib/complete-auth.ts'
export { createOAuthProvider } from './lib/provider.ts'
export { createCredentialsAuthProvider } from './lib/providers/credentials.ts'
export { createEmailOTPAuthProvider } from './lib/providers/email-otp.ts'
export { createMagicLinkAuthProvider } from './lib/providers/magic-link.ts'
export { createAuth0AuthProvider } from './lib/providers/auth0.ts'
export { createFacebookAuthProvider } from './lib/providers/facebook.ts'
export { finishExternalAuth } from './lib/finish-external-auth.ts'
export { refreshExternalAuth } from './lib/refresh-external-auth.ts'
export { createGitHubAuthProvider } from './lib/providers/github.ts'
export { createGoogleAuthProvider } from './lib/providers/google.ts'
export { createMicrosoftAuthProvider } from './lib/providers/microsoft.ts'
export { createOIDCAuthProvider } from './lib/providers/oidc.ts'
export { createOktaAuthProvider } from './lib/providers/okta.ts'
export { sendEmailOTP } from './lib/send-email-otp.ts'
export { sendMagicLink } from './lib/send-magic-link.ts'
export { startExternalAuth } from './lib/start-external-auth.ts'
export { verifyCredentials } from './lib/verify-credentials.ts'
export { verifyEmailOTP } from './lib/verify-email-otp.ts'
export { verifyMagicLink } from './lib/verify-magic-link.ts'
export { createXAuthProvider } from './lib/providers/x.ts'

export type { CredentialsAuthProviderOptions } from './lib/providers/credentials.ts'
export type { EmailOTPAuthProviderOptions, EmailOTPMessage } from './lib/providers/email-otp.ts'
export type { MagicLinkAuthProviderOptions, MagicLinkMessage } from './lib/providers/magic-link.ts'
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

export type { CredentialsAuthProvider } from './lib/providers/credentials.ts'
export type { EmailOTPAuthProvider } from './lib/providers/email-otp.ts'
export type { MagicLinkAuthProvider } from './lib/providers/magic-link.ts'
export type {
  EmailAuthAttempt,
  EmailAuthSendFailure,
  EmailAuthSendResult,
  EmailAuthSendSuccess,
  EmailAuthStorage,
} from './lib/email-auth.ts'
export type { SendEmailOTPOptions } from './lib/send-email-otp.ts'
export type { SendMagicLinkOptions } from './lib/send-magic-link.ts'
export type {
  EmailOTPVerifyFailure,
  EmailOTPVerifyResult,
  EmailOTPVerifySuccess,
  VerifyEmailOTPOptions,
} from './lib/verify-email-otp.ts'
export type {
  MagicLinkVerifyFailure,
  MagicLinkVerifyResult,
  MagicLinkVerifySuccess,
  VerifyMagicLinkOptions,
} from './lib/verify-magic-link.ts'
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
