import { createPasskeyAuthProvider } from 'remix/auth'
import type { PasskeyAuthProvider, PasskeyCredential, PasskeyError } from 'remix/auth'
import { lte } from 'remix/data-table'
import type { Database } from 'remix/data-table'
import type { RequestContext } from 'remix/router'

import { passkeyChallenges, passkeys } from '../data/schema.ts'
import type { Passkey } from '../data/schema.ts'
import { databaseContext } from '../middleware/database.ts'

export const passkeyProvider = createPasskeyProvider()

export function createPasskeyProvider(origin = getPasskeyOrigin()): PasskeyAuthProvider {
  let url = new URL(origin)

  return createPasskeyAuthProvider({
    rpId: url.hostname,
    rpName: 'Remix Social Auth Demo',
    origin: url.origin,
    challengeStore: {
      async save(challenge, expiresAt, context) {
        let db = getDatabase(context)
        await db.deleteMany(passkeyChallenges, { where: lte('expires_at', Date.now()) })
        await db.create(passkeyChallenges, { challenge, expires_at: expiresAt.getTime() })
      },
      consume(challenge, context) {
        // Deleting by primary key is atomic, so only one request can redeem a challenge.
        return getDatabase(context).delete(passkeyChallenges, { challenge })
      },
    },
    async findCredential(credentialId, context) {
      let passkey = await getDatabase(context).find(passkeys, credentialId)
      return passkey == null ? null : toPasskeyCredential(passkey)
    },
  })
}

/**
 * Passkeys are scoped to a domain, and browsers reject IP addresses as relying party IDs. The demo
 * therefore runs passkeys on `localhost` even though OAuth callbacks use `127.0.0.1`.
 */
export function getPasskeyOrigin(port = process.env.PORT ?? '44100'): string {
  return process.env.PASSKEY_ORIGIN || `http://localhost:${port}`
}

// Pages served from another origin, such as `127.0.0.1`, link to the same page on the passkey
// origin instead of offering passkey ceremonies the browser would reject.
export type PasskeySupport = { available: true } | { available: false; passkeyHref: string }

export function getPasskeySupport(
  url: URL,
  provider: PasskeyAuthProvider = passkeyProvider,
): PasskeySupport {
  if (provider.origins.includes(url.origin)) {
    return { available: true }
  }

  return {
    available: false,
    passkeyHref: new URL(url.pathname + url.search, provider.origins[0]).href,
  }
}

export function toPasskeyCredential(passkey: Passkey): PasskeyCredential {
  return {
    id: passkey.id,
    userId: String(passkey.user_id),
    publicKey: passkey.public_key,
    counter: passkey.counter,
    transports: JSON.parse(passkey.transports) as string[],
    // SQLite reads boolean columns back as 0 or 1.
    backupEligible: Boolean(passkey.backup_eligible),
    backedUp: Boolean(passkey.backed_up),
    aaguid: passkey.aaguid ?? undefined,
  }
}

export function getPasskeyErrorMessage(error: PasskeyError): string {
  switch (error.code) {
    case 'challenge_expired':
      return 'That passkey request expired. Please try again.'
    case 'credential_exists':
      return 'That passkey is already registered.'
    case 'credential_not_found':
      return 'That passkey is no longer registered. Sign in another way, then add a new passkey.'
    case 'user_not_verified':
      return 'Your device did not verify you. Please try again.'
    default:
      return 'We could not verify that passkey. Please try again.'
  }
}

function getDatabase(context: RequestContext): Database {
  let db = context.get(databaseContext)
  if (db == null) {
    throw new Error('Expected loadDatabase() middleware before passkey auth')
  }

  return db
}
