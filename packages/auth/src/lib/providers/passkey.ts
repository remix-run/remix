import type { RequestContext } from '@remix-run/fetch-router'

import type { PasskeyUserVerification } from '../passkey/json.ts'

/**
 * Stored passkey credential needed to verify later sign-ins.
 */
export interface PasskeyCredential {
  /** Base64url credential ID. Unique across all users. */
  id: string
  /** Application user ID the credential belongs to. */
  userId: string
  /** Base64url COSE public key used to verify assertion signatures. */
  publicKey: string
  /** Signature counter reported by the authenticator. Synced passkeys always report `0`. */
  counter: number
  /** Transport hints used to help the browser find the authenticator. */
  transports?: string[]
  /** Whether the credential can be synced or backed up, such as a passkey in a password manager. */
  backupEligible: boolean
  /** Whether the credential was backed up when it was last used. */
  backedUp: boolean
  /**
   * Authenticator model identifier reported by the authenticator, or all zeros when it does not
   * share one. Attestation is not verified, so use it for display rather than security decisions.
   */
  aaguid?: string
}

/**
 * Credential reference used to build `excludeCredentials` and `allowCredentials` lists.
 */
export interface PasskeyCredentialDescriptor {
  /** Base64url credential ID. */
  id: string
  /** Transport hints used to help the browser find the authenticator. */
  transports?: string[]
}

/**
 * App-owned storage that makes passkey challenges single-use across requests and server instances.
 */
export interface PasskeyChallengeStore {
  /**
   * Saves a newly issued challenge.
   *
   * @param challenge Base64url challenge value.
   * @param expiresAt Time after which the challenge can be discarded.
   * @param context Current request context.
   */
  save(challenge: string, expiresAt: Date, context: RequestContext): void | Promise<void>
  /**
   * Removes a challenge atomically.
   *
   * @param challenge Base64url challenge value.
   * @param context Current request context.
   * @returns `true` only for the call that removed the stored challenge.
   */
  consume(challenge: string, context: RequestContext): boolean | Promise<boolean>
}

/**
 * Looks up a stored passkey credential by ID.
 */
export type FindPasskeyCredential = (
  credentialId: string,
  context: RequestContext,
) => PasskeyCredential | null | Promise<PasskeyCredential | null>

/**
 * Options for building a passkey auth provider.
 */
export interface PasskeyAuthProviderOptions<provider extends string = 'passkey'> {
  /** Provider name used for session metadata and diagnostics. */
  name?: provider
  /** Relying party ID, usually the registrable domain of the application such as `example.com`. */
  rpId: string
  /** Human-readable application name shown by some authenticators. */
  rpName: string
  /** Exact origins allowed to run passkey ceremonies, such as `https://example.com`. */
  origin: string | string[]
  /** User verification policy for registration and sign-in. (default: `'preferred'`) */
  userVerification?: PasskeyUserVerification
  /** Time in milliseconds before an issued challenge expires. (default: `300000`) */
  timeout?: number
  /** Storage used to make challenges single-use. */
  challengeStore: PasskeyChallengeStore
  /** Looks up a stored credential by ID. Return `null` for unknown or revoked credentials. */
  findCredential: FindPasskeyCredential
}

/**
 * Public shape for a passkey provider used by the passkey ceremony helpers.
 */
export interface PasskeyAuthProvider<provider extends string = string> {
  /** Provider name used for session metadata and diagnostics. */
  name: provider
  /** Relying party ID credentials are scoped to. */
  rpId: string
  /** Human-readable application name shown by some authenticators. */
  rpName: string
  /** Exact origins allowed to run passkey ceremonies. */
  origins: readonly string[]
  /** User verification policy for registration and sign-in. */
  userVerification: PasskeyUserVerification
  /** Time in milliseconds before an issued challenge expires. */
  timeout: number
  /** Storage used to make challenges single-use. */
  challengeStore: PasskeyChallengeStore
  /** Looks up a stored credential by ID. */
  findCredential: FindPasskeyCredential
}

const defaultTimeout = 5 * 60 * 1000
const userVerificationPolicies: readonly string[] = ['required', 'preferred', 'discouraged']

/**
 * Creates a passkey provider for WebAuthn registration and sign-in.
 *
 * @param options Relying party settings, challenge storage, and credential lookup.
 * @returns A provider that can be passed to the passkey ceremony helpers.
 */
export function createPasskeyAuthProvider<provider extends string = 'passkey'>(
  options: PasskeyAuthProviderOptions<provider>,
): PasskeyAuthProvider<provider> {
  let rpId = validateRpId(options.rpId)
  let origins = (Array.isArray(options.origin) ? options.origin : [options.origin]).map((origin) =>
    validateOrigin(origin, rpId),
  )
  let userVerification = options.userVerification ?? 'preferred'
  let timeout = options.timeout ?? defaultTimeout

  if (origins.length === 0) {
    throw new Error('Passkey provider requires at least one origin.')
  }

  if (typeof options.rpName !== 'string' || options.rpName.trim() === '') {
    throw new Error('Passkey provider requires an rpName.')
  }

  if (!userVerificationPolicies.includes(userVerification)) {
    throw new Error(`Invalid passkey userVerification "${String(userVerification)}".`)
  }

  if (!Number.isSafeInteger(timeout) || timeout <= 0) {
    throw new Error('Passkey provider timeout must be a positive integer number of milliseconds.')
  }

  if (
    typeof options.challengeStore?.save !== 'function' ||
    typeof options.challengeStore.consume !== 'function'
  ) {
    throw new Error('Passkey provider requires a challengeStore with save() and consume().')
  }

  if (typeof options.findCredential !== 'function') {
    throw new Error('Passkey provider requires a findCredential() function.')
  }

  return {
    name: options.name ?? ('passkey' as provider),
    rpId,
    rpName: options.rpName,
    origins,
    userVerification,
    timeout,
    challengeStore: options.challengeStore,
    findCredential: options.findCredential,
  }
}

function validateRpId(rpId: string): string {
  let hostname: string | undefined
  try {
    hostname = new URL(`https://${rpId}`).hostname
  } catch {}

  if (typeof rpId !== 'string' || rpId === '' || hostname !== rpId) {
    throw new Error(
      `Invalid passkey rpId "${String(rpId)}". Expected a lowercase domain such as "example.com".`,
    )
  }

  if (rpId.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(rpId)) {
    throw new Error(
      `Invalid passkey rpId "${rpId}". Browsers require a domain rather than an IP address, so use "localhost" during development.`,
    )
  }

  return rpId
}

function validateOrigin(origin: string, rpId: string): string {
  let url: URL | undefined
  try {
    url = new URL(origin)
  } catch {}

  if (
    url == null ||
    url.origin !== origin ||
    (url.protocol !== 'https:' && url.protocol !== 'http:')
  ) {
    throw new Error(
      `Invalid passkey origin "${String(origin)}". Expected an origin such as "https://example.com".`,
    )
  }

  if (url.hostname !== rpId && !url.hostname.endsWith(`.${rpId}`)) {
    throw new Error(`Passkey origin "${origin}" is not within rpId "${rpId}".`)
  }

  return origin
}
