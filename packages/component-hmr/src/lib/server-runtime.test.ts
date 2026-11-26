import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  commitComponentModuleForHmr,
  getCurrentComponentForHmr,
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

    registerComponentForHmr('/app/component.tsx', 'Component', first, first)
    commitComponentModuleForHmr([first])
    registerComponentForHmr('/app/component.tsx', 'Component', second, second)
    commitComponentModuleForHmr([second])

    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), second)
  })

  it('throws when a component has not been registered', () => {
    assert.throws(
      () => getCurrentComponentForHmr('/app/missing.tsx', 'Missing'),
      /Missing HMR component registration for \/app\/missing\.tsx:Missing/,
    )
  })
})

describe('server component HMR publication', () => {
  it('only exposes unpublished implementations to their own wrappers', () => {
    let url = '/app/publication.tsx'
    function first() {}
    function second() {}
    registerComponentForHmr(url, 'Component', first, first)
    assert.throws(() => getCurrentComponentForHmr(url, 'Component'), /Missing HMR component/)
    assert.equal(getCurrentComponentForHmr(url, 'Component', first), first)
    commitComponentModuleForHmr([first])
    registerComponentForHmr(url, 'Component', second, second)
    assert.equal(getCurrentComponentForHmr(url, 'Component', first), first)
    assert.equal(getCurrentComponentForHmr(url, 'Component', second), second)
    commitComponentModuleForHmr([second])
    assert.equal(getCurrentComponentForHmr(url, 'Component', first), second)
    commitComponentModuleForHmr([first])
    assert.equal(getCurrentComponentForHmr(url, 'Component'), second)
  })
})
