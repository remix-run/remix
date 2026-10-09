import { encodeBase64Url } from '../base64url.ts'
import { decodeCbor } from './cbor.ts'
import type { CborMap, CborValue } from './cbor.ts'
import { invalidResponse, PasskeyVerificationError } from './errors.ts'

const es256 = -7
const edDSA = -8
const rs256 = -257

/**
 * COSE algorithms offered during registration, in order of preference.
 */
export const supportedCoseAlgorithms: readonly number[] = [edDSA, es256, rs256]

export interface CosePublicKey {
  algorithm: number
  key: CryptoKey
}

export async function importCosePublicKey(bytes: Uint8Array<ArrayBuffer>): Promise<CosePublicKey> {
  let coseKey: CborValue
  try {
    coseKey = decodeCbor(bytes)
  } catch {
    throw invalidResponse('Credential public key is not valid CBOR.')
  }

  if (!(coseKey instanceof Map)) {
    throw invalidResponse('Credential public key is not a COSE key.')
  }

  let algorithm = coseKey.get(3)
  if (typeof algorithm !== 'number' || !supportedCoseAlgorithms.includes(algorithm)) {
    throw new PasskeyVerificationError(
      'unsupported_algorithm',
      `Unsupported credential public key algorithm ${String(algorithm)}.`,
    )
  }

  let key: CryptoKey
  try {
    key = await importKey(coseKey, algorithm)
  } catch (error) {
    if (error instanceof PasskeyVerificationError) {
      throw error
    }

    throw invalidResponse('Credential public key could not be imported.')
  }

  return { algorithm, key }
}

export async function verifyCoseSignature(
  publicKey: CosePublicKey,
  signature: Uint8Array<ArrayBuffer>,
  data: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  switch (publicKey.algorithm) {
    case es256: {
      let rawSignature = convertDerSignature(signature, 32)
      if (rawSignature == null) {
        return false
      }

      return crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey.key,
        rawSignature,
        data,
      )
    }
    case edDSA:
      return crypto.subtle.verify({ name: 'Ed25519' }, publicKey.key, signature, data)
    case rs256:
      return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, publicKey.key, signature, data)
    default:
      return false
  }
}

async function importKey(coseKey: CborMap, algorithm: number): Promise<CryptoKey> {
  let keyType = coseKey.get(1)

  switch (algorithm) {
    case es256: {
      let x = coseKey.get(-2)
      let y = coseKey.get(-3)
      if (keyType !== 2 || coseKey.get(-1) !== 1 || !isBytes(x, 32) || !isBytes(y, 32)) {
        throw invalidResponse('ES256 credential public key must be an uncompressed P-256 key.')
      }

      let point = new Uint8Array(65)
      point[0] = 0x04
      point.set(x, 1)
      point.set(y, 33)

      return crypto.subtle.importKey('raw', point, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'verify',
      ])
    }
    case edDSA: {
      let x = coseKey.get(-2)
      if (keyType !== 1 || !isBytes(x, 32)) {
        throw invalidResponse('EdDSA credential public key must be an OKP key.')
      }

      // COSE curve 6 is Ed25519. Ed448 is not supported by Web Crypto.
      if (coseKey.get(-1) !== 6) {
        throw new PasskeyVerificationError(
          'unsupported_algorithm',
          'Only Ed25519 EdDSA credential public keys are supported.',
        )
      }

      return crypto.subtle.importKey('raw', x, { name: 'Ed25519' }, false, ['verify'])
    }
    case rs256: {
      let modulus = coseKey.get(-1)
      let exponent = coseKey.get(-2)
      if (keyType !== 3 || !isBytes(modulus) || !isBytes(exponent)) {
        throw invalidResponse('RS256 credential public key must be an RSA key.')
      }

      // Bound key sizes so registrations cannot store weak keys or keys that are slow to verify.
      if (modulus.length < 256 || modulus.length > 512 || modulus[0] === 0) {
        throw invalidResponse('RS256 credential public key must be 2048 to 4096 bits.')
      }

      if (exponent.length > 4 || (exponent[exponent.length - 1] & 1) === 0) {
        throw invalidResponse('RS256 credential public key has an invalid exponent.')
      }

      return crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n: encodeBase64Url(modulus), e: encodeBase64Url(exponent) },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      )
    }
    default:
      throw new PasskeyVerificationError(
        'unsupported_algorithm',
        `Unsupported credential public key algorithm ${algorithm}.`,
      )
  }
}

function isBytes(value: CborValue | undefined, length?: number): value is Uint8Array<ArrayBuffer> {
  return (
    value instanceof Uint8Array && value.length > 0 && (length == null || value.length === length)
  )
}

// WebAuthn ECDSA signatures are ASN.1 DER `SEQUENCE { r INTEGER, s INTEGER }`, while Web Crypto
// expects the fixed-width `r || s` encoding.
function convertDerSignature(
  signature: Uint8Array<ArrayBuffer>,
  componentLength: number,
): Uint8Array<ArrayBuffer> | null {
  if (signature.length < 8 || signature[0] !== 0x30 || signature[1] !== signature.length - 2) {
    return null
  }

  let raw = new Uint8Array(componentLength * 2)
  let offset = 2

  for (let index = 0; index < 2; index++) {
    if (signature[offset] !== 0x02) {
      return null
    }

    let length = signature[offset + 1]
    let start = offset + 2
    let end = start + length
    if (length === 0 || end > signature.length) {
      return null
    }

    let integer = signature.subarray(start, end)
    while (integer.length > 1 && integer[0] === 0) {
      integer = integer.subarray(1)
    }

    if (integer.length > componentLength) {
      return null
    }

    raw.set(integer, componentLength * (index + 1) - integer.length)
    offset = end
  }

  return offset === signature.length ? raw : null
}
