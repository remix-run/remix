import { describe, it, expect } from 'vitest'
import { addEventListeners, TypedEventTarget, createRoot } from '../index.ts'
import type { Dispatched } from '../lib/event-listeners.ts'
import type { Assert, Equal } from './utils.ts'
import type { Handle } from '../lib/component.ts'

describe('addEventListeners', () => {
  it('adds listeners to an event target', () => {
    let controller = new AbortController()
    let clickCount = 0

    addEventListeners(document, controller.signal, {
      click: () => {
        clickCount++
      },
    })

    document.dispatchEvent(new MouseEvent('click'))
    expect(clickCount).toBe(1)

    document.dispatchEvent(new MouseEvent('click'))
    expect(clickCount).toBe(2)
  })

  it('removes listeners when signal aborts', () => {
    let controller = new AbortController()
    let clickCount = 0

    addEventListeners(document, controller.signal, {
      click: () => {
        clickCount++
      },
    })

    document.dispatchEvent(new MouseEvent('click'))
    expect(clickCount).toBe(1)

    controller.abort()
    document.dispatchEvent(new MouseEvent('click'))
    expect(clickCount).toBe(1)
  })

  it('works with component handle signal for auto cleanup', () => {
    let container = document.createElement('div')
    let root = createRoot(container)
    let clickCount = 0

    function App(handle: Handle) {
      addEventListeners(document, handle.signal, {
        click: () => {
          clickCount++
        },
      })
      return () => <div>App</div>
    }

    root.render(<App />)
    root.flush()

    document.dispatchEvent(new MouseEvent('click'))
    expect(clickCount).toBe(1)

    root.render(null)
    root.flush()

    document.dispatchEvent(new MouseEvent('click'))
    expect(clickCount).toBe(1)
  })

  it('does not pass a re-entry signal to one-argument listeners', () => {
    let controller = new AbortController()
    let receivedSignal: AbortSignal | undefined

    addEventListeners(document, controller.signal, {
      click(event) {
        void event
        receivedSignal = arguments[1] as AbortSignal | undefined
      },
    })

    document.dispatchEvent(new MouseEvent('click'))
    expect(receivedSignal).toBeUndefined()
  })

  it('aborts re-entry signal for two-argument listeners', () => {
    let controller = new AbortController()
    let signals: AbortSignal[] = []

    addEventListeners(document, controller.signal, {
      click(_event, signal) {
        signals.push(signal)
      },
    })

    document.dispatchEvent(new MouseEvent('click'))
    expect(signals).toHaveLength(1)
    expect(signals[0]?.aborted).toBe(false)

    document.dispatchEvent(new MouseEvent('click'))
    expect(signals).toHaveLength(2)
    expect(signals[0]?.aborted).toBe(true)
    expect(signals[1]?.aborted).toBe(false)

    controller.abort()
    expect(signals[1]?.aborted).toBe(true)
  })

  describe('types', () => {
    it('provides literal event and target types for document', () => {
      function App(handle: Handle) {
        addEventListeners(document, handle.signal, {
          keydown: (event) => {
            type test = Assert<Equal<typeof event, Dispatched<KeyboardEvent, Document>>>
          },
        })
        return () => <div>App</div>
      }
    })

    it('provides abort signal as required second listener argument', () => {
      function App(handle: Handle) {
        addEventListeners(document, handle.signal, {
          keydown: (event, signal) => {
            type eventTest = Assert<Equal<typeof event, Dispatched<KeyboardEvent, Document>>>
            type signalTest = Assert<Equal<typeof signal, AbortSignal>>
          },
        })
        return () => <div>App</div>
      }
    })

    it('infers events from TypedEventTarget event map', () => {
      type PingEventMap = {
        ping: CustomEvent<{ value: number }>
      }

      class PingTarget extends TypedEventTarget<PingEventMap> {}

      let target = new PingTarget()
      let controller = new AbortController()

      addEventListeners(target, controller.signal, {
        ping: (event) => {
          type test = Assert<
            Equal<typeof event, Dispatched<CustomEvent<{ value: number }>, PingTarget>>
          >
          void event.detail.value
        },
      })
    })
  })
})
