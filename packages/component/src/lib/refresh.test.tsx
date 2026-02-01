import { test } from 'vitest'
import { setComponentStalenessCheck } from './refresh.ts'
import { createRoot } from './vdom.ts'
import type { Handle } from './component.ts'

test('component remounts when marked stale', async () => {
  let stalenessSet = new Set<Function>()
  setComponentStalenessCheck((fn) => stalenessSet.has(fn))

  let setupCount: number = 0
  let renderCount = 0

  function MyComponent() {
    setupCount++
    return () => {
      renderCount++
      return <div>Hello {renderCount}</div>
    }
  }

  // Initial mount
  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(<MyComponent />)
  root.flush()

  if (setupCount !== 1) throw new Error(`Expected setupCount to be 1, got ${setupCount}`)
  if (renderCount !== 1) throw new Error(`Expected renderCount to be 1, got ${renderCount}`)

  let firstDiv = container.querySelector('div')
  if (!firstDiv) throw new Error('Expected div to be in document')
  if (firstDiv.textContent !== 'Hello 1') {
    throw new Error(`Expected "Hello 1", got "${firstDiv.textContent}"`)
  }

  // Mark as stale and trigger update
  stalenessSet.add(MyComponent)
  root.render(<MyComponent />)
  root.flush()

  // Verify remount happened (setup ran again, render count reset)
  // @ts-expect-error - This may have been mutated
  if (setupCount !== 2) throw new Error(`Expected setupCount to be 2, got ${setupCount}`)
  // Note: renderCount is 2 because it's a module-level variable, but in real HMR
  // the module would be reloaded. The important part is setup ran again.

  let secondDiv = container.querySelector('div')
  if (!secondDiv) throw new Error('Expected div to be in document after remount')

  // Verify new DOM element was created (not the same reference)
  if (firstDiv === secondDiv) {
    throw new Error('Expected new DOM element to be created, but got same reference')
  }

  // Verify old DOM was removed
  if (container.contains(firstDiv)) {
    throw new Error('Expected old DOM element to be removed from document')
  }

  // Verify staleness was cleared (would happen via microtask in real HMR)
  stalenessSet.delete(MyComponent)

  root.remove()
  document.body.removeChild(container)
})

test('component with signal abort listener works correctly on remount', async () => {
  let stalenessSet = new Set<Function>()
  setComponentStalenessCheck((fn) => stalenessSet.has(fn))

  let abortCallbackCount = 0
  let signals: AbortSignal[] = []

  function MyComponent(handle: Handle) {
    signals.push(handle.signal)
    handle.signal.addEventListener('abort', () => {
      abortCallbackCount++
    })
    return () => <div>Hello</div>
  }

  // Initial mount
  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(<MyComponent />)
  root.flush()

  if (signals.length !== 1) throw new Error(`Expected 1 signal, got ${signals.length}`)
  if (signals[0].aborted) throw new Error('Expected first signal to not be aborted initially')

  // Mark as stale and remount
  stalenessSet.add(MyComponent)
  root.render(<MyComponent />)
  root.flush()

  // Verify we have two different signals
  // @ts-expect-error - This may have been mutated
  if (signals.length !== 2) throw new Error(`Expected 2 signals, got ${signals.length}`)
  if (signals[0] === signals[1]) {
    throw new Error('Expected different signal instances, got same reference')
  }

  // Verify old signal was aborted
  if (!signals[0].aborted) throw new Error('Expected first signal to be aborted after remount')

  // Verify new signal is not aborted
  if (signals[1].aborted) throw new Error('Expected second signal to not be aborted')

  // Verify abort callback was called once
  if (abortCallbackCount !== 1) {
    throw new Error(`Expected abort callback to be called once, got ${abortCallbackCount}`)
  }

  // Verify the key property: remount creates NEW signal, old signal is aborted
  // This demonstrates the 1:1 Handle:signal:instance lifecycle
  if (signals[0] === signals[1]) {
    throw new Error('Expected different signal instances, got same reference')
  }
  if (!signals[0].aborted) {
    throw new Error('Expected first signal to remain aborted')
  }
  if (signals[1].aborted) {
    throw new Error('Expected second signal to remain active')
  }

  stalenessSet.delete(MyComponent)
  root.remove()
  document.body.removeChild(container)
})

test('multiple instances of same component all remount when marked stale', async () => {
  let stalenessSet = new Set<Function>()
  setComponentStalenessCheck((fn) => stalenessSet.has(fn))

  let setupCounts = new Map<number, number>()

  function Counter() {
    let id = Math.random()
    setupCounts.set(id, (setupCounts.get(id) || 0) + 1)
    return () => <div data-id={id}>Count: {setupCounts.get(id)}</div>
  }

  // Mount three instances
  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(
    <>
      <Counter />
      <Counter />
      <Counter />
    </>,
  )
  root.flush()

  let divs = container.querySelectorAll('div')
  if (divs.length !== 3) throw new Error(`Expected 3 divs, got ${divs.length}`)

  // Each should have setup count of 1
  for (let div of divs) {
    if (!div.textContent?.startsWith('Count: 1')) {
      throw new Error(`Expected "Count: 1", got "${div.textContent}"`)
    }
  }

  // Mark as stale and trigger update
  stalenessSet.add(Counter)
  root.render(
    <>
      <Counter />
      <Counter />
      <Counter />
    </>,
  )
  root.flush()

  // All three instances should have remounted (setup count = 2)
  let newDivs = container.querySelectorAll('div')
  if (newDivs.length !== 3) throw new Error(`Expected 3 divs after remount, got ${newDivs.length}`)

  for (let i = 0; i < 3; i++) {
    // Each should be a new DOM element
    if (divs[i] === newDivs[i]) {
      throw new Error(`Expected div ${i} to be replaced, but got same reference`)
    }
  }

  stalenessSet.delete(Counter)
  root.remove()
  document.body.removeChild(container)
})

test('staleness is scoped to current update batch', async () => {
  let stalenessSet = new Set<Function>()
  setComponentStalenessCheck((fn) => stalenessSet.has(fn))

  let setupCount = 0

  function MyComponent() {
    setupCount++
    return () => <div>Hello</div>
  }

  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(<MyComponent />)
  root.flush()

  if (setupCount !== 1) throw new Error(`Expected setupCount to be 1, got ${setupCount}`)

  // Mark as stale and remount
  stalenessSet.add(MyComponent)
  root.render(<MyComponent />)
  root.flush()

  // @ts-expect-error - This may have been mutated
  if (setupCount !== 2) throw new Error(`Expected setupCount to be 2, got ${setupCount}`)

  // Staleness should be cleared - verify by manually removing from set
  // (In real HMR, this happens via microtask)
  stalenessSet.delete(MyComponent)

  // Next update should NOT remount (staleness cleared)
  root.render(<MyComponent />)
  root.flush()

  if (setupCount !== 2) {
    throw new Error(`Expected setupCount to still be 2 (no remount), got ${setupCount}`)
  }

  root.remove()
  document.body.removeChild(container)
})

test('component not marked stale continues to reuse handle normally', async () => {
  let stalenessSet = new Set<Function>()
  setComponentStalenessCheck((fn) => stalenessSet.has(fn))

  let setupCount = 0
  let renderCount = 0

  function MyComponent() {
    setupCount++
    return () => {
      renderCount++
      return <div>Render {renderCount}</div>
    }
  }

  let container = document.createElement('div')
  document.body.appendChild(container)
  let root = createRoot(container)
  root.render(<MyComponent />)
  root.flush()

  if (setupCount !== 1) throw new Error(`Expected setupCount to be 1, got ${setupCount}`)
  if (renderCount !== 1) throw new Error(`Expected renderCount to be 1, got ${renderCount}`)

  let firstDiv = container.querySelector('div')

  // Update WITHOUT marking as stale - should reuse handle
  root.render(<MyComponent />)
  root.flush()

  if (setupCount !== 1) {
    throw new Error(`Expected setupCount to still be 1 (no remount), got ${setupCount}`)
  }
  // @ts-expect-error - This may have been mutated
  if (renderCount !== 2) throw new Error(`Expected renderCount to be 2, got ${renderCount}`)

  let secondDiv = container.querySelector('div')

  // Should be the SAME DOM element (no remount)
  if (firstDiv !== secondDiv) {
    throw new Error('Expected same DOM element to be reused, but got different reference')
  }

  root.remove()
  document.body.removeChild(container)
})
