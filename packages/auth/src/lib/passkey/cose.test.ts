import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { importCosePublicKey, verifyCoseSignature } from './cose.ts'
import { PasskeyVerificationError } from './errors.ts'
import { encodeCbor } from './test-authenticator.ts'
import type { CborEncodable } from './test-authenticator.ts'

async function rejection(promise: Promise<unknown>): Promise<PasskeyVerificationError> {
  try {
    await promise
  } catch (error) {
    assert.ok(error instanceof PasskeyVerificationError)
    return error
  }

  throw new Error('Expected promise to reject')
}

async function createES256Key() {
  let keyPair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  let raw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
  let publicKey = await importCosePublicKey(
    encodeCbor(
      new Map<number, CborEncodable>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, raw.slice(1, 33)],
        [-3, raw.slice(33)],
      ]),
    ),
  )

  return { keyPair, publicKey }
}

describe('importCosePublicKey()', () => {
  it('rejects bytes that are not a COSE key map', async () => {
    let error = await rejection(importCosePublicKey(encodeCbor([1, 2, 3])))

    assert.equal(error.code, 'invalid_response')
  })

  it('rejects Ed448 keys', async () => {
    let error = await rejection(
      importCosePublicKey(
        encodeCbor(
          new Map<number, CborEncodable>([
            [1, 1],
            [3, -8],
            [-1, 7],
            [-2, new Uint8Array(32)],
          ]),
        ),
      ),
    )

    assert.equal(error.code, 'unsupported_algorithm')
  })

  it('rejects keys whose type does not match the algorithm', async () => {
    let error = await rejection(
      importCosePublicKey(
        encodeCbor(
          new Map<number, CborEncodable>([
            [1, 3],
            [3, -7],
            [-1, new Uint8Array(256)],
            [-2, new Uint8Array([1, 0, 1])],
          ]),
        ),
      ),
    )

    assert.equal(error.code, 'invalid_response')
  })
  it('rejects RSA keys outside 2048 to 4096 bits', async () => {
    let error = await rejection(
      importCosePublicKey(
        encodeCbor(
          new Map<number, CborEncodable>([
            [1, 3],
            [3, -257],
            [-1, new Uint8Array(128).fill(0xff)],
            [-2, new Uint8Array([1, 0, 1])],
          ]),
        ),
      ),
    )

    assert.equal(error.code, 'invalid_response')
    assert.match(error.message, /2048 to 4096 bits/)
  })

  it('rejects RSA keys with even or oversized exponents', async () => {
    let error = await rejection(
      importCosePublicKey(
        encodeCbor(
          new Map<number, CborEncodable>([
            [1, 3],
            [3, -257],
            [-1, new Uint8Array(256).fill(0xff)],
            [-2, new Uint8Array([1, 0, 0])],
          ]),
        ),
      ),
    )

    assert.equal(error.code, 'invalid_response')
    assert.match(error.message, /invalid exponent/)
  })
})

describe('verifyCoseSignature()', () => {
  it('verifies DER-encoded ECDSA signatures', async () => {
    let { keyPair, publicKey } = await createES256Key()
    let data = new TextEncoder().encode('signed data')
    let raw = new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, data),
    )
    let der = encodeDer(raw)

    assert.equal(await verifyCoseSignature(publicKey, der, data), true)
    assert.equal(await verifyCoseSignature(publicKey, raw, data), false)
  })

  it('rejects malformed DER signatures', async () => {
    let { publicKey } = await createES256Key()
    let data = new TextEncoder().encode('signed data')

    assert.equal(await verifyCoseSignature(publicKey, new Uint8Array([0x30, 0x00]), data), false)
    assert.equal(
      await verifyCoseSignature(
        publicKey,
        new Uint8Array([0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x02, 0x01]),
        data,
      ),
      false,
    )
    assert.equal(
      await verifyCoseSignature(
        publicKey,
        new Uint8Array([0x30, 0x26, 0x02, 0x21, ...new Array(33).fill(1), 0x02, 0x01, 0x01]),
        data,
      ),
      false,
    )
  })
})

function encodeDer(raw: Uint8Array): Uint8Array<ArrayBuffer> {
  let integers = [raw.subarray(0, 32), raw.subarray(32)].map((integer) => {
    let start = 0
    while (start < integer.length - 1 && integer[start] === 0) start++
    let trimmed = [...integer.subarray(start)]
    if (trimmed[0] >= 0x80) trimmed.unshift(0)
    return [0x02, trimmed.length, ...trimmed]
  })
  let body = integers.flat()
  return new Uint8Array([0x30, body.length, ...body])
}
