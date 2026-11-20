import { createWebAuthnProvider } from 'remix/auth'
import type { WebAuthnAlgorithm, WebAuthnCredential, WebAuthnProvider } from 'remix/auth'
import type { Database } from 'remix/data-table'

import { passkeys, type Passkey } from '../data/schema.ts'

export function getDemoOrigin(port = process.env.PORT ?? '44100'): string {
  return process.env.ORIGIN ?? `http://localhost:${port}`
}

export function createPasskeyProvider(origin: string): WebAuthnProvider {
  return createWebAuthnProvider({
    // Browsers reject IP addresses as relying party ids, so local development runs on `localhost`.
    rpId: new URL(origin).hostname,
    rpName: 'Remix Passkeys Demo',
    origin,
    // Passkeys are the only way to sign in, so the authenticator must verify the user with a
    // biometric or PIN, and store a discoverable credential that works without typing a username.
    userVerification: 'required',
    residentKey: 'required',
  })
}

export async function findPasskeyCredential(
  db: Database,
  id: string,
): Promise<WebAuthnCredential | null> {
  let passkey = await db.find(passkeys, id)
  return passkey == null ? null : toWebAuthnCredential(passkey)
}

export function toWebAuthnCredential(passkey: Passkey): WebAuthnCredential {
  return {
    id: passkey.id,
    userId: passkey.user_id,
    publicKey: passkey.public_key,
    // Only credentials verified by `remix/auth` are stored, so the algorithm is always supported.
    algorithm: passkey.algorithm as WebAuthnAlgorithm,
    signCount: passkey.sign_count,
    transports: Array.isArray(passkey.transports) ? passkey.transports.map(String) : undefined,
    backupEligible: passkey.backup_eligible,
    backedUp: passkey.backed_up,
    aaguid: passkey.aaguid,
  }
}

export function toPasskeyRow(credential: WebAuthnCredential, createdAt: number): Passkey {
  return {
    id: credential.id,
    user_id: credential.userId,
    public_key: credential.publicKey,
    algorithm: credential.algorithm,
    sign_count: credential.signCount,
    transports: credential.transports ?? null,
    backup_eligible: credential.backupEligible,
    backed_up: credential.backedUp,
    aaguid: credential.aaguid,
    created_at: createdAt,
    last_used_at: null,
  }
}
