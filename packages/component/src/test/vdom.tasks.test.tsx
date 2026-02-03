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

  it('runs task provided to render', () => {
    let container = document.createElement('div')
    let root = createRoot(container)

    let taskRan = false
    let capturedUpdate = () => {}
    function App(handle: Handle) {
      capturedUpdate = () => {
        handle.update(() => {
          taskRan = true
        })
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
})
