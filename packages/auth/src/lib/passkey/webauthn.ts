import { decodeBase64Url, encodeBase64Url } from '../base64url.ts'
import { decodeCbor, decodeCborItem } from './cbor.ts'
import type { CborValue } from './cbor.ts'
import { invalidResponse, PasskeyVerificationError } from './errors.ts'
import type { PasskeyCredentialDescriptor } from '../providers/passkey.ts'
import type { PasskeyCredentialDescriptorJSON, PasskeyUserVerification } from './json.ts'

export interface ParsedRegistrationResponse {
  credentialId: string
  rawCredentialId: Uint8Array<ArrayBuffer>
  clientDataJSON: Uint8Array<ArrayBuffer>
  attestationObject: Uint8Array<ArrayBuffer>
  transports: string[]
}

export interface ParsedAuthenticationResponse {
  credentialId: string
  clientDataJSON: Uint8Array<ArrayBuffer>
  authenticatorData: Uint8Array<ArrayBuffer>
  signature: Uint8Array<ArrayBuffer>
  userHandle: Uint8Array<ArrayBuffer> | null
}

export interface ClientData {
  type: string
  challenge: string
  origin: string
  crossOrigin: boolean
}

export interface AuthenticatorFlags {
  userPresent: boolean
  userVerified: boolean
  backupEligible: boolean
  backedUp: boolean
}

export interface AttestedCredentialData {
  aaguid: string
  credentialId: Uint8Array<ArrayBuffer>
  publicKey: Uint8Array<ArrayBuffer>
}

export interface AuthenticatorData {
  rpIdHash: Uint8Array<ArrayBuffer>
  flags: AuthenticatorFlags
  signCount: number
  attestedCredential?: AttestedCredentialData
}

export interface AuthenticatorDataPolicy {
  rpId: string
  userVerification: PasskeyUserVerification
}

// WebAuthn caps credential IDs at 1023 bytes.
const maxCredentialIdLength = 1023
const knownTransports = new Set(['ble', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'])
const textDecoder = new TextDecoder('utf-8', { fatal: true })
const textEncoder = new TextEncoder()

export function parseRegistrationResponse(value: unknown): ParsedRegistrationResponse {
  let { credentialId, rawCredentialId, response } = readCredential(value)

  return {
    credentialId,
    rawCredentialId,
    clientDataJSON: readBase64UrlField(response, 'clientDataJSON'),
    attestationObject: readBase64UrlField(response, 'attestationObject'),
    transports: readTransports(response.transports),
  }
}

export function parseAuthenticationResponse(value: unknown): ParsedAuthenticationResponse {
  let { credentialId, response } = readCredential(value)
  let userHandle = response.userHandle == null ? null : readBase64UrlField(response, 'userHandle')

  return {
    credentialId,
    clientDataJSON: readBase64UrlField(response, 'clientDataJSON'),
    authenticatorData: readBase64UrlField(response, 'authenticatorData'),
    signature: readBase64UrlField(response, 'signature'),
    userHandle,
  }
}

export function parseClientData(bytes: Uint8Array<ArrayBuffer>): ClientData {
  let json: unknown
  try {
    json = JSON.parse(textDecoder.decode(bytes))
  } catch {
    throw invalidResponse('Client data is not valid JSON.')
  }

  if (!isRecord(json)) {
    throw invalidResponse('Client data must be a JSON object.')
  }

  let { type, challenge, origin, crossOrigin } = json
  if (typeof type !== 'string' || typeof challenge !== 'string' || typeof origin !== 'string') {
    throw invalidResponse('Client data is missing its type, challenge, or origin.')
  }

  if (crossOrigin != null && typeof crossOrigin !== 'boolean') {
    throw invalidResponse('Client data has an invalid crossOrigin value.')
  }

  return { type, challenge, origin, crossOrigin: crossOrigin === true }
}

export function parseAttestationObject(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  let attestation: CborValue
  try {
    attestation = decodeCbor(bytes)
  } catch {
    throw invalidResponse('Attestation object is not valid CBOR.')
  }

  if (!(attestation instanceof Map)) {
    throw invalidResponse('Attestation object must be a CBOR map.')
  }

  let format = attestation.get('fmt')
  let authData = attestation.get('authData')
  if (typeof format !== 'string' || !(authData instanceof Uint8Array)) {
    throw invalidResponse('Attestation object is missing its format or authenticator data.')
  }

  // Registration requests `attestation: "none"`, so attestation statements are not trusted or
  // verified. The credential is accepted on the strength of the authenticator data alone.
  return authData
}

export function parseAuthenticatorData(bytes: Uint8Array<ArrayBuffer>): AuthenticatorData {
  if (bytes.length < 37) {
    throw invalidResponse('Authenticator data is too short.')
  }

  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let flagsByte = bytes[32]
  let flags: AuthenticatorFlags = {
    userPresent: (flagsByte & 0x01) !== 0,
    userVerified: (flagsByte & 0x04) !== 0,
    backupEligible: (flagsByte & 0x08) !== 0,
    backedUp: (flagsByte & 0x10) !== 0,
  }
  let hasAttestedCredentialData = (flagsByte & 0x40) !== 0
  let hasExtensionData = (flagsByte & 0x80) !== 0

  if (flags.backedUp && !flags.backupEligible) {
    throw invalidResponse(
      'Authenticator data reports a backup for a credential that is not eligible.',
    )
  }

  let authenticatorData: AuthenticatorData = {
    rpIdHash: bytes.slice(0, 32),
    flags,
    signCount: view.getUint32(33),
  }
  let offset = 37

  try {
    if (hasAttestedCredentialData) {
      if (bytes.length < offset + 18) {
        throw new Error('Attested credential data is truncated.')
      }

      let aaguid = bytes.subarray(offset, offset + 16)
      let credentialIdLength = view.getUint16(offset + 16)
      let credentialIdStart = offset + 18
      let credentialIdEnd = credentialIdStart + credentialIdLength
      if (credentialIdLength === 0 || credentialIdLength > maxCredentialIdLength) {
        throw new Error('Attested credential ID has an invalid length.')
      }

      let publicKey = decodeCborItem(bytes, credentialIdEnd)
      if (!(publicKey.value instanceof Map)) {
        throw new Error('Attested credential public key must be a CBOR map.')
      }

      authenticatorData.attestedCredential = {
        aaguid: formatAaguid(aaguid),
        credentialId: bytes.slice(credentialIdStart, credentialIdEnd),
        publicKey: bytes.slice(credentialIdEnd, publicKey.offset),
      }
      offset = publicKey.offset
    }

    if (hasExtensionData) {
      let extensions = decodeCborItem(bytes, offset)
      if (!(extensions.value instanceof Map)) {
        throw new Error('Authenticator extension data must be a CBOR map.')
      }
      offset = extensions.offset
    }
  } catch (error) {
    throw invalidResponse(error instanceof Error ? error.message : 'Malformed authenticator data.')
  }

  if (offset !== bytes.length) {
    throw invalidResponse('Authenticator data has unexpected trailing bytes.')
  }

  return authenticatorData
}

export function verifyOrigin(clientData: ClientData, origins: readonly string[]): void {
  if (!origins.includes(clientData.origin)) {
    throw new PasskeyVerificationError(
      'origin_mismatch',
      `Unexpected passkey origin "${clientData.origin}".`,
    )
  }

  if (clientData.crossOrigin) {
    throw new PasskeyVerificationError(
      'origin_mismatch',
      'Passkey ceremonies from cross-origin frames are not allowed.',
    )
  }
}

export async function verifyAuthenticatorData(
  authenticatorData: AuthenticatorData,
  policy: AuthenticatorDataPolicy,
): Promise<void> {
  let expectedHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', textEncoder.encode(policy.rpId)),
  )
  if (!bytesEqual(authenticatorData.rpIdHash, expectedHash)) {
    throw new PasskeyVerificationError(
      'rp_id_mismatch',
      `Passkey response is not scoped to relying party "${policy.rpId}".`,
    )
  }

  if (!authenticatorData.flags.userPresent) {
    throw new PasskeyVerificationError(
      'user_not_present',
      'The authenticator did not confirm user presence.',
    )
  }

  if (policy.userVerification === 'required' && !authenticatorData.flags.userVerified) {
    throw new PasskeyVerificationError(
      'user_not_verified',
      'The authenticator did not verify the user.',
    )
  }
}

export function toCredentialDescriptorJSON(
  credential: PasskeyCredentialDescriptor,
): PasskeyCredentialDescriptorJSON {
  let id = decodeBase64Url(credential.id)
  if (id == null || id.length === 0) {
    throw new Error(
      `Invalid passkey credential ID "${credential.id}". Expected a base64url string.`,
    )
  }

  let descriptor: PasskeyCredentialDescriptorJSON = { id: encodeBase64Url(id), type: 'public-key' }
  if (credential.transports != null && credential.transports.length > 0) {
    descriptor.transports = credential.transports
  }

  return descriptor
}

export function encodeUserHandle(userId: string): string {
  return encodeBase64Url(textEncoder.encode(userId))
}

export function decodeUserHandle(userHandle: Uint8Array<ArrayBuffer>): string | null {
  try {
    return textDecoder.decode(userHandle)
  } catch {
    return null
  }
}

export function getUserHandleLength(userId: string): number {
  return textEncoder.encode(userId).length
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return false
    }
  }

  return true
}

export function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  let bytes = new Uint8Array(a.length + b.length)
  bytes.set(a)
  bytes.set(b, a.length)
  return bytes
}

function readCredential(value: unknown): {
  credentialId: string
  rawCredentialId: Uint8Array<ArrayBuffer>
  response: Record<string, unknown>
} {
  let credential = value
  if (typeof credential === 'string') {
    try {
      credential = JSON.parse(credential)
    } catch {
      throw invalidResponse('Passkey response is not valid JSON.')
    }
  }

  if (!isRecord(credential)) {
    throw invalidResponse('Passkey response must be an object.')
  }

  if (credential.type !== 'public-key') {
    throw invalidResponse('Passkey response must have type "public-key".')
  }

  let id = readBase64UrlField(credential, 'id')
  let rawId = readBase64UrlField(credential, 'rawId')
  if (!bytesEqual(id, rawId)) {
    throw invalidResponse('Passkey response id and rawId do not match.')
  }

  if (rawId.length === 0 || rawId.length > maxCredentialIdLength) {
    throw invalidResponse('Passkey credential ID has an invalid length.')
  }

  if (!isRecord(credential.response)) {
    throw invalidResponse('Passkey response is missing its authenticator response.')
  }

  return {
    credentialId: encodeBase64Url(rawId),
    rawCredentialId: rawId,
    response: credential.response,
  }
}

function readBase64UrlField(
  record: Record<string, unknown>,
  name: string,
): Uint8Array<ArrayBuffer> {
  let value = record[name]
  let bytes = typeof value === 'string' ? decodeBase64Url(value) : null
  if (bytes == null) {
    throw invalidResponse(`Passkey response field "${name}" must be a base64url string.`)
  }

  return bytes
}

function readTransports(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  // Transports are client-reported hints that get echoed back into later ceremony options, so only
  // keep values the WebAuthn spec defines.
  let transports = value.filter(
    (transport): transport is string =>
      typeof transport === 'string' && knownTransports.has(transport),
  )
  return [...new Set(transports)]
}

function formatAaguid(bytes: Uint8Array): string {
  let hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}
