import type { Session } from '@remix-run/session'

import { fromBase64Url, toBase64Url } from './base64url.ts'
import { decodeCBOR, decodeCBORItem } from './cbor.ts'
import type { CBORValue } from './cbor.ts'
import type { WebAuthnAlgorithm, WebAuthnProvider } from './providers/webauthn.ts'

export const defaultWebAuthnTransactionKey = '__webauthn'

export interface WebAuthnTransaction {
  provider: string
  ceremony: 'registration' | 'authentication'
  challenge: string
  expiresAt: number
  userId?: string
  allowCredentials?: string[]
  returnTo?: string
}

// Reads and always clears the stored ceremony, so a challenge can only be answered once.
export function takeWebAuthnTransaction(
  session: Session,
  transactionKey: string,
  provider: WebAuthnProvider,
  ceremony: WebAuthnTransaction['ceremony'],
): WebAuthnTransaction {
  let transaction = session.get(transactionKey) as WebAuthnTransaction | undefined
  if (session.has(transactionKey)) {
    session.unset(transactionKey)
  }

  if (
    transaction == null ||
    transaction.provider !== provider.name ||
    transaction.ceremony !== ceremony
  ) {
    throw new Error(`Missing WebAuthn ${ceremony} for "${provider.name}".`)
  }
  if (Date.now() > transaction.expiresAt) {
    throw new Error(`WebAuthn ${ceremony} expired.`)
  }

  return transaction
}

export function getObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    throw new Error(`Invalid WebAuthn response: expected "${name}" to be an object.`)
  }

  return value as Record<string, unknown>
}

export function getString(object: Record<string, unknown>, name: string): string {
  let value = object[name]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid WebAuthn response: expected "${name}" to be a string.`)
  }

  return value
}

export function getBytes(object: Record<string, unknown>, name: string): Uint8Array<ArrayBuffer> {
  try {
    return fromBase64Url(getString(object, name))
  } catch {
    throw new Error(`Invalid WebAuthn response: expected "${name}" to be base64url.`)
  }
}

// Parses the outer credential shape shared by registration and authentication responses and checks
// that `id` and `rawId` agree.
export function parseCredentialResponse(value: unknown): {
  id: string
  response: Record<string, unknown>
} {
  let credential = getObject(value, 'credential')
  if (credential.type !== 'public-key') {
    throw new Error('Invalid WebAuthn response: expected type "public-key".')
  }

  let id = getString(credential, 'id')
  if (toBase64Url(getBytes(credential, 'rawId')) !== id) {
    throw new Error('Invalid WebAuthn response: "id" does not match "rawId".')
  }

  return { id, response: getObject(credential.response, 'response') }
}

// Verifies `clientDataJSON` against the expected ceremony type, challenge, and allowed origins.
export function verifyClientData(
  provider: WebAuthnProvider,
  clientDataJSON: Uint8Array,
  type: 'webauthn.create' | 'webauthn.get',
  challenge: string,
): void {
  let clientData: Record<string, unknown>
  try {
    clientData = getObject(JSON.parse(new TextDecoder().decode(clientDataJSON)), 'clientDataJSON')
  } catch {
    throw new Error('Invalid WebAuthn clientDataJSON.')
  }

  if (clientData.type !== type) {
    throw new Error(`Invalid WebAuthn client data type. Expected "${type}".`)
  }
  if (clientData.challenge !== challenge) {
    throw new Error('Invalid WebAuthn challenge.')
  }
  if (typeof clientData.origin !== 'string' || !provider.origins.includes(clientData.origin)) {
    throw new Error(`Invalid WebAuthn origin "${String(clientData.origin)}".`)
  }
  // Cross-origin iframes are not supported; the ceremony must run in a top-level allowed origin.
  if (clientData.crossOrigin === true) {
    throw new Error('Cross-origin WebAuthn ceremonies are not allowed.')
  }
}

export interface AuthenticatorData {
  userPresent: boolean
  userVerified: boolean
  backupEligible: boolean
  backedUp: boolean
  signCount: number
  attestedCredential?: {
    aaguid: string
    credentialId: Uint8Array<ArrayBuffer>
    publicKey: Uint8Array<ArrayBuffer>
  }
}

// Parses authenticator data and verifies the rpId hash, user presence, and user verification.
export async function verifyAuthenticatorData(
  provider: WebAuthnProvider,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<AuthenticatorData> {
  if (bytes.length < 37) {
    throw new Error('Invalid WebAuthn authenticator data.')
  }

  let expectedRpIdHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(provider.rpId)),
  )
  if (!equalBytes(bytes.subarray(0, 32), expectedRpIdHash)) {
    throw new Error('Invalid WebAuthn rpId hash.')
  }

  let flags = bytes[32]!
  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let data: AuthenticatorData = {
    userPresent: (flags & 0x01) !== 0,
    userVerified: (flags & 0x04) !== 0,
    backupEligible: (flags & 0x08) !== 0,
    backedUp: (flags & 0x10) !== 0,
    signCount: view.getUint32(33),
  }

  if (!data.userPresent) {
    throw new Error('WebAuthn user presence was not confirmed.')
  }
  if (provider.userVerification === 'required' && !data.userVerified) {
    throw new Error('WebAuthn user verification is required.')
  }
  if (data.backedUp && !data.backupEligible) {
    throw new Error('Invalid WebAuthn authenticator flags.')
  }

  if ((flags & 0x40) !== 0) {
    if (bytes.length < 55) {
      throw new Error('Invalid WebAuthn attested credential data.')
    }

    let aaguidHex = Array.from(bytes.subarray(37, 53), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    let credentialIdLength = view.getUint16(53)
    let credentialIdEnd = 55 + credentialIdLength
    if (credentialIdEnd > bytes.length) {
      throw new Error('Invalid WebAuthn attested credential data.')
    }

    // The COSE key is followed by optional extension data, so decode only its first CBOR item.
    let publicKeyLength = decodeCBORItem(bytes.subarray(credentialIdEnd)).length

    data.attestedCredential = {
      aaguid: [
        aaguidHex.slice(0, 8),
        aaguidHex.slice(8, 12),
        aaguidHex.slice(12, 16),
        aaguidHex.slice(16, 20),
        aaguidHex.slice(20),
      ].join('-'),
      credentialId: bytes.slice(55, credentialIdEnd),
      publicKey: bytes.slice(credentialIdEnd, credentialIdEnd + publicKeyLength),
    }
  }

  return data
}

// Decodes a registration `attestationObject` and returns its authenticator data. Attestation
// statements are not verified: providers always request `attestation: "none"`, so the credential
// is treated as unattested regardless of format.
export function readAttestationAuthenticatorData(
  attestationObject: Uint8Array,
): Uint8Array<ArrayBuffer> {
  let decoded = decodeCBOR(attestationObject)
  let authData = decoded instanceof Map ? decoded.get('authData') : undefined
  if (!(authData instanceof Uint8Array)) {
    throw new Error('Invalid WebAuthn attestation object.')
  }

  return authData
}

// Imports a COSE public key and returns its algorithm plus a signature verifier.
export async function importCOSEPublicKey(coseKey: Uint8Array): Promise<{
  algorithm: WebAuthnAlgorithm
  verify(signature: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<boolean>
}> {
  let key = decodeCBOR(coseKey)
  if (!(key instanceof Map)) {
    throw new Error('Invalid WebAuthn credential public key.')
  }

  let keyType = key.get(1)
  let algorithm = key.get(3)

  try {
    if (algorithm === -7 && keyType === 2 && key.get(-1) === 1) {
      let publicKey = await crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', x: coseBytes(key, -2), y: coseBytes(key, -3) },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      )

      return {
        algorithm,
        async verify(signature, data) {
          let rawSignature = derToRawECDSASignature(signature, 32)
          if (rawSignature == null) return false
          return crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            publicKey,
            rawSignature,
            data,
          )
        },
      }
    }

    if (algorithm === -8 && keyType === 1 && key.get(-1) === 6) {
      let publicKey = await crypto.subtle.importKey(
        'jwk',
        { kty: 'OKP', crv: 'Ed25519', x: coseBytes(key, -2) },
        { name: 'Ed25519' },
        false,
        ['verify'],
      )

      return {
        algorithm,
        verify: (signature, data) => crypto.subtle.verify('Ed25519', publicKey, signature, data),
      }
    }

    if (algorithm === -257 && keyType === 3) {
      let publicKey = await crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n: coseBytes(key, -1), e: coseBytes(key, -2) },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )

      return {
        algorithm,
        verify: (signature, data) =>
          crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data),
      }
    }
  } catch {
    throw new Error('Invalid WebAuthn credential public key.')
  }

  throw new Error(`Unsupported WebAuthn credential algorithm "${String(algorithm)}".`)
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  let bytes = new Uint8Array(a.length + b.length)
  bytes.set(a)
  bytes.set(b, a.length)
  return bytes
}

function coseBytes(key: Map<CBORValue, CBORValue>, label: number): string {
  let value = key.get(label)
  if (!(value instanceof Uint8Array)) {
    throw new Error('Invalid WebAuthn credential public key.')
  }

  return toBase64Url(value)
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false

  let difference = 0
  for (let index = 0; index < a.length; index++) {
    difference |= a[index]! ^ b[index]!
  }

  return difference === 0
}

// WebAuthn ECDSA signatures are ASN.1 DER `SEQUENCE { INTEGER r, INTEGER s }`, while Web Crypto
// expects the fixed-width `r || s` form.
function derToRawECDSASignature(
  der: Uint8Array,
  componentLength: number,
): Uint8Array<ArrayBuffer> | null {
  if (der[0] !== 0x30 || der[1] !== der.length - 2) return null

  let raw = new Uint8Array(componentLength * 2)
  let offset = 2

  for (let component = 0; component < 2; component++) {
    if (der[offset] !== 0x02) return null

    let length = der[offset + 1]!
    let start = offset + 2
    let end = start + length
    if (length === 0 || end > der.length) return null

    let value = der.subarray(start, end)
    while (value.length > 1 && value[0] === 0) {
      value = value.subarray(1)
    }
    if (value.length > componentLength) return null

    raw.set(value, componentLength * (component + 1) - value.length)
    offset = end
  }

  return offset === der.length ? raw : null
}
