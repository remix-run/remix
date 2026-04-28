import { describe, it, expect } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  it('runs update tasks after updates', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let taskRan = false
    let capturedUpdate = () => {}
    function App(handle: Handle) {
      capturedUpdate = () => {
        handle.queueTask(() => {
          taskRan = true
        })
        handle.update()
      }

      return () => <div>Hello, world!</div>
    }

    root.render(<App />)
    root.flush()
    expect(taskRan).toBe(false)

    capturedUpdate()
    expect(taskRan).toBe(false)
    root.flush()
    expect(taskRan).toBe(true)
  })

  it('handle.update() returns a promise that resolves with a signal', async () => {
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

      return () => <div>Hello, world!</div>
    }

    root.render(<App />)
    root.flush()
    expect(capturedSignal).toBe(undefined)

    capturedUpdate()
    expect(capturedSignal).toBe(undefined)
    root.flush()
    await Promise.resolve()
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(false)
  })
})
