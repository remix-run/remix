import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { fromBase64Url, toBase64Url } from './base64url.ts'

describe('base64url', () => {
  it('round-trips bytes of every padding length', () => {
    let bytes = new Uint8Array([0xfb, 0xff, 0x00, 0x10, 0x83])

    assert.equal(toBase64Url(bytes), Buffer.from(bytes).toString('base64url'))
    assert.equal(
      toBase64Url(bytes.subarray(0, 4)),
      Buffer.from(bytes.subarray(0, 4)).toString('base64url'),
    )
    assert.equal(
      toBase64Url(bytes.subarray(0, 3)),
      Buffer.from(bytes.subarray(0, 3)).toString('base64url'),
    )
    assert.deepEqual(fromBase64Url(toBase64Url(bytes)), bytes)
    assert.deepEqual(fromBase64Url(toBase64Url(bytes.subarray(0, 4))), bytes.subarray(0, 4))
    assert.deepEqual(fromBase64Url(''), new Uint8Array())
  })

  it('rejects characters outside the base64url alphabet', () => {
    assert.throws(() => fromBase64Url('ab+/'), { message: 'Invalid base64url value.' })
  })

  it('rejects padding', () => {
    assert.throws(() => fromBase64Url('AA=='), { message: 'Invalid base64url value.' })
  })

  it('rejects non-canonical trailing bits', () => {
    assert.throws(() => fromBase64Url('AB'), { message: 'Invalid base64url value.' })
  })
})
