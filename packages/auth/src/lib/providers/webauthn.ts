/**
 * COSE algorithm identifiers supported for WebAuthn credential public keys.
 *
 * - `-8`: EdDSA (Ed25519)
 * - `-7`: ES256 (ECDSA with P-256 and SHA-256)
 * - `-257`: RS256 (RSASSA-PKCS1-v1_5 with SHA-256)
 */
export type WebAuthnAlgorithm = -8 | -7 | -257

/**
 * Whether the authenticator must verify the user (PIN, biometric, device passcode).
 */
export type WebAuthnUserVerification = 'required' | 'preferred' | 'discouraged'

/**
 * Whether the authenticator should store a discoverable credential (a passkey).
 */
export type WebAuthnResidentKey = 'required' | 'preferred' | 'discouraged'

/**
 * Options for building a WebAuthn (passkey) provider.
 */
export interface WebAuthnProviderOptions<provider extends string = 'webauthn'> {
  /** Provider name used for session metadata and diagnostics. Defaults to `"webauthn"`. */
  name?: provider
  /**
   * Relying party id, usually your registrable domain such as `"example.com"`. Every origin must
   * be this host or a subdomain of it.
   */
  rpId: string
  /** Human-readable relying party name shown by some authenticators. */
  rpName: string
  /** Origin or origins allowed to perform WebAuthn ceremonies, such as `"https://example.com"`. */
  origin: string | URL | Array<string | URL>
  /** User verification requirement. Defaults to `"preferred"`. */
  userVerification?: WebAuthnUserVerification
  /** Discoverable credential requirement for registration. Defaults to `"preferred"`. */
  residentKey?: WebAuthnResidentKey
  /** How long a started ceremony stays valid, in milliseconds. Defaults to 5 minutes. */
  timeout?: number
  /** Accepted credential algorithms in order of preference. Defaults to `[-8, -7, -257]`. */
  algorithms?: WebAuthnAlgorithm[]
}

/**
 * Configured WebAuthn provider passed to the WebAuthn registration and authentication helpers.
 */
export interface WebAuthnProvider<provider extends string = string> {
  /** Provider name used for session metadata and diagnostics. */
  name: provider
  /** Relying party id. */
  rpId: string
  /** Human-readable relying party name. */
  rpName: string
  /** Normalized allowed origins. */
  origins: string[]
  /** User verification requirement. */
  userVerification: WebAuthnUserVerification
  /** Discoverable credential requirement for registration. */
  residentKey: WebAuthnResidentKey
  /** Ceremony lifetime in milliseconds. */
  timeout: number
  /** Accepted credential algorithms in order of preference. */
  algorithms: WebAuthnAlgorithm[]
}

/**
 * A registered WebAuthn credential. Every field is JSON-serializable so apps can persist it as-is.
 */
export interface WebAuthnCredential {
  /** Base64url credential id. */
  id: string
  /** App user id the credential was registered for. */
  userId: string
  /** Base64url COSE-encoded credential public key. */
  publicKey: string
  /** COSE algorithm of the public key. */
  algorithm: WebAuthnAlgorithm
  /** Last signature counter reported by the authenticator. */
  signCount: number
  /** Transport hints reported by the browser, such as `"internal"` or `"hybrid"`. */
  transports?: string[]
  /** Whether the credential can be backed up or synced (a multi-device passkey). */
  backupEligible: boolean
  /** Whether the credential is currently backed up or synced. */
  backedUp: boolean
  /** Authenticator model identifier as a UUID string. All zeros when the authenticator withholds it. */
  aaguid: string
}

/**
 * Credential descriptor used in `excludeCredentials` and `allowCredentials` lists.
 */
export interface WebAuthnCredentialDescriptorJSON {
  /** Always `"public-key"`. */
  type: 'public-key'
  /** Base64url credential id. */
  id: string
  /** Transport hints for the credential. */
  transports?: string[]
}

/**
 * JSON-serializable registration options for `navigator.credentials.create()`. This matches the
 * WebAuthn Level 3 `PublicKeyCredentialCreationOptionsJSON` shape.
 */
export interface WebAuthnRegistrationOptionsJSON {
  /** Relying party id and name. */
  rp: { id: string; name: string }
  /** User handle (base64url) and display names. */
  user: { id: string; name: string; displayName: string }
  /** Base64url challenge. */
  challenge: string
  /** Accepted credential algorithms. */
  pubKeyCredParams: Array<{ type: 'public-key'; alg: WebAuthnAlgorithm }>
  /** Ceremony timeout in milliseconds. */
  timeout: number
  /** Credentials the user already registered, so the authenticator does not create a duplicate. */
  excludeCredentials: WebAuthnCredentialDescriptorJSON[]
  /** Authenticator requirements. */
  authenticatorSelection: {
    residentKey: WebAuthnResidentKey
    requireResidentKey: boolean
    userVerification: WebAuthnUserVerification
  }
  /** Always `"none"`; attestation statements are not verified. */
  attestation: 'none'
}

/**
 * JSON-serializable authentication options for `navigator.credentials.get()`. This matches the
 * WebAuthn Level 3 `PublicKeyCredentialRequestOptionsJSON` shape.
 */
export interface WebAuthnAuthenticationOptionsJSON {
  /** Base64url challenge. */
  challenge: string
  /** Ceremony timeout in milliseconds. */
  timeout: number
  /** Relying party id. */
  rpId: string
  /** Credentials allowed for this ceremony. Empty for discoverable credential (passkey) login. */
  allowCredentials: WebAuthnCredentialDescriptorJSON[]
  /** User verification requirement. */
  userVerification: WebAuthnUserVerification
}

/**
 * Registration response produced by `PublicKeyCredential.toJSON()` after
 * `navigator.credentials.create()`.
 */
export interface WebAuthnRegistrationResponseJSON {
  /** Base64url credential id. */
  id: string
  /** Base64url credential id. */
  rawId: string
  /** Always `"public-key"`. */
  type: 'public-key'
  /** Authenticator response fields. */
  response: {
    clientDataJSON: string
    attestationObject: string
    transports?: string[]
  }
  /** Platform or cross-platform authenticator attachment. */
  authenticatorAttachment?: string | null
  /** Client extension outputs. */
  clientExtensionResults?: Record<string, unknown>
}

/**
 * Authentication response produced by `PublicKeyCredential.toJSON()` after
 * `navigator.credentials.get()`.
 */
export interface WebAuthnAuthenticationResponseJSON {
  /** Base64url credential id. */
  id: string
  /** Base64url credential id. */
  rawId: string
  /** Always `"public-key"`. */
  type: 'public-key'
  /** Authenticator response fields. */
  response: {
    clientDataJSON: string
    authenticatorData: string
    signature: string
    userHandle?: string | null
  }
  /** Platform or cross-platform authenticator attachment. */
  authenticatorAttachment?: string | null
  /** Client extension outputs. */
  clientExtensionResults?: Record<string, unknown>
}

/**
 * Creates a WebAuthn (passkey) provider for the WebAuthn registration and authentication helpers.
 *
 * @param options Relying party, origin, and authenticator requirements.
 * @returns A provider that can be passed to `startWebAuthnRegistration()`,
 * `finishWebAuthnRegistration()`, `startWebAuthnAuthentication()`, and
 * `finishWebAuthnAuthentication()`.
 */
export function createWebAuthnProvider<provider extends string = 'webauthn'>(
  options: WebAuthnProviderOptions<provider>,
): WebAuthnProvider<provider> {
  let rpId = options.rpId.toLowerCase()
  if (rpId.length === 0 || rpId.includes('/') || rpId.includes(':')) {
    throw new Error(`Invalid WebAuthn rpId "${options.rpId}". Use a bare host like "example.com".`)
  }

  let origins = (Array.isArray(options.origin) ? options.origin : [options.origin]).map((value) => {
    let url = new URL(value)
    let isLocalhost = url.hostname === 'localhost' || url.hostname.endsWith('.localhost')
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
      throw new Error(`WebAuthn origin "${url.origin}" must use https (or http on localhost).`)
    }
    if (url.hostname !== rpId && !url.hostname.endsWith(`.${rpId}`)) {
      throw new Error(`WebAuthn origin "${url.origin}" is not within rpId "${rpId}".`)
    }

    return url.origin
  })
  if (origins.length === 0) {
    throw new Error('WebAuthn provider requires at least one origin.')
  }

  let algorithms = options.algorithms ?? [-8, -7, -257]
  if (algorithms.length === 0) {
    throw new Error('WebAuthn provider requires at least one algorithm.')
  }

  return {
    name: options.name ?? ('webauthn' as provider),
    rpId,
    rpName: options.rpName,
    origins,
    userVerification: options.userVerification ?? 'preferred',
    residentKey: options.residentKey ?? 'preferred',
    timeout: options.timeout ?? 5 * 60 * 1000,
    algorithms,
  }
}
