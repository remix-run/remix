import { decodeBase64Url, encodeBase64Url } from '../base64url.ts'
import type {
  PasskeyAuthenticationResponseJSON,
  PasskeyCreationOptionsJSON,
  PasskeyRegistrationResponseJSON,
  PasskeyRequestOptionsJSON,
} from './json.ts'

export type TestAuthenticatorAlgorithm = 'ES256' | 'EdDSA' | 'RS256'

export interface TestAuthenticatorFlags {
  userPresent: boolean
  userVerified: boolean
  backupEligible: boolean
  backedUp: boolean
}

export interface TestAuthenticatorOptions {
  algorithm?: TestAuthenticatorAlgorithm
  origin?: string
  flags?: Partial<TestAuthenticatorFlags>
  signCount?: number
  incrementSignCount?: boolean
}

export interface TestCeremonyOverrides {
  origin?: string
  type?: string
  challenge?: string
  crossOrigin?: boolean
  rpId?: string
  flags?: Partial<TestAuthenticatorFlags>
}

export interface TestRegistrationOverrides extends TestCeremonyOverrides {
  authenticatorDataCredentialId?: Uint8Array
  attestationFormat?: string
  coseKey?: CborEncodable
}

export interface TestAuthenticationOverrides extends TestCeremonyOverrides {
  signCount?: number
  userHandle?: string | null
  credentialId?: string
  tamperSignature?: boolean
}

export interface TestAuthenticator {
  credentialId: string
  register(
    options: PasskeyCreationOptionsJSON,
    overrides?: TestRegistrationOverrides,
  ): Promise<PasskeyRegistrationResponseJSON>
  authenticate(
    options: PasskeyRequestOptionsJSON,
    overrides?: TestAuthenticationOverrides,
  ): Promise<PasskeyAuthenticationResponseJSON>
}

export type CborEncodable =
  | number
  | string
  | boolean
  | null
  | Uint8Array
  | CborEncodable[]
  | Map<number | string, CborEncodable>

const textEncoder = new TextEncoder()

/**
 * Creates a software authenticator that produces real WebAuthn registration and authentication
 * responses for tests.
 *
 * @param options Key algorithm, origin, flags, and signature counter behavior.
 * @returns An authenticator holding one credential.
 */
export async function createTestAuthenticator(
  options: TestAuthenticatorOptions = {},
): Promise<TestAuthenticator> {
  let algorithm = options.algorithm ?? 'ES256'
  let origin = options.origin ?? 'https://app.example.com'
  let flags: TestAuthenticatorFlags = {
    userPresent: true,
    userVerified: true,
    backupEligible: true,
    backedUp: true,
    ...options.flags,
  }
  let signCount = options.signCount ?? 0
  let { keyPair, coseKey } = await generateCredentialKey(algorithm)
  let rawCredentialId = crypto.getRandomValues(new Uint8Array(32))
  let credentialId = encodeBase64Url(rawCredentialId)
  let userHandle: string | null = null

  return {
    credentialId,
    async register(creationOptions, overrides = {}) {
      userHandle = creationOptions.user.id

      let clientDataJSON = createClientData(
        'webauthn.create',
        creationOptions.challenge,
        origin,
        overrides,
      )
      let attestedCredentialData = concat(
        new Uint8Array(16),
        uint16(rawCredentialIdFor(overrides.authenticatorDataCredentialId).length),
        rawCredentialIdFor(overrides.authenticatorDataCredentialId),
        encodeCbor(overrides.coseKey ?? coseKey),
      )
      let authenticatorData = await createAuthenticatorData(
        overrides.rpId ?? creationOptions.rp.id,
        { ...flags, ...overrides.flags },
        signCount,
        attestedCredentialData,
      )
      let attestationObject = encodeCbor(
        new Map<string, CborEncodable>([
          ['fmt', overrides.attestationFormat ?? 'none'],
          ['attStmt', new Map()],
          ['authData', authenticatorData],
        ]),
      )

      return {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: encodeBase64Url(clientDataJSON),
          attestationObject: encodeBase64Url(attestationObject),
          transports: ['internal', 'hybrid'],
        },
      }
    },
    async authenticate(requestOptions, overrides = {}) {
      if (options.incrementSignCount) {
        signCount++
      }

      let clientDataJSON = createClientData(
        'webauthn.get',
        requestOptions.challenge,
        origin,
        overrides,
      )
      let authenticatorData = await createAuthenticatorData(
        overrides.rpId ?? requestOptions.rpId,
        { ...flags, ...overrides.flags },
        overrides.signCount ?? signCount,
      )
      let clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON))
      let signature = await sign(
        algorithm,
        keyPair.privateKey,
        concat(authenticatorData, clientDataHash),
      )
      if (overrides.tamperSignature) {
        signature[signature.length - 1] ^= 0xff
      }

      let returnedUserHandle =
        overrides.userHandle === undefined
          ? userHandle
          : overrides.userHandle === null
            ? null
            : encodeBase64Url(textEncoder.encode(overrides.userHandle))
      let returnedCredentialId = overrides.credentialId ?? credentialId

      return {
        id: returnedCredentialId,
        rawId: returnedCredentialId,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        response: {
          clientDataJSON: encodeBase64Url(clientDataJSON),
          authenticatorData: encodeBase64Url(authenticatorData),
          signature: encodeBase64Url(signature),
          userHandle: returnedUserHandle,
        },
      }
    },
  }

  function rawCredentialIdFor(override: Uint8Array | undefined): Uint8Array {
    return override ?? rawCredentialId
  }
}

export function encodeCbor(value: CborEncodable): Uint8Array<ArrayBuffer> {
  if (typeof value === 'number') {
    return value >= 0 ? encodeHead(0, value) : encodeHead(1, -1 - value)
  }

  if (typeof value === 'string') {
    let bytes = textEncoder.encode(value)
    return concat(encodeHead(3, bytes.length), bytes)
  }

  if (typeof value === 'boolean') {
    return new Uint8Array([value ? 0xf5 : 0xf4])
  }

  if (value === null) {
    return new Uint8Array([0xf6])
  }

  if (value instanceof Uint8Array) {
    return concat(encodeHead(2, value.length), value)
  }

  if (Array.isArray(value)) {
    return concat(encodeHead(4, value.length), ...value.map(encodeCbor))
  }

  let entries = [...value.entries()].flatMap(([key, entry]) => [encodeCbor(key), encodeCbor(entry)])
  return concat(encodeHead(5, value.size), ...entries)
}

function encodeHead(majorType: number, value: number): Uint8Array<ArrayBuffer> {
  let prefix = majorType << 5
  if (value < 24) {
    return new Uint8Array([prefix | value])
  }

  if (value < 0x100) {
    return new Uint8Array([prefix | 24, value])
  }

  if (value < 0x10000) {
    return new Uint8Array([prefix | 25, value >> 8, value & 0xff])
  }

  let bytes = new Uint8Array(5)
  bytes[0] = prefix | 26
  new DataView(bytes.buffer).setUint32(1, value)
  return bytes
}

function createClientData(
  type: string,
  challenge: string,
  origin: string,
  overrides: TestCeremonyOverrides,
): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(
    JSON.stringify({
      type: overrides.type ?? type,
      challenge: overrides.challenge ?? challenge,
      origin: overrides.origin ?? origin,
      crossOrigin: overrides.crossOrigin ?? false,
    }),
  )
}

async function createAuthenticatorData(
  rpId: string,
  flags: TestAuthenticatorFlags,
  signCount: number,
  attestedCredentialData?: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  let rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(rpId)))
  let flagsByte =
    (flags.userPresent ? 0x01 : 0) |
    (flags.userVerified ? 0x04 : 0) |
    (flags.backupEligible ? 0x08 : 0) |
    (flags.backedUp ? 0x10 : 0) |
    (attestedCredentialData ? 0x40 : 0)
  let counter = new Uint8Array(4)
  new DataView(counter.buffer).setUint32(0, signCount)

  return concat(
    rpIdHash,
    new Uint8Array([flagsByte]),
    counter,
    attestedCredentialData ?? new Uint8Array(),
  )
}

async function generateCredentialKey(
  algorithm: TestAuthenticatorAlgorithm,
): Promise<{ keyPair: CryptoKeyPair; coseKey: Map<number, CborEncodable> }> {
  switch (algorithm) {
    case 'ES256': {
      let keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
        'sign',
        'verify',
      ])) as CryptoKeyPair
      let jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
      return {
        keyPair,
        coseKey: new Map<number, CborEncodable>([
          [1, 2],
          [3, -7],
          [-1, 1],
          [-2, decodeBase64Url(jwk.x!)!],
          [-3, decodeBase64Url(jwk.y!)!],
        ]),
      }
    }
    case 'EdDSA': {
      let keyPair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
        'sign',
        'verify',
      ])) as CryptoKeyPair
      let publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
      return {
        keyPair,
        coseKey: new Map<number, CborEncodable>([
          [1, 1],
          [3, -8],
          [-1, 6],
          [-2, publicKey],
        ]),
      }
    }
    case 'RS256': {
      let keyPair = (await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify'],
      )) as CryptoKeyPair
      let jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
      return {
        keyPair,
        coseKey: new Map<number, CborEncodable>([
          [1, 3],
          [3, -257],
          [-1, decodeBase64Url(jwk.n!)!],
          [-2, decodeBase64Url(jwk.e!)!],
        ]),
      }
    }
  }
}

async function sign(
  algorithm: TestAuthenticatorAlgorithm,
  privateKey: CryptoKey,
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  switch (algorithm) {
    case 'ES256': {
      let signature = new Uint8Array(
        await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data),
      )
      return encodeDerSignature(signature)
    }
    case 'EdDSA':
      return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, data))
    case 'RS256':
      return new Uint8Array(
        await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, privateKey, data),
      )
  }
}

function encodeDerSignature(signature: Uint8Array): Uint8Array<ArrayBuffer> {
  let half = signature.length / 2
  let r = encodeDerInteger(signature.subarray(0, half))
  let s = encodeDerInteger(signature.subarray(half))
  return concat(new Uint8Array([0x30, r.length + s.length]), r, s)
}

function encodeDerInteger(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start++
  }

  let integer = bytes.subarray(start)
  let padded = integer[0] >= 0x80 ? concat(new Uint8Array([0]), integer) : concat(integer)
  return concat(new Uint8Array([0x02, padded.length]), padded)
}

function uint16(value: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array([value >> 8, value & 0xff])
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let bytes = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (let part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }

  return bytes
}
