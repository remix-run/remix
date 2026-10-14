import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { decodeCbor, decodeCborItem } from './cbor.ts'
import { encodeCbor } from './test-authenticator.ts'
import type { CborEncodable } from './test-authenticator.ts'

function bytes(...values: number[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(values)
}

describe('decodeCbor()', () => {
  it('decodes integers of every width', () => {
    assert.equal(decodeCbor(bytes(0x17)), 23)
    assert.equal(decodeCbor(bytes(0x18, 0xff)), 255)
    assert.equal(decodeCbor(bytes(0x19, 0x01, 0x00)), 256)
    assert.equal(decodeCbor(bytes(0x1a, 0x00, 0x01, 0x00, 0x00)), 65536)
    assert.equal(decodeCbor(bytes(0x1b, 0, 0, 0, 1, 0, 0, 0, 0)), 4294967296)
    assert.equal(decodeCbor(bytes(0x26)), -7)
    assert.equal(decodeCbor(bytes(0x39, 0x01, 0x00)), -257)
  })

  it('decodes strings, arrays, maps, and simple values', () => {
    let value = decodeCbor(
      encodeCbor(
        new Map<number | string, CborEncodable>([
          ['fmt', 'none'],
          [1, new Uint8Array([1, 2, 3])],
          [-1, [true, false, null]],
        ]),
      ),
    )

    assert.ok(value instanceof Map)
    assert.equal(value.get('fmt'), 'none')
    assert.deepEqual(value.get(1), new Uint8Array([1, 2, 3]))
    assert.deepEqual(value.get(-1), [true, false, null])
  })

  it('rejects trailing bytes', () => {
    assert.throws(() => decodeCbor(bytes(0x01, 0x02)), /trailing bytes/)
  })

  it('rejects truncated input', () => {
    assert.throws(() => decodeCbor(bytes(0x19, 0x01)), /Unexpected end/)
    assert.throws(() => decodeCbor(bytes(0x43, 0x01)), /Unexpected end/)
    assert.throws(() => decodeCbor(bytes(0x9a, 0xff, 0xff, 0xff, 0xff)), /Unexpected end/)
  })

  it('rejects indefinite lengths, tags, and floats', () => {
    assert.throws(() => decodeCbor(bytes(0x9f, 0xff)), /Indefinite-length/)
    assert.throws(() => decodeCbor(bytes(0xc0, 0x00)), /tags/)
    assert.throws(() => decodeCbor(bytes(0xf9, 0x00, 0x00)), /simple value/)
  })

  it('rejects duplicate and non-scalar map keys', () => {
    assert.throws(() => decodeCbor(bytes(0xa2, 0x01, 0x00, 0x01, 0x00)), /duplicate key/)
    assert.throws(() => decodeCbor(bytes(0xa1, 0x80, 0x00)), /map keys/)
  })

  it('rejects deeply nested input', () => {
    let nested = new Uint8Array(32).fill(0x81)

    assert.throws(() => decodeCbor(nested), /nested too deeply/)
  })

  it('rejects integers beyond the safe integer range', () => {
    assert.throws(
      () => decodeCbor(bytes(0x1b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff)),
      /safe integer/,
    )
  })

  it('rejects invalid UTF-8 text', () => {
    assert.throws(() => decodeCbor(bytes(0x61, 0xff)))
  })
})

describe('decodeCborItem()', () => {
  it('reports where an embedded item ends', () => {
    let data = bytes(0xff, 0x82, 0x01, 0x02, 0xaa)

    assert.deepEqual(decodeCborItem(data, 1), { value: [1, 2], offset: 4 })
  })
})
