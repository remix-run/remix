import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { navigation } from './navigation.ts'

describe('navigation on the server', () => {
  it('is unsupported and settles without browser globals', async () => {
    assert.equal(navigation.supported, false)
    assert.equal(navigation.current, null)
    await navigation.settled()
  })
})
