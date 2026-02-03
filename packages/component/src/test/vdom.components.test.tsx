import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('components', () => {
    it.todo('warns when render is called after component is removed')

    it('inserts a component', () => {
      let container = document.createElement('div')
      function App() {
        return () => <div>Hello, world!</div>
      }
      let { render } = createRoot(container)
      render(<App />)
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
    })

    it('updates a component', () => {
      let container = document.createElement('div')

      let capturedUpdate = () => {}
      function App(handle: Handle) {
        let count = 1
        capturedUpdate = () => {
          count++
          handle.update()
        }
        return () => <div>{count}</div>
      }

      let root = createRoot(container)
      root.render(<App />)
      expect(container.innerHTML).toBe('<div>1</div>')
      let div = container.querySelector('div')
      invariant(div instanceof HTMLDivElement)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<div>2</div>')
      expect(container.querySelector('div')).toBe(div)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<div>3</div>')
      expect(container.querySelector('div')).toBe(div)
    })

    it('updates a component with a fragment', () => {
      let container = document.createElement('div')

      let capturedUpdate = () => {}
      function App(handle: Handle) {
        let count = 1
        capturedUpdate = () => {
          count++
          handle.update()
        }
        return () => (
          <>
            {Array.from({ length: count }).map((_, i) => (
              <span>{i}</span>
            ))}
          </>
        )
      }

      let root = createRoot(container)
      root.render(<App />)
      expect(container.innerHTML).toBe('<span>0</span>')
      let span = container.querySelector('span')
      invariant(span)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<span>0</span><span>1</span>')
      let newSpanTags = container.querySelectorAll('span')
      expect(newSpanTags.length).toBe(2)
      expect(newSpanTags[0]).toBe(span)

      capturedUpdate()
      root.flush()
      expect(container.innerHTML).toBe('<span>0</span><span>1</span><span>2</span>')
    })
  })
})
