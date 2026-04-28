import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import { on } from '../index.ts'

describe('vnode rendering', () => {
  describe('events integration', () => {
    it('attaches events via on() mixin', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clicked = false
      root.render(
        <button
          mix={[
            on('click', () => {
              clicked = true
            }),
          ]}
        >
          Click me
        </button>,
      )

      expect(container.innerHTML).toBe('<button>Click me</button>')
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clicked).toBe(true)
    })

    it('updates on() mixin listeners across rerenders', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clickCount = 0
      function App() {
        return () => (
          <button
            mix={[
              on('click', () => {
                clickCount++
              }),
            ]}
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

    it('cleans up mixin listeners when removed', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let clickCount = 0
      root.render(
        <button
          mix={[
            on('click', () => {
              clickCount++
            }),
          ]}
        >
          Click me
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')
      invariant(button)
      button.click()
      expect(clickCount).toBe(1)

      // remove event mixin
      root.render(<button>Click me</button>)
      root.flush()

      button.click()
      expect(clickCount).toBe(1)
    })
  })
})
