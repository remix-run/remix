import type { RequestContext } from '@remix-run/fetch-router'

import { defaultChallengeKey, issuePasskeyChallenge } from './passkey/challenge.ts'
import { supportedCoseAlgorithms } from './passkey/cose.ts'
import type { PasskeyCreationOptionsJSON } from './passkey/json.ts'
import {
  encodeUserHandle,
  getUserHandleLength,
  toCredentialDescriptorJSON,
} from './passkey/webauthn.ts'
import type { PasskeyAuthProvider, PasskeyCredentialDescriptor } from './providers/passkey.ts'
import { getSession } from './utils.ts'

/**
 * Account a new passkey is registered for.
 */
export interface PasskeyUser {
  /**
   * Stable application user ID, such as a database ID or UUID. It becomes the WebAuthn user handle,
   * so it must not contain personal information such as an email address. Limited to 64 bytes.
   */
  id: string
  /** Account identifier shown in passkey pickers, such as an email address or username. */
  name: string
  /** Human-readable account name shown in passkey pickers. (default: `name`) */
  displayName?: string
}

/**
 * Options for starting passkey registration.
 */
export interface StartPasskeyRegistrationOptions {
  /** Account the new passkey is registered for. */
  user: PasskeyUser
  /** Passkeys the account already has, so authenticators do not register them twice. */
  excludeCredentials?: PasskeyCredentialDescriptor[]
  /** Session key used to store the pending challenge. (default: `'__passkey'`) */
  challengeKey?: string
}

// WebAuthn limits user handles to 64 bytes.
const maxUserHandleLength = 64

/**
 * Starts passkey registration by issuing a challenge bound to the session and account.
 *
 * Pass the returned options to `createPasskey()` from `remix/auth/browser`, or to
 * `navigator.credentials.create()` after decoding them with
 * `PublicKeyCredential.parseCreationOptionsFromJSON()`.
 *
 * @param provider The passkey provider that defines the relying party.
 * @param context The current request context.
 * @param options The account to register and the passkeys it already has.
 * @returns JSON-serializable WebAuthn creation options for the browser.
 */
export async function startPasskeyRegistration<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: PasskeyAuthProvider,
  context: context,
  options: StartPasskeyRegistrationOptions,
): Promise<PasskeyCreationOptionsJSON> {
  let session = getSession(context, 'startPasskeyRegistration()')
  let { user } = options

  if (typeof user.id !== 'string' || user.id === '') {
    throw new Error('startPasskeyRegistration() requires a user id.')
  }

  if (getUserHandleLength(user.id) > maxUserHandleLength) {
    throw new Error('startPasskeyRegistration() user ids must be at most 64 bytes.')
  }

  if (typeof user.name !== 'string' || user.name === '') {
    throw new Error('startPasskeyRegistration() requires a user name.')
  }

  let challenge = await issuePasskeyChallenge(provider, context, session, {
    key: options.challengeKey ?? defaultChallengeKey,
    ceremony: 'registration',
    userId: user.id,
  })

  return {
    challenge,
    rp: { id: provider.rpId, name: provider.rpName },
    user: {
      id: encodeUserHandle(user.id),
      name: user.name,
      displayName: user.displayName ?? user.name,
    },
    pubKeyCredParams: supportedCoseAlgorithms.map((alg) => ({ type: 'public-key', alg })),
    timeout: provider.timeout,
    excludeCredentials: (options.excludeCredentials ?? []).map(toCredentialDescriptorJSON),
    authenticatorSelection: {
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: provider.userVerification,
    },
    attestation: 'none',
  }
}
