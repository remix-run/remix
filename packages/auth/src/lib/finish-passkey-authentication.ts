import type { RequestContext } from '@remix-run/fetch-router'

import { decodeBase64Url } from './base64url.ts'
import {
  consumePasskeyChallenge,
  defaultChallengeKey,
  takePendingPasskeyChallenge,
} from './passkey/challenge.ts'
import { importCosePublicKey, verifyCoseSignature } from './passkey/cose.ts'
import { invalidResponse, PasskeyVerificationError, toPasskeyFailure } from './passkey/errors.ts'
import type { PasskeyFailure } from './passkey/errors.ts'
import {
  concatBytes,
  decodeUserHandle,
  parseAuthenticationResponse,
  parseAuthenticatorData,
  parseClientData,
  verifyAuthenticatorData,
  verifyOrigin,
} from './passkey/webauthn.ts'
import type { PasskeyAuthProvider, PasskeyCredential } from './providers/passkey.ts'
import { getSession } from './utils.ts'

/**
 * Options for finishing passkey sign-in.
 */
export interface FinishPasskeyAuthenticationOptions {
  /**
   * Authentication response from `getPasskey()` or `PublicKeyCredential.toJSON()`. Accepts the
   * parsed object or its JSON string, such as a value submitted in a form field.
   */
  response: unknown
  /** Session key used to read and clear the pending challenge. (default: `'__passkey'`) */
  challengeKey?: string
}

/**
 * Result returned when a passkey sign-in is verified.
 */
export interface PasskeyAuthenticationSuccess {
  /** Indicates that verification succeeded. */
  ok: true
  /**
   * Credential that signed in, with its `counter` and `backedUp` state updated from this sign-in.
   * Persist those fields, then write `credential.userId` into the session with `completeAuth()`.
   */
  credential: PasskeyCredential
}

/**
 * Result of finishing passkey sign-in.
 */
export type PasskeyAuthenticationResult = PasskeyAuthenticationSuccess | PasskeyFailure

/**
 * Verifies a passkey authentication response against the pending session challenge.
 *
 * The challenge the response was signed for is cleared from the session and consumed from the
 * challenge store, so each challenge can be verified only once. On success, persist the updated
 * credential and call `completeAuth()` to rotate the session before writing auth data.
 *
 * @param provider The passkey provider that started sign-in.
 * @param context The current request context.
 * @param options The browser response to verify.
 * @returns The verified credential, or a failure describing why the response was rejected.
 */
export async function finishPasskeyAuthentication<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: PasskeyAuthProvider,
  context: context,
  options: FinishPasskeyAuthenticationOptions,
): Promise<PasskeyAuthenticationResult> {
  let session = getSession(context, 'finishPasskeyAuthentication()')

  try {
    let response = parseAuthenticationResponse(options.response)
    let clientData = parseClientData(response.clientDataJSON)
    let pending = takePendingPasskeyChallenge(
      provider,
      session,
      options.challengeKey ?? defaultChallengeKey,
      'authentication',
      clientData.challenge,
    )

    await consumePasskeyChallenge(provider, context, pending.challenge)

    if (clientData.type !== 'webauthn.get') {
      throw invalidResponse('Client data is not from an authentication ceremony.')
    }

    verifyOrigin(clientData, provider.origins)

    if (
      pending.allowCredentials != null &&
      !pending.allowCredentials.includes(response.credentialId)
    ) {
      throw new PasskeyVerificationError(
        'credential_not_allowed',
        'This passkey is not one of the passkeys allowed for this sign-in.',
      )
    }

    let credential = await provider.findCredential(response.credentialId, context)
    if (credential == null) {
      throw new PasskeyVerificationError(
        'credential_not_found',
        'This passkey is not registered or has been removed.',
      )
    }

    let authenticatorData = parseAuthenticatorData(response.authenticatorData)
    await verifyAuthenticatorData(authenticatorData, provider)

    let publicKeyBytes = decodeBase64Url(credential.publicKey)
    if (publicKeyBytes == null) {
      throw new Error(`Stored passkey "${credential.id}" has an invalid public key.`)
    }

    let publicKey = await importCosePublicKey(publicKeyBytes)
    let clientDataHash = new Uint8Array(
      await crypto.subtle.digest('SHA-256', response.clientDataJSON),
    )
    let verified = await verifyCoseSignature(
      publicKey,
      response.signature,
      concatBytes(response.authenticatorData, clientDataHash),
    )
    if (!verified) {
      throw new PasskeyVerificationError('invalid_signature', 'The passkey signature is invalid.')
    }

    // Ownership checks run only after the signature proves the response came from the credential,
    // so forged responses cannot probe which account owns a credential ID.
    if (pending.userId != null && credential.userId !== pending.userId) {
      throw new PasskeyVerificationError(
        'user_mismatch',
        'This passkey belongs to a different account.',
      )
    }

    if (
      response.userHandle != null &&
      decodeUserHandle(response.userHandle) !== credential.userId
    ) {
      throw new PasskeyVerificationError(
        'user_mismatch',
        'The passkey user handle does not match the credential owner.',
      )
    }

    if (authenticatorData.flags.backupEligible !== credential.backupEligible) {
      throw invalidResponse('The passkey backup eligibility changed since registration.')
    }

    let counter = authenticatorData.signCount
    if ((counter !== 0 || credential.counter !== 0) && counter <= credential.counter) {
      throw new PasskeyVerificationError(
        'counter_regression',
        'The passkey signature counter did not increase. The authenticator may have been cloned.',
      )
    }

    return {
      ok: true,
      credential: {
        ...credential,
        counter,
        backedUp: authenticatorData.flags.backedUp,
      },
    }
  } catch (error) {
    return toPasskeyFailure(error)
  }
}
