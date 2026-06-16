import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  callComponentRenderForHmr,
  type ComponentHmrRefresh,
  getComponentHandleForHmr,
  getComponentHmrState,
  getCurrentComponentForHmr,
  registerComponentForHmr,
  registerComponentRenderForHmr,
  setupComponentForHmr,
  updateComponentModuleForHmr,
} from './runtime.ts'

let componentStalenessCheck: ((component: Function) => boolean) | undefined
let reconciliationCount = 0

const refresh: ComponentHmrRefresh = {
  reconcileRoots() {
    reconciliationCount++
  },
  setComponentStalenessCheck(check) {
    componentStalenessCheck = check
  },
}

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

    registerComponentForHmr(refresh, '/app/component.tsx', 'Component', first, 'h1', Component)
    registerComponentForHmr(refresh, '/app/component.tsx', 'Component', second, 'h1', Component)

    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), second)
  })

  it('accepts component module update notifications', () => {
    function Component() {
      return () => 'component'
    }

    registerComponentForHmr(refresh, '/app/update.tsx', 'Component', Component, 'h1', Component)
    updateComponentModuleForHmr(refresh, '/app/update.tsx', { Component })

    assert.equal(getCurrentComponentForHmr('/app/update.tsx', 'Component'), Component)
    assert.equal(reconciliationCount, 1)
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

    registerComponentForHmr(refresh, '/app/stale.tsx', 'Component', first, 'h1', Component)
    registerComponentForHmr(refresh, '/app/stale.tsx', 'Component', second, 'h1', Component)

    assert.equal(componentStalenessCheck?.(Component), false)

    updateComponentModuleForHmr(refresh, '/app/stale.tsx', { Component })

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

  it('runs setup once for each component handle', () => {
    let firstHandle = createTestHandle()
    let secondHandle = createTestHandle()
    let firstState = getComponentHmrState(firstHandle)
    let secondState = getComponentHmrState(secondHandle)

    function Component() {
      return () => 'component'
    }

    assert.equal(
      setupComponentForHmr(
        firstHandle,
        firstState,
        '/app/setup.tsx',
        'Component',
        'h1',
        (state) => {
          state.value = 'first'
        },
        Component,
      ),
      false,
    )
    assert.equal(
      setupComponentForHmr(
        secondHandle,
        secondState,
        '/app/setup.tsx',
        'Component',
        'h1',
        (state) => {
          state.value = 'second'
        },
        Component,
      ),
      false,
    )

    assert.equal(firstState.value, 'first')
    assert.equal(secondState.value, 'second')
  })

  it('runs changed setup for every remounted component handle', () => {
    let firstHandle = createTestHandle()
    let secondHandle = createTestHandle()

    function Component() {
      return () => 'component'
    }

    setupComponentForHmr(
      firstHandle,
      getComponentHmrState(firstHandle),
      '/app/remount.tsx',
      'Component',
      'h1',
      (state) => {
        state.value = 'before'
      },
      Component,
    )
    setupComponentForHmr(
      secondHandle,
      getComponentHmrState(secondHandle),
      '/app/remount.tsx',
      'Component',
      'h1',
      (state) => {
        state.value = 'before'
      },
      Component,
    )

    assert.equal(
      setupComponentForHmr(
        firstHandle,
        getComponentHmrState(firstHandle),
        '/app/remount.tsx',
        'Component',
        'h2',
        (state) => {
          state.value = 'stale'
        },
        Component,
      ),
      true,
    )
    assert.equal(
      setupComponentForHmr(
        secondHandle,
        getComponentHmrState(secondHandle),
        '/app/remount.tsx',
        'Component',
        'h2',
        (state) => {
          state.value = 'stale'
        },
        Component,
      ),
      true,
    )

    let remountedFirstHandle = createTestHandle()
    let remountedSecondHandle = createTestHandle()
    let remountedFirstState = getComponentHmrState(remountedFirstHandle)
    let remountedSecondState = getComponentHmrState(remountedSecondHandle)

    setupComponentForHmr(
      remountedFirstHandle,
      remountedFirstState,
      '/app/remount.tsx',
      'Component',
      'h2',
      (state) => {
        state.value = 'after first'
      },
      Component,
    )
    setupComponentForHmr(
      remountedSecondHandle,
      remountedSecondState,
      '/app/remount.tsx',
      'Component',
      'h2',
      (state) => {
        state.value = 'after second'
      },
      Component,
    )

    assert.equal(remountedFirstState.value, 'after first')
    assert.equal(remountedSecondState.value, 'after second')
  })

  it('tracks server-rendered component renders without UI handles', () => {
    function Greeting() {
      return () => 'hello'
    }

    let handle = getComponentHandleForHmr(undefined, '/app/render.tsx', 'Greeting')
    registerComponentForHmr(refresh, '/app/render.tsx', 'Greeting', Greeting, 'h1', Greeting)
    registerComponentRenderForHmr(
      refresh,
      '/app/render.tsx',
      'Greeting',
      handle,
      () => 'hello',
      Greeting,
    )

    assert.equal(callComponentRenderForHmr(handle), 'hello')

    function UpdatedGreeting() {
      return () => 'updated'
    }

    updateComponentModuleForHmr(refresh, '/app/render.tsx', { Greeting: UpdatedGreeting })
    registerComponentRenderForHmr(
      refresh,
      '/app/render.tsx',
      'Greeting',
      handle,
      () => 'updated',
      Greeting,
    )

    assert.equal(callComponentRenderForHmr(handle), 'updated')
  })
})

function createTestHandle(): { signal: AbortSignal } {
  return { signal: new AbortController().signal }
}
