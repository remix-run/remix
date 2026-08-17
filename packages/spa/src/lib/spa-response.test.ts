import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { spaResponse } from '@remix-run/ui'

describe('spaResponse', () => {
  it('rejects use outside a browser environment', () => {
    assert.throws(
      () => spaResponse.create('Hello'),
      new TypeError('spaResponse.create() can only be used in a browser'),
    )
  })
})
