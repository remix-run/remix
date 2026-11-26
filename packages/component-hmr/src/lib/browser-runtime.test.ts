import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import {
  callComponentRenderForHmr,
  commitComponentModuleForHmr,
  type ComponentHmrRefresh,
  getComponentHandleForHmr,
  getComponentHmrState,
  getCurrentComponentForHmr,
  registerComponentForHmr,
  registerComponentRenderForHmr,
  setupComponentForHmr,
  updateComponentModuleForHmr,
} from './browser-runtime.ts'

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
    commitComponentModuleForHmr([Component])
    registerComponentForHmr(refresh, '/app/component.tsx', 'Component', second, 'h1', Component)
    commitComponentModuleForHmr([Component])

    assert.equal(getCurrentComponentForHmr('/app/component.tsx', 'Component'), second)
  })

  it('accepts component module update notifications', () => {
    function Component() {
      return () => 'component'
    }

    registerComponentForHmr(refresh, '/app/update.tsx', 'Component', Component, 'h1', Component)
    commitComponentModuleForHmr([Component])
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
    commitComponentModuleForHmr([Component])
    registerComponentForHmr(refresh, '/app/stale.tsx', 'Component', second, 'h1', Component)
    commitComponentModuleForHmr([Component])

    assert.equal(componentStalenessCheck?.(Component), false)

    updateComponentModuleForHmr(refresh, '/app/stale.tsx', { Component })

    assert.equal(getCurrentComponentForHmr('/app/stale.tsx', 'Component'), second)
    assert.equal(componentStalenessCheck?.(Component), false)

    await new Promise<void>((resolve) => queueMicrotask(resolve))

    assert.equal(componentStalenessCheck?.(Component), false)
  })

  it('rejects missing component handles', () => {
    assert.throws(
      () => getComponentHandleForHmr(undefined, '/app/server.tsx', 'Greeting'),
      /Expected HMR component handle for \/app\/server\.tsx:Greeting/,
    )
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

  it('tracks component renders by handle', () => {
    function Greeting() {
      return () => 'hello'
    }

    let handle = getComponentHandleForHmr(createTestHandle(), '/app/render.tsx', 'Greeting')
    registerComponentForHmr(refresh, '/app/render.tsx', 'Greeting', Greeting, 'h1', Greeting)
    commitComponentModuleForHmr([Greeting])
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

describe('component HMR publication', () => {
  it('keeps implementation and setup changes private until publication', () => {
    let url = '/app/publication.tsx'
    function first() {}
    function second() {}
    function oldWrapper() {}
    function nextWrapper() {}
    registerComponentForHmr(refresh, url, 'Component', first, 'h1', oldWrapper)
    assert.throws(() => getCurrentComponentForHmr(url, 'Component'), /Missing HMR component/)
    assert.equal(getCurrentComponentForHmr(url, 'Component', oldWrapper), first)
    commitComponentModuleForHmr([oldWrapper])
    registerComponentForHmr(refresh, url, 'Component', second, 'h2', nextWrapper)
    assert.equal(getCurrentComponentForHmr(url, 'Component', oldWrapper), first)
    assert.equal(getCurrentComponentForHmr(url, 'Component', nextWrapper), second)
    assert.equal(componentStalenessCheck?.(oldWrapper), false)
    commitComponentModuleForHmr([nextWrapper])
    assert.equal(getCurrentComponentForHmr(url, 'Component', oldWrapper), second)
    assert.equal(componentStalenessCheck?.(oldWrapper), true)
    // Repeating an older module's publication must not restore an obsolete implementation.
    commitComponentModuleForHmr([oldWrapper])
    assert.equal(getCurrentComponentForHmr(url, 'Component'), second)
    updateComponentModuleForHmr(refresh, url, { Component: nextWrapper })
  })

  it('keeps aborted pending handles out of updates before and after publication', () => {
    let url = '/app/pending-disposal.tsx'
    function initial() {}
    function replacement() {}
    registerComponentForHmr(refresh, url, 'Component', initial, 'h1', initial)
    commitComponentModuleForHmr([initial])
    let old = new AbortController()
    let pending = new AbortController()
    let live = new AbortController()
    let oldHandle = { signal: old.signal }
    let pendingHandle = { signal: pending.signal }
    let liveHandle = { signal: live.signal }
    registerComponentRenderForHmr(refresh, url, 'Component', oldHandle, () => 'old', initial)
    registerComponentForHmr(refresh, url, 'Component', replacement, 'h1', replacement)
    registerComponentRenderForHmr(
      refresh,
      url,
      'Component',
      pendingHandle,
      () => 'pending',
      replacement,
    )
    registerComponentRenderForHmr(refresh, url, 'Component', liveHandle, () => 'live', replacement)
    let updated: unknown[] = []
    function Component(handle: unknown) {
      updated.push(handle)
    }
    updateComponentModuleForHmr(refresh, url, { Component })
    assert.deepEqual(updated, [oldHandle])
    pending.abort()
    assert.throws(() => callComponentRenderForHmr(pendingHandle), /Missing HMR component render/)
    commitComponentModuleForHmr([replacement])
    updated.length = 0
    updateComponentModuleForHmr(refresh, url, { Component })
    assert.deepEqual(updated, [oldHandle, liveHandle])
    old.abort()
    live.abort()
    updated.length = 0
    updateComponentModuleForHmr(refresh, url, { Component })
    assert.deepEqual(updated, [])
  })

  it('does not track handles belonging to an unpublished replacement as working instances', () => {
    let url = '/app/rejected-handles.tsx'
    function working() {}
    function rejected() {}
    function recovered() {}
    registerComponentForHmr(refresh, url, 'Component', working, 'h1', working)
    commitComponentModuleForHmr([working])
    registerComponentForHmr(refresh, url, 'Component', rejected, 'h1', rejected)
    let controller = new AbortController()
    let handle = { signal: controller.signal }
    registerComponentRenderForHmr(refresh, url, 'Component', handle, () => 'rejected', rejected)
    registerComponentForHmr(refresh, url, 'Component', recovered, 'h1', recovered)
    commitComponentModuleForHmr([recovered])
    let calls = 0
    updateComponentModuleForHmr(refresh, url, {
      Component() {
        calls++
      },
    })
    assert.equal(calls, 0)
    controller.abort()
    assert.throws(() => callComponentRenderForHmr(handle), /Missing HMR component render/)
  })
})
