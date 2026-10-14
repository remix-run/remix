import type { RequestContext } from '@remix-run/fetch-router'

import { encodeBase64Url } from './base64url.ts'
import {
  consumePasskeyChallenge,
  defaultChallengeKey,
  takePendingPasskeyChallenge,
} from './passkey/challenge.ts'
import { importCosePublicKey } from './passkey/cose.ts'
import { invalidResponse, PasskeyVerificationError, toPasskeyFailure } from './passkey/errors.ts'
import type { PasskeyFailure } from './passkey/errors.ts'
import {
  bytesEqual,
  parseAttestationObject,
  parseAuthenticatorData,
  parseClientData,
  parseRegistrationResponse,
  verifyAuthenticatorData,
  verifyOrigin,
} from './passkey/webauthn.ts'
import type { PasskeyAuthProvider, PasskeyCredential } from './providers/passkey.ts'
import { getSession } from './utils.ts'

/**
 * Options for finishing passkey registration.
 */
export interface FinishPasskeyRegistrationOptions {
  /**
   * Registration response from `createPasskey()` or `PublicKeyCredential.toJSON()`. Accepts the
   * parsed object or its JSON string, such as a value submitted in a form field.
   */
  response: unknown
  /** Account the passkey is being added to. Rejects challenges started for another account. */
  userId: string
  /** Session key used to read and clear the pending challenge. (default: `'__passkey'`) */
  challengeKey?: string
}

/**
 * Result returned when a passkey registration is verified.
 */
export interface PasskeyRegistrationSuccess {
  /** Indicates that verification succeeded. */
  ok: true
  /** New credential to persist for `credential.userId`. */
  credential: PasskeyCredential
}

/**
 * Result of finishing passkey registration.
 */
export type PasskeyRegistrationResult = PasskeyRegistrationSuccess | PasskeyFailure

/**
 * Verifies a passkey registration response against the pending session challenge.
 *
 * The challenge the response was signed for is cleared from the session and consumed from the
 * challenge store, so each challenge can be verified only once. Persist the returned credential for
 * `credential.userId`.
 *
 * @param provider The passkey provider that started registration.
 * @param context The current request context.
 * @param options The browser response and the account the passkey is being added to.
 * @returns The verified credential, or a failure describing why the response was rejected.
 */
export async function finishPasskeyRegistration<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: PasskeyAuthProvider,
  context: context,
  options: FinishPasskeyRegistrationOptions,
): Promise<PasskeyRegistrationResult> {
  let session = getSession(context, 'finishPasskeyRegistration()')

  try {
    let response = parseRegistrationResponse(options.response)
    let clientData = parseClientData(response.clientDataJSON)
    let pending = takePendingPasskeyChallenge(
      provider,
      session,
      options.challengeKey ?? defaultChallengeKey,
      'registration',
      clientData.challenge,
    )

    await consumePasskeyChallenge(provider, context, pending.challenge)

    if (clientData.type !== 'webauthn.create') {
      throw invalidResponse('Client data is not from a registration ceremony.')
    }

    let userId = pending.userId
    if (userId == null || userId !== options.userId) {
      throw new PasskeyVerificationError(
        'user_mismatch',
        'The passkey registration was started for a different account.',
      )
    }

    verifyOrigin(clientData, provider.origins)

    let authenticatorData = parseAuthenticatorData(
      parseAttestationObject(response.attestationObject),
    )
    await verifyAuthenticatorData(authenticatorData, provider)

    let attestedCredential = authenticatorData.attestedCredential
    if (attestedCredential == null) {
      throw invalidResponse('Registration authenticator data does not include a credential.')
    }

    if (!bytesEqual(attestedCredential.credentialId, response.rawCredentialId)) {
      throw invalidResponse('Registration credential ID does not match the authenticator data.')
    }

    await importCosePublicKey(attestedCredential.publicKey)

    if ((await provider.findCredential(response.credentialId, context)) != null) {
      throw new PasskeyVerificationError('credential_exists', 'This passkey is already registered.')
    }

    let credential: PasskeyCredential = {
      id: response.credentialId,
      userId,
      publicKey: encodeBase64Url(attestedCredential.publicKey),
      counter: authenticatorData.signCount,
      transports: response.transports,
      backupEligible: authenticatorData.flags.backupEligible,
      backedUp: authenticatorData.flags.backedUp,
      aaguid: attestedCredential.aaguid,
    }

    return { ok: true, credential }
  } catch (error) {
    return toPasskeyFailure(error)
  }
}
