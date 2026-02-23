import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ensure, invariant } from './invariant.ts'

describe('invariant helpers', () => {
  it('allows truthy assertions', () => {
    invariant(true, 'should not throw')
    ensure(123, true)
  })

  it('throws for failed framework/application assertions', () => {
    assert.throws(
      () => {
        invariant(false, 'broken')
      },
      { message: 'Framework invariant: broken' },
    )
    assert.throws(
      () => {
        invariant(false)
      },
      { message: 'Framework invariant' },
    )
    assert.throws(
      () => {
        ensure(42, false)
      },
      { message: 'REMIX_42: https://rmx.as/w/42' },
    )
  })
})
