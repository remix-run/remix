import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { sanitizeReturnTo } from './utils.ts'

describe('sanitizeReturnTo()', () => {
  it('drops paths that normalize to an authority reference', () => {
    assert.equal(sanitizeReturnTo('/..//other.example'), undefined)
    assert.equal(sanitizeReturnTo('/.//other.example'), undefined)
    assert.equal(sanitizeReturnTo('/%2e%2e//other.example'), undefined)
    assert.equal(sanitizeReturnTo('/account/..//other.example'), undefined)
    assert.equal(sanitizeReturnTo('/..\\/other.example'), undefined)
    assert.equal(sanitizeReturnTo('/..//remix.local'), undefined)
  })

  it('preserves local paths, queries, fragments, and encoded path data', () => {
    assert.equal(
      sanitizeReturnTo('/account/../dashboard?tab=profile#name'),
      '/dashboard?tab=profile#name',
    )
    assert.equal(sanitizeReturnTo('/account//settings'), '/account//settings')
    assert.equal(sanitizeReturnTo('/%2Fother.example'), '/%2Fother.example')
    assert.equal(
      sanitizeReturnTo('/?next=//other.example#//section'),
      '/?next=//other.example#//section',
    )
  })
})
