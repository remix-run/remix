import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getCurrentComponentForHmr, registerComponentForHmr } from './server-runtime.ts'

describe('server component HMR runtime', () => {
  it('returns the latest registered component implementation', () => {
    function first() {
      return () => 'first'
    }
    function second() {
      return () => 'second'
    }

    registerComponentForHmr('/app/component.tsx', 'Component', first)
    registerComponentForHmr('/app/component.tsx', 'Component', second)

    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), second)
  })

  it('throws when a component has not been registered', () => {
    assert.throws(
      () => getCurrentComponentForHmr('/app/missing.tsx', 'Missing'),
      /Missing HMR component registration for \/app\/missing\.tsx:Missing/,
    )
  })
})
