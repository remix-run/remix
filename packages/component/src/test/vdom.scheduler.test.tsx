import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle, RemixNode } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('scheduling', () => {
    it('skips descendant updates if ancestor is scheduled', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedParentUpdate = () => {}
      let appRenderCount = 0
      function Parent(handle: Handle) {
        capturedParentUpdate = () => {
          handle.update()
        }
        return ({ children }: { children: RemixNode }) => {
          appRenderCount++
          return children
        }
      }

      let childRenderCount = 0
      let capturedChildUpdate = () => {}
      function Child(handle: Handle) {
        capturedChildUpdate = () => {
          handle.update()
        }
        return () => {
          childRenderCount++
          return <div>Hello, world!</div>
        }
      }

      root.render(
        <Parent>
          <Child />
        </Parent>,
      )
      expect(container.innerHTML).toBe('<div>Hello, world!</div>')
      expect(appRenderCount).toBe(1)
      expect(childRenderCount).toBe(1)

      capturedChildUpdate()
      capturedParentUpdate()
      root.flush()

      expect(appRenderCount).toBe(2)
      expect(childRenderCount).toBe(2)

      // swap order
      capturedParentUpdate()
      capturedChildUpdate()
      root.flush()

      expect(appRenderCount).toBe(3)
      expect(childRenderCount).toBe(3)
    })

    it('only runs tasks once', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let taskCount = 0
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        handle.queueTask(() => {
          taskCount++
        })

        capturedUpdate = () => {
          handle.queueTask(() => {
            taskCount++
          })
          handle.update()
        }
        return () => null
      }

      root.render(<App />)
      root.flush()
      expect(taskCount).toBe(1)

      capturedUpdate()
      root.flush()
      expect(taskCount).toBe(2)
    })
  })
})
