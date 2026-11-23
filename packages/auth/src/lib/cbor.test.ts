import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { decodeCBOR, decodeCBORItem } from './cbor.ts'
import { encodeCBOR } from './test-utils.ts'

describe('decodeCBOR()', () => {
  it('decodes integers, strings, byte strings, arrays, maps, and simple values', () => {
    let decoded = decodeCBOR(
      encodeCBOR(
        new Map<any, any>([
          [1, 2],
          [-1, -300],
          ['text', 'héllo'],
          ['bytes', new Uint8Array([1, 2, 3])],
          ['list', [true, false, null, 70000]],
        ]),
      ),
    )

    assert.deepEqual(
      decoded,
      new Map<unknown, unknown>([
        [1, 2],
        [-1, -300],
        ['text', 'héllo'],
        ['bytes', new Uint8Array([1, 2, 3])],
        ['list', [true, false, null, 70000]],
      ]),
    )
  })

  it('rejects trailing bytes', () => {
    assert.throws(() => decodeCBOR(new Uint8Array([0x01, 0x02])), {
      message: 'Unexpected trailing bytes after CBOR data.',
    })
  })

  it('rejects truncated data', () => {
    assert.throws(() => decodeCBOR(new Uint8Array([0x43, 0x01])), {
      message: 'Unexpected end of CBOR data.',
    })
  })

  it('rejects indefinite-length items', () => {
    assert.throws(() => decodeCBOR(new Uint8Array([0x5f, 0xff])), {
      message: 'Unsupported CBOR length encoding.',
    })
  })

  it('rejects tags', () => {
    assert.throws(() => decodeCBOR(new Uint8Array([0xc1, 0x00])), {
      message: 'Unsupported CBOR tag.',
    })
  })

  it('rejects duplicate map keys', () => {
    assert.throws(() => decodeCBOR(new Uint8Array([0xa2, 0x01, 0x01, 0x01, 0x02])), {
      message: 'Duplicate CBOR map key.',
    })
  })
})

describe('decodeCBORItem()', () => {
  it('reports how many bytes the first item used', () => {
    let result = decodeCBORItem(new Uint8Array([0x82, 0x01, 0x02, 0xff, 0xff]))

    assert.deepEqual(result, { value: [1, 2], length: 3 })
  })
})
