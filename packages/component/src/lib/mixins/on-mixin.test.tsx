import { describe, it, expect, vi } from 'vitest'
import { createRoot } from '../vdom.ts'
import { on } from './on-mixin.tsx'
import { invariant } from '../invariant.ts'

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
})
