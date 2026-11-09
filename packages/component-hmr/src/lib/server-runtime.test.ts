import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  getCurrentComponentForHmr,
  getStableComponentForHmr,
  registerComponentForHmr,
} from './server-runtime.ts'

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

  it('keeps the public wrapper stable while updating its implementation', () => {
    function firstWrapper() {}
    function secondWrapper() {}
    function firstImplementation() {
      return () => 'first'
    }
    function secondImplementation() {
      return () => 'second'
    }

    let stable = getStableComponentForHmr('/app/component.tsx', 'Component', firstWrapper)
    registerComponentForHmr('/app/component.tsx', 'Component', firstImplementation)
    let updated = getStableComponentForHmr('/app/component.tsx', 'Component', secondWrapper)
    registerComponentForHmr('/app/component.tsx', 'Component', secondImplementation)

    assert.equal(updated, stable)
    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), secondImplementation)
  })

  it('throws when a component has not been registered', () => {
    assert.throws(
      () => getCurrentComponentForHmr('/app/missing.tsx', 'Missing'),
      /Missing HMR component registration for \/app\/missing\.tsx:Missing/,
    )
  })
})
