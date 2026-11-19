import { fromBase64Url, toBase64Url } from './base64url.ts'
import type {
  WebAuthnAuthenticationOptionsJSON,
  WebAuthnAuthenticationResponseJSON,
  WebAuthnCredentialDescriptorJSON,
  WebAuthnRegistrationOptionsJSON,
  WebAuthnRegistrationResponseJSON,
} from './providers/webauthn.ts'

/**
 * Options for the browser WebAuthn helpers.
 */
export interface PasskeyRequestInit {
  /** Aborts the pending browser prompt. */
  signal?: AbortSignal
}

/**
 * Options for `getPasskey()`.
 */
export interface GetPasskeyInit extends PasskeyRequestInit {
  /**
   * Browser mediation mode. Use `"conditional"` to offer passkeys in the browser's autofill UI for
   * inputs marked `autocomplete="username webauthn"`.
   */
  mediation?: CredentialMediationRequirement
}

/**
 * Returns whether the current browser supports WebAuthn.
 *
 * @returns `true` when `PublicKeyCredential` and `navigator.credentials` are available.
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.credentials != null
  )
}

/**
 * Prompts the user to create a passkey from server-generated registration options.
 *
 * @param options Registration options returned by `startWebAuthnRegistration()`.
 * @param init Optional abort signal.
 * @returns The registration response to send to `finishWebAuthnRegistration()`.
 */
export async function createPasskey(
  options: WebAuthnRegistrationOptionsJSON,
  init: PasskeyRequestInit = {},
): Promise<WebAuthnRegistrationResponseJSON> {
  let credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: fromBase64Url(options.challenge),
      user: { ...options.user, id: fromBase64Url(options.user.id) },
      excludeCredentials: options.excludeCredentials.map(toCredentialDescriptor),
    },
    signal: init.signal,
  })) as PublicKeyCredential | null
  if (credential == null) {
    throw new Error('Passkey creation was cancelled.')
  }

  let response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: toBase64Url(new Uint8Array(credential.rawId)),
    type: 'public-key',
    response: {
      clientDataJSON: toBase64Url(new Uint8Array(response.clientDataJSON)),
      attestationObject: toBase64Url(new Uint8Array(response.attestationObject)),
      transports: response.getTransports?.(),
    },
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults() as Record<string, unknown>,
  }
}

/**
 * Prompts the user to sign in with a passkey from server-generated authentication options.
 *
 * @param options Authentication options returned by `startWebAuthnAuthentication()`.
 * @param init Optional abort signal and mediation mode.
 * @returns The authentication response to send to `finishWebAuthnAuthentication()`.
 */
export async function getPasskey(
  options: WebAuthnAuthenticationOptionsJSON,
  init: GetPasskeyInit = {},
): Promise<WebAuthnAuthenticationResponseJSON> {
  let credential = (await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromBase64Url(options.challenge),
      allowCredentials: options.allowCredentials.map(toCredentialDescriptor),
    },
    mediation: init.mediation,
    signal: init.signal,
  })) as PublicKeyCredential | null
  if (credential == null) {
    throw new Error('Passkey sign-in was cancelled.')
  }

  let response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: toBase64Url(new Uint8Array(credential.rawId)),
    type: 'public-key',
    response: {
      clientDataJSON: toBase64Url(new Uint8Array(response.clientDataJSON)),
      authenticatorData: toBase64Url(new Uint8Array(response.authenticatorData)),
      signature: toBase64Url(new Uint8Array(response.signature)),
      userHandle:
        response.userHandle == null ? null : toBase64Url(new Uint8Array(response.userHandle)),
    },
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults() as Record<string, unknown>,
  }
}

function toCredentialDescriptor(
  descriptor: WebAuthnCredentialDescriptorJSON,
): PublicKeyCredentialDescriptor {
  return {
    type: 'public-key',
    id: fromBase64Url(descriptor.id),
    transports: descriptor.transports as AuthenticatorTransport[] | undefined,
  }
}
