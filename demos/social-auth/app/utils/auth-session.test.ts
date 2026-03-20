import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseAuthSession } from './auth-session.ts'

describe('auth session model', () => {
  it('parses a stored auth session value', () => {
    assert.deepEqual(parseAuthSession({ userId: 2, loginMethod: 'credentials' }), {
      userId: 2,
      loginMethod: 'credentials',
    })
    assert.equal(parseAuthSession({ userId: 'bad', loginMethod: 'credentials' }), null)
  })
})
