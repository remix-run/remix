import { describe, it, expect, vi } from 'vitest'
import { createRoot } from '../vdom.ts'
import { on } from './on-mixin.tsx'
import { invariant } from '../invariant.ts'
import type { Assert, Equal } from '../../test/utils.ts'
import type { Dispatched } from './on-mixin.tsx'

describe('on mixin', () => {
  it('updates listeners in place without rebinding when capture is unchanged', () => {
    let calls: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          on('click', () => {
            calls.push('first')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    let addSpy = vi.spyOn(button, 'addEventListener')
    let removeSpy = vi.spyOn(button, 'removeEventListener')

    root.render(
      <button
        mix={[
          on('click', () => {
            calls.push('second')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()
    button.click()
    root.flush()

    expect(calls).toEqual(['second'])
    expect(addSpy).toHaveBeenCalledTimes(0)
    expect(removeSpy).toHaveBeenCalledTimes(0)
  })

  it('rebinds when capture option changes', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<button mix={[on('click', () => {}, false)]}>click</button>)
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    let addSpy = vi.spyOn(button, 'addEventListener')
    let removeSpy = vi.spyOn(button, 'removeEventListener')

    root.render(<button mix={[on('click', () => {}, true)]}>click</button>)
    root.flush()

    expect(addSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)
  })

  it('passes abort signal as the second handler argument', () => {
    let receivedSignal = AbortSignal.abort()
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          on('click', (_event, signal) => {
            receivedSignal = signal
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()

    expect(receivedSignal).toBeInstanceOf(AbortSignal)
    expect(receivedSignal.aborted).toBe(false)
  })

  it('supports multiple event types on the same element', () => {
    let calls: string[] = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          on('click', () => {
            calls.push('click')
          }),
          on('focus', () => {
            calls.push('focus')
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    button.click()
    root.flush()

    expect(calls).toEqual(['focus', 'click'])
  })

  it('removes listeners when on() mixin is removed', () => {
    let calls = 0
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          on('click', () => {
            calls++
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    root.flush()
    expect(calls).toBe(1)

    root.render(<button>click</button>)
    root.flush()
    button.click()
    root.flush()
    expect(calls).toBe(1)
  })

  it('aborts previous handler signal on reentry', async () => {
    let signals: AbortSignal[] = []
    let pendingResolvers: Array<() => void> = []
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(
      <button
        mix={[
          on('click', async (_event, signal) => {
            signals.push(signal)
            await new Promise<void>((resolve) => {
              pendingResolvers.push(resolve)
            })
          }),
        ]}
      >
        click
      </button>,
    )
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    button.click()
    button.click()
    root.flush()

    expect(signals).toHaveLength(2)
    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(false)

    for (let resolve of pendingResolvers) resolve()
    await Promise.resolve()
  })
})

let infersNodeType = (
  <button
    mix={[
      on('pointerdown', (event, signal) => {
        type inferredEvent = Assert<
          Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>
        >
        type inferredTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
        type inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
      }),
    ]}
  />
)
