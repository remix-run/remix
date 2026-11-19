import type { RequestContext } from '@remix-run/fetch-router'

import { toBase64Url } from './base64url.ts'
import type {
  WebAuthnCredential,
  WebAuthnProvider,
  WebAuthnRegistrationOptionsJSON,
} from './providers/webauthn.ts'
import { createRandomToken, getSession, sanitizeReturnTo } from './utils.ts'
import {
  defaultWebAuthnTransactionKey,
  getBytes,
  importCOSEPublicKey,
  parseCredentialResponse,
  readAttestationAuthenticatorData,
  takeWebAuthnTransaction,
  verifyAuthenticatorData,
  verifyClientData,
} from './webauthn-protocol.ts'
import type { WebAuthnTransaction } from './webauthn-protocol.ts'

/**
 * Options for starting a WebAuthn registration ceremony.
 */
export interface StartWebAuthnRegistrationOptions {
  /**
   * The user the new credential belongs to. `id` is stored on the authenticator and returned on
   * every login, so use an opaque app user id (at most 64 bytes), never an email address.
   */
  user: { id: string; name: string; displayName?: string }
  /** Credentials the user already registered, so the authenticator does not create a duplicate. */
  excludeCredentials?: Array<Pick<WebAuthnCredential, 'id' | 'transports'>>
  /** Optional local path to normalize and preserve as the post-registration redirect target. */
  returnTo?: string | null
  /** Session key used to store the in-progress ceremony. Defaults to `"__webauthn"`. */
  transactionKey?: string
}

/**
 * Options for finishing a WebAuthn registration ceremony.
 */
export interface FinishWebAuthnRegistrationOptions {
  /** Session key used to read and clear the in-progress ceremony. Defaults to `"__webauthn"`. */
  transactionKey?: string
}

/**
 * Result returned from a successful WebAuthn registration ceremony.
 */
export interface FinishedWebAuthnRegistrationResult {
  /** The new credential. Persist it so the user can log in with it later. */
  credential: WebAuthnCredential
  /** Whether the authenticator verified the user during registration. */
  userVerified: boolean
  /** Normalized local post-registration redirect path, when one was provided. */
  returnTo?: string
}

/**
 * Starts a WebAuthn registration ceremony and stores its challenge in the session.
 *
 * @param provider The WebAuthn provider.
 * @param context The current request context with session middleware installed.
 * @param options The user to register a credential for, plus optional exclusions and return target.
 * @returns JSON options to pass to `navigator.credentials.create()` in the browser.
 */
export function startWebAuthnRegistration<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: WebAuthnProvider,
  context: context,
  options: StartWebAuthnRegistrationOptions,
): WebAuthnRegistrationOptionsJSON {
  let session = getSession(context, 'startWebAuthnRegistration()')
  let userHandle = new TextEncoder().encode(options.user.id)
  if (userHandle.length === 0 || userHandle.length > 64) {
    throw new Error('WebAuthn user id must be between 1 and 64 bytes.')
  }

  let transaction: WebAuthnTransaction = {
    provider: provider.name,
    ceremony: 'registration',
    challenge: createRandomToken(32),
    expiresAt: Date.now() + provider.timeout,
    userId: options.user.id,
    returnTo: sanitizeReturnTo(options.returnTo ?? null),
  }
  session.set(options.transactionKey ?? defaultWebAuthnTransactionKey, transaction)

  return {
    rp: { id: provider.rpId, name: provider.rpName },
    user: {
      id: toBase64Url(userHandle),
      name: options.user.name,
      displayName: options.user.displayName ?? options.user.name,
    },
    challenge: transaction.challenge,
    pubKeyCredParams: provider.algorithms.map((alg) => ({ type: 'public-key', alg })),
    timeout: provider.timeout,
    excludeCredentials: (options.excludeCredentials ?? []).map((credential) => ({
      type: 'public-key',
      id: credential.id,
      transports: credential.transports,
    })),
    authenticatorSelection: {
      residentKey: provider.residentKey,
      requireResidentKey: provider.residentKey === 'required',
      userVerification: provider.userVerification,
    },
    attestation: 'none',
  }
}

/**
 * Finishes a WebAuthn registration ceremony by verifying the browser's response against the
 * challenge stored in the session. The stored ceremony is cleared whether verification succeeds or
 * fails.
 *
 * @param provider The WebAuthn provider that started the ceremony.
 * @param context The current request context with session middleware installed.
 * @param response The untrusted registration response from the browser, usually
 * `PublicKeyCredential.toJSON()` parsed from the request body.
 * @param options Transaction lookup settings.
 * @returns The verified credential to persist, plus the preserved `returnTo` target.
 */
export async function finishWebAuthnRegistration<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: WebAuthnProvider,
  context: context,
  response: unknown,
  options: FinishWebAuthnRegistrationOptions = {},
): Promise<FinishedWebAuthnRegistrationResult> {
  let session = getSession(context, 'finishWebAuthnRegistration()')
  let transaction = takeWebAuthnTransaction(
    session,
    options.transactionKey ?? defaultWebAuthnTransactionKey,
    provider,
    'registration',
  )

  let credential = parseCredentialResponse(response)
  verifyClientData(
    provider,
    getBytes(credential.response, 'clientDataJSON'),
    'webauthn.create',
    transaction.challenge,
  )

  let authenticatorData = await verifyAuthenticatorData(
    provider,
    readAttestationAuthenticatorData(getBytes(credential.response, 'attestationObject')),
  )
  let attested = authenticatorData.attestedCredential
  if (attested == null) {
    throw new Error('WebAuthn registration is missing attested credential data.')
  }
  if (toBase64Url(attested.credentialId) !== credential.id) {
    throw new Error('WebAuthn credential id does not match the authenticator data.')
  }

  let { algorithm } = await importCOSEPublicKey(attested.publicKey)
  if (!provider.algorithms.includes(algorithm)) {
    throw new Error(`WebAuthn credential algorithm "${algorithm}" was not requested.`)
  }

  let transports = credential.response.transports
  return {
    credential: {
      id: credential.id,
      userId: transaction.userId!,
      publicKey: toBase64Url(attested.publicKey),
      algorithm,
      signCount: authenticatorData.signCount,
      transports:
        Array.isArray(transports) && transports.every((value) => typeof value === 'string')
          ? transports
          : undefined,
      backupEligible: authenticatorData.backupEligible,
      backedUp: authenticatorData.backedUp,
      aaguid: attested.aaguid,
    },
    userVerified: authenticatorData.userVerified,
    returnTo: transaction.returnTo,
  }
}
