import type { RequestContext } from '@remix-run/fetch-router'

import { defaultChallengeKey, issuePasskeyChallenge } from './passkey/challenge.ts'
import type { PasskeyRequestOptionsJSON } from './passkey/json.ts'
import { toCredentialDescriptorJSON } from './passkey/webauthn.ts'
import type { PasskeyAuthProvider, PasskeyCredentialDescriptor } from './providers/passkey.ts'
import { getSession } from './utils.ts'

/**
 * Options for starting passkey sign-in.
 */
export interface StartPasskeyAuthenticationOptions {
  /**
   * Account the user already identified, such as by entering a username. When set, sign-in only
   * succeeds with a passkey owned by this account. Omit it for username-less sign-in and autofill.
   */
  userId?: string
  /**
   * Passkeys the user may sign in with. Sign-in rejects any other passkey. Omit it to allow any
   * discoverable passkey for the site.
   */
  allowCredentials?: PasskeyCredentialDescriptor[]
  /** Session key used to store the pending challenge. (default: `'__passkey'`) */
  challengeKey?: string
}

/**
 * Starts passkey sign-in by issuing a challenge bound to the session.
 *
 * Pass the returned options to `getPasskey()` from `remix/auth/browser`, or to
 * `navigator.credentials.get()` after decoding them with
 * `PublicKeyCredential.parseRequestOptionsFromJSON()`.
 *
 * @param provider The passkey provider that defines the relying party.
 * @param context The current request context.
 * @param options Optional account binding and allowed passkeys.
 * @returns JSON-serializable WebAuthn request options for the browser.
 */
export async function startPasskeyAuthentication<
  context extends RequestContext<any, any> = RequestContext,
>(
  provider: PasskeyAuthProvider,
  context: context,
  options: StartPasskeyAuthenticationOptions = {},
): Promise<PasskeyRequestOptionsJSON> {
  let session = getSession(context, 'startPasskeyAuthentication()')
  let allowCredentials = (options.allowCredentials ?? []).map(toCredentialDescriptorJSON)
  let challenge = await issuePasskeyChallenge(provider, context, session, {
    key: options.challengeKey ?? defaultChallengeKey,
    ceremony: 'authentication',
    userId: options.userId,
    allowCredentials: allowCredentials.map((credential) => credential.id),
  })

  return {
    challenge,
    rpId: provider.rpId,
    timeout: provider.timeout,
    userVerification: provider.userVerification,
    allowCredentials,
  }
}
