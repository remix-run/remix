import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('connect', () => {
    it('connects host node lifecycle to component scope', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedNode: Element | null = null

      function App(handle: Handle) {
        return () => (
          <div
            connect={(node: Element, signal: AbortSignal) => {
              capturedNode = node
              signal.addEventListener('abort', () => {
                capturedNode = null
              })
            }}
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

  it('calls connect only once', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let capturedUpdate = () => {}
    let connectCalls = 0

    function App(handle: Handle) {
      capturedUpdate = () => handle.update()
      return () => (
        <div
          connect={() => {
            connectCalls++
          }}
        >
          Hello, world!
        </div>
      )
    }
    root.render(<App />)
    root.flush()
    expect(connectCalls).toBe(1)

    capturedUpdate()
    root.flush()
    expect(connectCalls).toBe(1)
  })
})
