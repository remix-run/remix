export {
  createPasskey,
  getPasskey,
  isPasskeyAutofillSupported,
  isPasskeySupported,
} from './lib/passkey/browser.ts'

export type {
  CreatePasskeyOptions,
  CreatePasskeyResult,
  CreatePasskeySuccess,
  GetPasskeyOptions,
  GetPasskeyResult,
  GetPasskeySuccess,
  PasskeyBrowserError,
  PasskeyBrowserErrorCode,
  PasskeyBrowserFailure,
} from './lib/passkey/browser.ts'
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
