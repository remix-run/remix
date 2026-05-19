import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../vdom.ts'
import { on } from './on-mixin.ts'
import { invariant } from '../invariant.ts'
import type { Assert, Equal } from '../../test/utils.ts'
import type { Dispatched } from '../event-listeners.ts'

describe('on mixin', () => {
  it('updates listeners in place without rebinding when capture is unchanged', (t) => {
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
    let addSpy = t.mock.method(button, 'addEventListener')
    let removeSpy = t.mock.method(button, 'removeEventListener')

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

  it('rebinds when capture option changes', (t) => {
    let container = document.createElement('div')
    let root = createRoot(container)

    root.render(<button mix={[on('click', () => {}, false)]}>click</button>)
    root.flush()

    let button = container.querySelector('button')
    invariant(button)
    let addSpy = t.mock.method(button, 'addEventListener')
    let removeSpy = t.mock.method(button, 'removeEventListener')

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

  it('keeps bubbling events on the host element for connected roots', (t) => {
    let currentTargets: EventTarget[] = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let documentAddSpy = t.mock.method(document, 'addEventListener')

    try {
      root.render(
        <input
          mix={[
            on('input', (event) => {
              currentTargets.push(event.currentTarget)
            }),
          ]}
        />,
      )
      root.flush()

      let input = container.querySelector('input')
      invariant(input)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      root.flush()

      expect(currentTargets).toEqual([input])
      expect(documentAddSpy.mock.calls.some((call) => call.arguments[0] === 'input')).toBe(false)
    } finally {
      root.dispose()
      container.remove()
    }
  })

  it('keeps non-bubbling events on the host element for connected roots', () => {
    let calls = 0
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    try {
      root.render(
        <button
          mix={[
            on('mouseenter', () => {
              calls++
            }),
          ]}
        >
          hover
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
      root.flush()

      expect(calls).toBe(1)
    } finally {
      root.dispose()
      container.remove()
    }
  })

  it('runs host listeners before ancestor propagation is stopped', () => {
    let calls: string[] = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    try {
      root.render(
        <button
          mix={[
            on('click', () => {
              calls.push('button')
            }),
          ]}
        >
          click
        </button>,
      )
      root.flush()

      container.addEventListener('click', (event) => {
        calls.push('container')
        event.stopPropagation()
      })

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      root.flush()

      expect(calls).toEqual(['button', 'container'])
    } finally {
      root.dispose()
      container.remove()
    }
  })

  it('does not treat stopPropagation as stopImmediatePropagation on the same host', () => {
    let calls: string[] = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    try {
      root.render(
        <button
          mix={[
            on('click', (event) => {
              calls.push('first')
              event.stopPropagation()
            }),
            on('click', () => {
              calls.push('second')
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

      expect(calls).toEqual(['first', 'second'])
    } finally {
      root.dispose()
      container.remove()
    }
  })

  it('keeps capture listeners on the host element for connected roots', (t) => {
    let calls = 0
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let documentAddSpy = t.mock.method(document, 'addEventListener')

    try {
      root.render(
        <button
          mix={[
            on(
              'keydown',
              () => {
                calls++
              },
              true,
            ),
          ]}
        >
          press
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
      root.flush()

      expect(calls).toBe(1)
      expect(documentAddSpy.mock.calls.some((call) => call.arguments[0] === 'keydown')).toBe(false)
    } finally {
      root.dispose()
      container.remove()
    }
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

  // Type-only test; skip but do not delete
  it.skip('infers types in jsx for `event`, `event.currentTarget`, and `signal`', () => {
    type AccordionChangeHandler<target extends HTMLElement> = (
      event: Dispatched<AccordionChangeEvent, target>,
      signal: AbortSignal,
    ) => void | Promise<void>

    function onAccordionChange<target extends HTMLElement>(
      handler: AccordionChangeHandler<target>,
      captureBoolean?: boolean,
    ) {
      // @ts-expect-error `visibilitychange` is a Document event, not an HTMLButtonElement event
      on('visibilitychange', () => {})

      return on(ACCORDION_CHANGE_EVENT, handler, captureBoolean)
    }

    let button = (
      <button
        mix={[
          on('pointerdown', (event, signal) => {
            type _inferredEvent = Assert<
              Equal<typeof event, Dispatched<PointerEvent, HTMLButtonElement>>
            >
            type _inferredTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
            type _inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
          }),
          onAccordionChange((event, signal) => {
            type _inferredEvent = Assert<
              Equal<typeof event, Dispatched<AccordionChangeEvent, HTMLButtonElement>>
            >
            type _inferredTarget = Assert<Equal<typeof event.currentTarget, HTMLButtonElement>>
            type _inferredSignal = Assert<Equal<typeof signal, AbortSignal>>
          }),
          // @ts-expect-error `visibilitychange` is a Document event, not an HTMLButtonElement event
          on('visibilitychange', () => {}),
        ]}
      />
    )
  })
})

// Types for type inference testing ----------------------------------------------------------------

declare const ACCORDION_CHANGE_EVENT: 'remix/ui::src/runtime/mixins/on-mixin.test.tsx::accordion-change'

type AccordionChangeEvent = Event & {
  accordionType: 'single' | 'multiple'
  itemValue: string
  value: string | null | string[]
}

declare global {
  interface HTMLElementEventMap {
    [ACCORDION_CHANGE_EVENT]: AccordionChangeEvent
  }
}
