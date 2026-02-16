import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import type { Dispatched } from '@remix-run/interaction'
import type { Assert, Equal } from './utils.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('events integration', () => {
    it('attaches events', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clicked = false
      root.render(
        <button
          on={{
            click: () => {
              clicked = true
            },
          }}
        >
          Click me
        </button>,
      )

      expect(container.innerHTML).toBe('<button>Click me</button>')
      root.flush() // events attachment happens after rendering

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clicked).toBe(true)
    })

    it('reuses the event container', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clickCount = 0
      function App() {
        return () => (
          <button
            on={{
              click: () => {
                clickCount++
              },
            }}
          >
            Click me
          </button>
        )
      }

      root.render(<App />)
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clickCount).toBe(1)

      root.render(<App />)
      root.flush()

      button.click()
      expect(clickCount).toBe(2)
    })

    it('cleans up the event container', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clickCount = 0
      root.render(
        <button
          on={{
            click: () => {
              clickCount++
            },
          }}
        >
          Click me
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clickCount).toBe(1)

      // remove on prop
      root.render(<button>Click me</button>)
      root.flush()

      button.click()
      expect(clickCount).toBe(1)
    })
  })

  describe('on', () => {
    it('adds event listeners to an event target', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let clickCount = 0

      function App(handle: Handle) {
        handle.on(document, {
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

      document.dispatchEvent(new MouseEvent('click'))
      expect(clickCount).toBe(2)
    })

    it('removes event listeners when component is disconnected', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let clickCount = 0

      function App(handle: Handle) {
        handle.on(document, {
          click: (event) => {
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
      it('provides literal event and target types to listeners', () => {
        function App(handle: Handle) {
          handle.on(document, {
            keydown: (event) => {
              type test = Assert<Equal<typeof event, Dispatched<KeyboardEvent, Document>>>
            },
          })
          return () => <div>App</div>
        }
      })
    })
  })
})
