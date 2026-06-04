import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  callComponentRenderForHmr,
  getComponentHandleForHmr,
  getComponentHmrState,
  getCurrentComponentForHmr,
  registerComponentForHmr,
  registerComponentRenderForHmr,
  updateComponentModuleForHmr,
} from './runtime.ts'
import { componentStalenessCheck } from '../../../ui/src/runtime/refresh.ts'

describe('component HMR runtime', () => {
  it('returns the latest registered component implementation', () => {
    function first() {
      return () => 'first'
    }
    function second() {
      return () => 'second'
    }
    function Component() {
      return () => 'wrapper'
    }

    registerComponentForHmr('/app/component.tsx', 'Component', first, 'h1', Component)
    registerComponentForHmr('/app/component.tsx', 'Component', second, 'h1', Component)

    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), second)
  })

  it('accepts component module update notifications', () => {
    function Component() {
      return () => 'component'
    }

    registerComponentForHmr('/app/update.tsx', 'Component', Component, 'h1', Component)
    updateComponentModuleForHmr('/app/update.tsx', { Component })

    assert.equal(getCurrentComponentForHmr('/app/update.tsx', 'Component'), Component)
  })

  it('does not mark accepted component exports stale when setup is unchanged', async () => {
    function first() {
      return () => 'first'
    }
    function second() {
      return () => 'second'
    }
    function Component() {
      return () => 'wrapper'
    }

    registerComponentForHmr('/app/stale.tsx', 'Component', first, 'h1', Component)
    registerComponentForHmr('/app/stale.tsx', 'Component', second, 'h1', Component)

    assert.equal(componentStalenessCheck?.(Component), false)

    updateComponentModuleForHmr('/app/stale.tsx', { Component })

    assert.equal(getCurrentComponentForHmr('/app/stale.tsx', 'Component'), second)
    assert.equal(componentStalenessCheck?.(Component), false)

    await new Promise<void>((resolve) => queueMicrotask(resolve))

    assert.equal(componentStalenessCheck?.(Component), false)
  })

  it('creates a stable HMR handle for server-rendered components without UI handles', () => {
    let handle = getComponentHandleForHmr(undefined, '/app/server.tsx', 'Greeting')
    let nextHandle = getComponentHandleForHmr(undefined, '/app/server.tsx', 'Greeting')

    assert.equal(nextHandle, handle)

    let state = getComponentHmrState(handle)
    state.message = 'hello'

    assert.equal(getComponentHmrState(nextHandle).message, 'hello')
  })

  it('tracks server-rendered component renders without UI handles', () => {
    function Greeting() {
      return () => 'hello'
    }

    let handle = getComponentHandleForHmr(undefined, '/app/render.tsx', 'Greeting')
    registerComponentForHmr('/app/render.tsx', 'Greeting', Greeting, 'h1', Greeting)
    registerComponentRenderForHmr('/app/render.tsx', 'Greeting', handle, () => 'hello', Greeting)

    assert.equal(callComponentRenderForHmr(handle), 'hello')

    function UpdatedGreeting() {
      return () => 'updated'
    }

    updateComponentModuleForHmr('/app/render.tsx', { Greeting: UpdatedGreeting })
    registerComponentRenderForHmr('/app/render.tsx', 'Greeting', handle, () => 'updated', Greeting)

    assert.equal(callComponentRenderForHmr(handle), 'updated')
  })
})
