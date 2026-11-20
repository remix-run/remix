import type { RequestContext } from '@remix-run/fetch-router'

import { fromBase64Url } from './base64url.ts'
import type {
  WebAuthnAuthenticationOptionsJSON,
  WebAuthnCredential,
  WebAuthnProvider,
} from './providers/webauthn.ts'
import { createRandomToken, getSession, sanitizeReturnTo } from './utils.ts'
import {
  defaultWebAuthnTransactionKey,
  getBytes,
  importCOSEPublicKey,
  parseCredentialResponse,
  saveWebAuthnTransaction,
  takeWebAuthnTransaction,
  verifyAuthenticatorData,
  verifyClientData,
} from './webauthn-protocol.ts'
import type { WebAuthnTransaction } from './webauthn-protocol.ts'

/**
 * Options for starting a WebAuthn authentication ceremony.
 */
export interface StartWebAuthnAuthenticationOptions {
  /**
   * Credentials allowed to answer this ceremony. Omit it for discoverable credential (passkey)
   * login, where the browser lets the user pick any passkey for this site.
   */
  allowCredentials?: Array<Pick<WebAuthnCredential, 'id' | 'transports'>>
  /** Optional local path to normalize and preserve as the post-auth redirect target. */
  returnTo?: string | null
  /** Session key used to store the in-progress ceremony. Defaults to `"__webauthn"`. */
  transactionKey?: string
}

/**
 * Options for finishing a WebAuthn authentication ceremony.
 */
export interface FinishWebAuthnAuthenticationOptions {
  /** Looks up a stored credential by its base64url id. Return `null` when it is unknown. */
  getCredential(id: string): WebAuthnCredential | null | Promise<WebAuthnCredential | null>
  /** Session key used to read and clear the in-progress ceremony. Defaults to `"__webauthn"`. */
  transactionKey?: string
}

/**
 * Result returned from a successful WebAuthn authentication ceremony.
 */
export interface FinishedWebAuthnAuthenticationResult {
  /**
   * The credential with its updated `signCount` and backup state. Persist it so the next login can
   * detect cloned authenticators.
   */
  credential: WebAuthnCredential
  /** App user id the credential belongs to. */
  userId: string
  /** Whether the authenticator verified the user during this login. */
  userVerified: boolean
  /** Normalized local post-auth redirect path, when one was provided. */
  returnTo?: string
}

/**
 * Starts a WebAuthn authentication ceremony and stores its challenge in the session.
 *
 * @param provider The WebAuthn provider.
 * @param context The current request context with session middleware installed.
 * @param options Optional allowed credentials and return target.
 * @returns JSON options to pass to `navigator.credentials.get()` in the browser.
 */
export function startWebAuthnAuthentication<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: WebAuthnProvider,
  context: context,
  options: StartWebAuthnAuthenticationOptions = {},
): WebAuthnAuthenticationOptionsJSON {
  let session = getSession(context, 'startWebAuthnAuthentication()')
  let allowCredentials = options.allowCredentials ?? []
  let transaction: WebAuthnTransaction = {
    provider: provider.name,
    ceremony: 'authentication',
    challenge: createRandomToken(32),
    expiresAt: Date.now() + provider.timeout,
    allowCredentials:
      allowCredentials.length > 0 ? allowCredentials.map((credential) => credential.id) : undefined,
    returnTo: sanitizeReturnTo(options.returnTo ?? null),
  }
  saveWebAuthnTransaction(
    session,
    options.transactionKey ?? defaultWebAuthnTransactionKey,
    transaction,
  )

  return {
    challenge: transaction.challenge,
    timeout: provider.timeout,
    rpId: provider.rpId,
    allowCredentials: allowCredentials.map((credential) => ({
      type: 'public-key',
      id: credential.id,
      transports: credential.transports,
    })),
    userVerification: provider.userVerification,
  }
}

/**
 * Finishes a WebAuthn authentication ceremony by verifying the browser's signed assertion against
 * the stored credential and a challenge stored in the session. Once the response is matched to its
 * ceremony, that ceremony is removed from the session whether verification succeeds or fails. The
 * removal is only saved when the route returns a response, so catch errors from this function
 * instead of letting them escape.
 *
 * @param provider The WebAuthn provider that started the ceremony.
 * @param context The current request context with session middleware installed.
 * @param response The untrusted authentication response from the browser, usually
 * `PublicKeyCredential.toJSON()` parsed from the request body.
 * @param options Credential lookup and transaction settings.
 * @returns The authenticated user id and the updated credential to persist.
 */
export async function finishWebAuthnAuthentication<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: WebAuthnProvider,
  context: context,
  response: unknown,
  options: FinishWebAuthnAuthenticationOptions,
): Promise<FinishedWebAuthnAuthenticationResult> {
  let session = getSession(context, 'finishWebAuthnAuthentication()')
  let assertion = parseCredentialResponse(response)
  let clientDataJSON = getBytes(assertion.response, 'clientDataJSON')
  let challenge = verifyClientData(provider, clientDataJSON, 'webauthn.get')
  let transaction = takeWebAuthnTransaction(
    session,
    options.transactionKey ?? defaultWebAuthnTransactionKey,
    provider,
    'authentication',
    challenge,
  )

  if (
    transaction.allowCredentials != null &&
    !transaction.allowCredentials.includes(assertion.id)
  ) {
    throw new Error('WebAuthn credential was not allowed for this login.')
  }

  let stored = await options.getCredential(assertion.id)
  if (stored == null || stored.id !== assertion.id) {
    throw new Error('Unknown WebAuthn credential.')
  }

  let userHandle = assertion.response.userHandle
  if (userHandle != null && userHandle !== '') {
    let userId: string
    try {
      userId = new TextDecoder('utf-8', { fatal: true }).decode(fromBase64Url(String(userHandle)))
    } catch {
      throw new Error('Invalid WebAuthn user handle.')
    }
    if (userId !== stored.userId) {
      throw new Error('WebAuthn user handle does not match the credential owner.')
    }
  }

  let authenticatorDataBytes = getBytes(assertion.response, 'authenticatorData')
  let authenticatorData = await verifyAuthenticatorData(provider, authenticatorDataBytes)
  if (authenticatorData.backupEligible !== stored.backupEligible) {
    throw new Error('WebAuthn backup eligibility changed for this credential.')
  }

  let publicKey = await importCOSEPublicKey(fromBase64Url(stored.publicKey))
  let clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON))
  let signedData = new Uint8Array(authenticatorDataBytes.length + clientDataHash.length)
  signedData.set(authenticatorDataBytes)
  signedData.set(clientDataHash, authenticatorDataBytes.length)
  let verified = await publicKey.verify(getBytes(assertion.response, 'signature'), signedData)
  if (!verified) {
    throw new Error('Invalid WebAuthn signature.')
  }

  // Authenticators that never count (most synced passkeys) always report 0. Otherwise the counter
  // must increase, or the credential may have been cloned.
  if (
    (authenticatorData.signCount !== 0 || stored.signCount !== 0) &&
    authenticatorData.signCount <= stored.signCount
  ) {
    throw new Error('WebAuthn signature counter did not increase.')
  }

  return {
    credential: {
      ...stored,
      signCount: authenticatorData.signCount,
      backedUp: authenticatorData.backedUp,
    },
    userId: stored.userId,
    userVerified: authenticatorData.userVerified,
    returnTo: transaction.returnTo,
  }
}
