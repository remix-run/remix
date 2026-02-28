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
