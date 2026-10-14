import { decodeBase64Url, encodeBase64Url } from '../base64url.ts'
import type {
  PasskeyAuthenticationResponseJSON,
  PasskeyCreationOptionsJSON,
  PasskeyCredentialDescriptorJSON,
  PasskeyRegistrationResponseJSON,
  PasskeyRequestOptionsJSON,
} from './json.ts'

/**
 * Reason a browser passkey ceremony did not produce a credential.
 */
export type PasskeyBrowserErrorCode =
  | 'unsupported'
  | 'cancelled'
  | 'aborted'
  | 'excluded_credential'
  | 'security_error'
  | 'invalid_options'
  | 'unknown_error'

/**
 * Details for a browser passkey ceremony that did not produce a credential.
 */
export interface PasskeyBrowserError {
  /** Machine-readable reason the ceremony stopped. */
  code: PasskeyBrowserErrorCode
  /** Human-readable explanation that apps can show or replace with their own copy. */
  message: string
  /** Original error thrown by the browser, when there was one. */
  cause?: unknown
}

/**
 * Result returned when a browser passkey ceremony did not produce a credential.
 */
export interface PasskeyBrowserFailure {
  /** Indicates that the ceremony did not produce a credential. */
  ok: false
  /** Details explaining why the ceremony stopped. */
  error: PasskeyBrowserError
}

/**
 * Result returned when the browser creates a passkey.
 */
export interface CreatePasskeySuccess {
  /** Indicates that the browser created a passkey. */
  ok: true
  /** Registration response to send to `finishPasskeyRegistration()`. */
  response: PasskeyRegistrationResponseJSON
}

/**
 * Result returned when the browser signs a passkey challenge.
 */
export interface GetPasskeySuccess {
  /** Indicates that the browser signed the challenge with a passkey. */
  ok: true
  /** Authentication response to send to `finishPasskeyAuthentication()`. */
  response: PasskeyAuthenticationResponseJSON
}

/**
 * Result of `createPasskey()`.
 */
export type CreatePasskeyResult = CreatePasskeySuccess | PasskeyBrowserFailure

/**
 * Result of `getPasskey()`.
 */
export type GetPasskeyResult = GetPasskeySuccess | PasskeyBrowserFailure

/**
 * Options for `createPasskey()`.
 */
export interface CreatePasskeyOptions {
  /** Signal used to abort the browser prompt. */
  signal?: AbortSignal
}

/**
 * Options for `getPasskey()`.
 */
export interface GetPasskeyOptions {
  /**
   * Offer passkeys in the browser's autofill menu instead of opening a prompt. Requires an input
   * with `autocomplete="username webauthn"` on the page. Abort the request before starting another
   * passkey ceremony. Browsers keep autofill requests open indefinitely, so restart the request
   * with fresh options before the server challenge expires after `options.timeout` milliseconds.
   */
  autofill?: boolean
  /** Signal used to abort the browser prompt or autofill request. */
  signal?: AbortSignal
}

/**
 * Checks whether the current browser exposes the WebAuthn APIs passkeys need.
 *
 * @returns `true` when passkey ceremonies can be attempted.
 */
export function isPasskeySupported(): boolean {
  return (
    typeof PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  )
}

/**
 * Checks whether the current browser can offer passkeys in form autofill.
 *
 * @returns `true` when `getPasskey(options, { autofill: true })` is available.
 */
export async function isPasskeyAutofillSupported(): Promise<boolean> {
  if (
    !isPasskeySupported() ||
    typeof PublicKeyCredential.isConditionalMediationAvailable !== 'function'
  ) {
    return false
  }

  try {
    return await PublicKeyCredential.isConditionalMediationAvailable()
  } catch {
    return false
  }
}

/**
 * Asks the browser to create a passkey from options returned by `startPasskeyRegistration()`.
 *
 * @param options Creation options returned by `startPasskeyRegistration()`.
 * @param init Optional abort signal.
 * @returns The registration response to send to the server, or a failure the app can render.
 */
export async function createPasskey(
  options: PasskeyCreationOptionsJSON,
  init: CreatePasskeyOptions = {},
): Promise<CreatePasskeyResult> {
  if (!isPasskeySupported()) {
    return unsupported('This browser does not support passkeys.')
  }

  let publicKey: PublicKeyCredentialCreationOptions
  try {
    publicKey = {
      challenge: decode(options.challenge),
      rp: options.rp,
      user: { ...options.user, id: decode(options.user.id) },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      excludeCredentials: options.excludeCredentials.map(toCredentialDescriptor),
      authenticatorSelection: options.authenticatorSelection,
      attestation: options.attestation,
    }
  } catch (error) {
    return failure('invalid_options', 'The passkey registration options are invalid.', error)
  }

  let credential: Credential | null
  try {
    credential = await navigator.credentials.create({ publicKey, signal: init.signal })
  } catch (error) {
    return toBrowserFailure(error, 'create', init.signal)
  }

  if (credential == null) {
    return failure('unknown_error', 'The browser did not create a passkey.')
  }

  let publicKeyCredential = credential as PublicKeyCredential
  let response = publicKeyCredential.response as AuthenticatorAttestationResponse
  let rawId = encodeBase64Url(new Uint8Array(publicKeyCredential.rawId))

  return {
    ok: true,
    response: {
      id: rawId,
      rawId,
      type: 'public-key',
      authenticatorAttachment: publicKeyCredential.authenticatorAttachment ?? null,
      response: {
        clientDataJSON: encodeBase64Url(new Uint8Array(response.clientDataJSON)),
        attestationObject: encodeBase64Url(new Uint8Array(response.attestationObject)),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
    },
  }
}

/**
 * Asks the browser to sign in with a passkey using options returned by
 * `startPasskeyAuthentication()`.
 *
 * @param options Request options returned by `startPasskeyAuthentication()`.
 * @param init Optional autofill mode and abort signal.
 * @returns The authentication response to send to the server, or a failure the app can render.
 */
export async function getPasskey(
  options: PasskeyRequestOptionsJSON,
  init: GetPasskeyOptions = {},
): Promise<GetPasskeyResult> {
  if (!isPasskeySupported()) {
    return unsupported('This browser does not support passkeys.')
  }

  if (init.autofill && !(await isPasskeyAutofillSupported())) {
    return unsupported('This browser does not support passkey autofill.')
  }

  let publicKey: PublicKeyCredentialRequestOptions
  try {
    publicKey = {
      challenge: decode(options.challenge),
      rpId: options.rpId,
      timeout: options.timeout,
      userVerification: options.userVerification,
      allowCredentials: options.allowCredentials.map(toCredentialDescriptor),
    }
  } catch (error) {
    return failure('invalid_options', 'The passkey sign-in options are invalid.', error)
  }

  let credential: Credential | null
  try {
    credential = await navigator.credentials.get({
      publicKey,
      mediation: init.autofill ? 'conditional' : undefined,
      signal: init.signal,
    })
  } catch (error) {
    return toBrowserFailure(error, 'get', init.signal)
  }

  if (credential == null) {
    return failure('unknown_error', 'The browser did not return a passkey.')
  }

  let publicKeyCredential = credential as PublicKeyCredential
  let response = publicKeyCredential.response as AuthenticatorAssertionResponse
  let rawId = encodeBase64Url(new Uint8Array(publicKeyCredential.rawId))

  return {
    ok: true,
    response: {
      id: rawId,
      rawId,
      type: 'public-key',
      authenticatorAttachment: publicKeyCredential.authenticatorAttachment ?? null,
      response: {
        clientDataJSON: encodeBase64Url(new Uint8Array(response.clientDataJSON)),
        authenticatorData: encodeBase64Url(new Uint8Array(response.authenticatorData)),
        signature: encodeBase64Url(new Uint8Array(response.signature)),
        userHandle:
          response.userHandle == null ? null : encodeBase64Url(new Uint8Array(response.userHandle)),
      },
    },
  }
}

function toCredentialDescriptor(
  descriptor: PasskeyCredentialDescriptorJSON,
): PublicKeyCredentialDescriptor {
  return {
    id: decode(descriptor.id),
    type: descriptor.type,
    transports: descriptor.transports as AuthenticatorTransport[] | undefined,
  }
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  let bytes = decodeBase64Url(value)
  if (bytes == null) {
    throw new TypeError(`Invalid base64url value "${value}".`)
  }

  return bytes
}

function toBrowserFailure(
  error: unknown,
  ceremony: 'create' | 'get',
  signal: AbortSignal | undefined,
): PasskeyBrowserFailure {
  // Browsers reject aborted requests with `signal.reason`, which can be any value.
  if (signal?.aborted) {
    return failure('aborted', 'The passkey request was aborted.', error)
  }

  let name = typeof error === 'object' && error != null && 'name' in error ? error.name : undefined

  switch (name) {
    case 'NotAllowedError':
      return failure('cancelled', 'The passkey request was cancelled or timed out.', error)
    case 'AbortError':
      return failure('aborted', 'The passkey request was aborted.', error)
    case 'InvalidStateError':
      if (ceremony === 'create') {
        return failure(
          'excluded_credential',
          'This authenticator already has a passkey for this account.',
          error,
        )
      }
      break
    case 'SecurityError':
      return failure(
        'security_error',
        'The browser blocked the passkey request for this site.',
        error,
      )
    case 'NotSupportedError':
      return failure(
        'unsupported',
        'This authenticator does not support the passkey request.',
        error,
      )
  }

  return failure('unknown_error', 'The passkey request failed.', error)
}

function unsupported(message: string): PasskeyBrowserFailure {
  return failure('unsupported', message)
}

function failure(
  code: PasskeyBrowserErrorCode,
  message: string,
  cause?: unknown,
): PasskeyBrowserFailure {
  let error: PasskeyBrowserError = { code, message }
  if (cause !== undefined) {
    error.cause = cause
  }

  return { ok: false, error }
}
