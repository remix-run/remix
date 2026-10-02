/**
 * User verification policy for passkey ceremonies.
 */
export type PasskeyUserVerification = 'required' | 'preferred' | 'discouraged'

/**
 * JSON form of a WebAuthn credential descriptor.
 */
export interface PasskeyCredentialDescriptorJSON {
  /** Base64url credential ID. */
  id: string
  /** Credential type. Always `public-key`. */
  type: 'public-key'
  /** Transport hints reported by the authenticator when the credential was registered. */
  transports?: string[]
}

/**
 * JSON form of the relying party entity sent during registration.
 */
export interface PasskeyRelyingPartyJSON {
  /** Relying party ID, usually the registrable domain of the application. */
  id: string
  /** Human-readable relying party name. */
  name: string
}

/**
 * JSON form of the user entity sent during registration.
 */
export interface PasskeyUserJSON {
  /** Base64url WebAuthn user handle. */
  id: string
  /** Account identifier shown in passkey pickers, such as an email address or username. */
  name: string
  /** Human-readable account name shown in passkey pickers. */
  displayName: string
}

/**
 * JSON form of a credential algorithm offered during registration.
 */
export interface PasskeyCredentialParametersJSON {
  /** Credential type. Always `public-key`. */
  type: 'public-key'
  /** COSE algorithm identifier. */
  alg: number
}

/**
 * JSON form of the authenticator requirements sent during registration.
 */
export interface PasskeyAuthenticatorSelectionJSON {
  /** Discoverable credential requirement. Passkeys are always discoverable. */
  residentKey: 'required'
  /** Legacy discoverable credential flag kept in sync with `residentKey`. */
  requireResidentKey: true
  /** User verification policy for the ceremony. */
  userVerification: PasskeyUserVerification
}

/**
 * JSON-serializable `PublicKeyCredentialCreationOptions` returned by `startPasskeyRegistration()`.
 */
export interface PasskeyCreationOptionsJSON {
  /** Base64url challenge the authenticator must sign. */
  challenge: string
  /** Relying party the credential is scoped to. */
  rp: PasskeyRelyingPartyJSON
  /** Account the credential is created for. */
  user: PasskeyUserJSON
  /** Credential algorithms the server accepts, in order of preference. */
  pubKeyCredParams: PasskeyCredentialParametersJSON[]
  /** Ceremony timeout in milliseconds. */
  timeout: number
  /** Existing credentials for the account that should not be registered again. */
  excludeCredentials: PasskeyCredentialDescriptorJSON[]
  /** Authenticator requirements for the new credential. */
  authenticatorSelection: PasskeyAuthenticatorSelectionJSON
  /** Attestation conveyance preference. Always `none`. */
  attestation: 'none'
}

/**
 * JSON-serializable `PublicKeyCredentialRequestOptions` returned by `startPasskeyAuthentication()`.
 */
export interface PasskeyRequestOptionsJSON {
  /** Base64url challenge the authenticator must sign. */
  challenge: string
  /** Relying party ID the credential must be scoped to. */
  rpId: string
  /** Ceremony timeout in milliseconds. */
  timeout: number
  /** User verification policy for the ceremony. */
  userVerification: PasskeyUserVerification
  /** Credentials the user may sign in with. Empty when any discoverable credential is allowed. */
  allowCredentials: PasskeyCredentialDescriptorJSON[]
}

/**
 * JSON form of the authenticator response produced while registering a passkey.
 */
export interface PasskeyAttestationResponseJSON {
  /** Base64url client data JSON. */
  clientDataJSON: string
  /** Base64url CBOR attestation object. */
  attestationObject: string
  /** Transport hints reported by the authenticator. */
  transports?: string[]
}

/**
 * JSON form of the authenticator response produced while signing in with a passkey.
 */
export interface PasskeyAssertionResponseJSON {
  /** Base64url client data JSON. */
  clientDataJSON: string
  /** Base64url authenticator data. */
  authenticatorData: string
  /** Base64url assertion signature. */
  signature: string
  /** Base64url user handle stored with a discoverable credential, when returned. */
  userHandle?: string | null
}

/**
 * JSON-serializable credential produced by the browser while registering a passkey.
 */
export interface PasskeyRegistrationResponseJSON {
  /** Base64url credential ID. */
  id: string
  /** Base64url credential ID. Must match `id`. */
  rawId: string
  /** Credential type. Always `public-key`. */
  type: 'public-key'
  /** Authenticator attachment reported by the browser, when available. */
  authenticatorAttachment?: string | null
  /** Authenticator attestation response. */
  response: PasskeyAttestationResponseJSON
}

/**
 * JSON-serializable credential produced by the browser while signing in with a passkey.
 */
export interface PasskeyAuthenticationResponseJSON {
  /** Base64url credential ID. */
  id: string
  /** Base64url credential ID. Must match `id`. */
  rawId: string
  /** Credential type. Always `public-key`. */
  type: 'public-key'
  /** Authenticator attachment reported by the browser, when available. */
  authenticatorAttachment?: string | null
  /** Authenticator assertion response. */
  response: PasskeyAssertionResponseJSON
}
