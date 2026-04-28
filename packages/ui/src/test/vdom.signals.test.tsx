import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  describe('signals', () => {
    it('provides mounted signal on handle.signal', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedSignal: AbortSignal | undefined
      function App(handle: Handle) {
        capturedSignal = handle.signal
        return () => null
      }

      root.render(<App />)
      invariant(capturedSignal)
      expect(capturedSignal).toBeInstanceOf(AbortSignal)
      expect(capturedSignal.aborted).toBe(false)

      root.render(null)
      root.flush()
      expect(capturedSignal.aborted).toBe(true)
    })

    it('provides render signal to tasks and aborts on re-render', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let signals: AbortSignal[] = []
      function App(handle: Handle) {
        handle.queueTask((signal) => {
          signals.push(signal)
        })
        return () => null
      }

      root.render(<App />)
      root.flush()

      expect(signals.length).toBe(1)
      invariant(signals[0])
      expect(signals[0]).toBeInstanceOf(AbortSignal)
      expect(signals[0].aborted).toBe(false)

      root.render(<App />)
      root.flush()
      expect(signals.length).toBe(1)
      invariant(signals[0])
      expect(signals[0].aborted).toBe(true)
    })

    it('aborts handle.update() signal on next update', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedSignal: AbortSignal | undefined
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        capturedUpdate = () => {
          handle.update().then((signal) => {
            capturedSignal = signal
          })
        }
        return () => null
      }

      root.render(<App />)
      root.flush()

      capturedUpdate()
      root.flush()
      await Promise.resolve()
      invariant(capturedSignal)
      let firstSignal = capturedSignal
      expect(firstSignal.aborted).toBe(false)

      capturedUpdate()
      root.flush()
      expect(firstSignal.aborted).toBe(true)
    })

    it('aborts queueTask signal when component is removed', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedSignal: AbortSignal | undefined
      function App(handle: Handle) {
        handle.queueTask((signal) => {
          capturedSignal = signal
        })
        return () => null
      }

      root.render(<App />)
      root.flush()
      invariant(capturedSignal)
      expect(capturedSignal.aborted).toBe(false)

      root.render(null)
      root.flush()
      expect(capturedSignal.aborted).toBe(true)
    })

    it('aborts handle.update() signal when component is removed', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      let capturedSignal: AbortSignal | undefined
      let capturedUpdate = () => {}
      function App(handle: Handle) {
        capturedUpdate = () => {
          handle.update().then((signal) => {
            capturedSignal = signal
          })
        }
        return () => null
      }

      root.render(<App />)
      root.flush()

      capturedUpdate()
      root.flush()
      await Promise.resolve()
      invariant(capturedSignal)
      expect(capturedSignal.aborted).toBe(false)

      root.render(null)
      root.flush()
      expect(capturedSignal.aborted).toBe(true)
    })
  })
})
