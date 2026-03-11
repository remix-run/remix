export { callback } from './lib/callback.ts'
export { credentials } from './lib/credentials.ts'
export { login } from './lib/login.ts'
export { facebook } from './lib/providers/facebook.ts'
export { github } from './lib/providers/github.ts'
export { google } from './lib/providers/google.ts'

export type { CredentialsOptions } from './lib/credentials.ts'
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

export type {
  AuthSessionRecord,
  CallbackOptions,
  CredentialsProvider,
  LoginOptions,
  OAuthAccount,
  OAuthLoginOptions,
  OAuthProvider,
  OAuthResult,
  OAuthTokens,
} from './lib/types.ts'
