import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle } from '../lib/component.ts'
import { ref } from '../lib/mixins/ref-mixin.tsx'

describe('vnode rendering', () => {
  describe('ref', () => {
    it('connects host node lifecycle to component scope', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedNode: Element | null = null

      function App(handle: Handle) {
        return () => (
          <div
            mix={[
              ref((node: Element, signal: AbortSignal) => {
                capturedNode = node
                signal.addEventListener('abort', () => {
                  capturedNode = null
                })
              }),
            ]}
          >
            Hello, world!
          </div>
        )
      }

      root.render(<App />)
      root.flush()
      expect(capturedNode).toBeInstanceOf(HTMLDivElement)

      root.render(null)
      root.flush()
      expect(capturedNode).toBe(null)
    })
  })

  it('calls ref only once', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let capturedUpdate = () => {}
    let refCalls = 0

    function App(handle: Handle) {
      capturedUpdate = () => handle.update()
      return () => (
        <div
          mix={[
            ref(() => {
              refCalls++
            }),
          ]}
        >
          Hello, world!
        </div>
      )
    }
    root.render(<App />)
    root.flush()
    expect(refCalls).toBe(1)

    capturedUpdate()
    root.flush()
    expect(refCalls).toBe(1)
  })
})
