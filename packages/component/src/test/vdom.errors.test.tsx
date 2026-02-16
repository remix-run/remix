import { describe, it, expect, vi } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import type { Handle } from '../lib/component.ts'

describe('vdom error handling', () => {
  describe('setup errors', () => {
    it('dispatches error event when setup throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('setup error')
      function BadComponent() {
        throw error
        return () => <div>ok</div>
      }

      root.render(<BadComponent />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when nested component setup throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('nested setup error')
      function BadChild() {
        throw error
        return () => null
      }

      function Parent() {
        return () => (
          <div>
            <BadChild />
          </div>
        )
      }

      root.render(<Parent />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })
  })

  describe('render errors', () => {
    it('dispatches error event when render function throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('render error')
      function BadComponent() {
        return () => {
          throw error
        }
      }

      root.render(<BadComponent />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when render throws on update', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let shouldThrow = false
      let error = new Error('render update error')
      let update: () => void

      function Component(handle: Handle) {
        update = () => handle.update()
        return () => {
          if (shouldThrow) throw error
          return <div>ok</div>
        }
      }

      root.render(<Component />)
      expect(container.innerHTML).toBe('<div>ok</div>')
      expect(errorHandler).not.toHaveBeenCalled()

      shouldThrow = true
      update!()
      root.flush()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })
  })

  describe('event handler errors', () => {
    it('dispatches error event when sync event handler throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('sync event error')

      root.render(
        <button
          on={{
            click: () => {
              throw error
            },
          }}
        >
          Click
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')!
      button.click()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when async event handler throws', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('async event error')

      root.render(
        <button
          on={{
            async click() {
              await Promise.resolve()
              throw error
            },
          }}
        >
          Click
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')!
      button.click()

      // Let the async handler complete
      await Promise.resolve()
      await Promise.resolve()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })
  })

  describe('queueTask errors', () => {
    it('dispatches error event when sync queueTask throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('sync task error')

      function Component(handle: Handle) {
        handle.queueTask(() => {
          throw error
        })
        return () => <div>ok</div>
      }

      root.render(<Component />)
      root.flush()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when queueTask from update throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('update task error')
      let update: () => void

      function Component(handle: Handle) {
        update = () => {
          handle.queueTask(() => {
            throw error
          })
          handle.update()
        }
        return () => <div>ok</div>
      }

      root.render(<Component />)
      root.flush()
      expect(errorHandler).not.toHaveBeenCalled()

      update!()
      root.flush()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0][0] as ErrorEvent).error).toBe(error)
    })
  })

  describe('error does not prevent other work', () => {
    it('continues running tasks after task error', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let taskRan = false

      function Bad(handle: Handle) {
        handle.queueTask(() => {
          throw new Error('bad task')
        })
        return () => <div>bad</div>
      }

      function Good(handle: Handle) {
        handle.queueTask(() => {
          taskRan = true
        })
        return () => <div>good</div>
      }

      root.render(
        <>
          <Bad />
          <Good />
        </>,
      )
      root.flush()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(taskRan).toBe(true)
    })
  })

  describe('DOM state after errors', () => {
    it('leaves DOM empty when initial render throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.addEventListener('error', () => {})

      function Bad() {
        throw new Error('bad')
        return () => <div>ok</div>
      }

      root.render(<Bad />)

      expect(container.innerHTML).toBe('')
    })

    it('preserves previous DOM when update throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.addEventListener('error', () => {})

      let shouldThrow = false
      let update: () => void

      function Component(handle: Handle) {
        update = () => handle.update()
        return () => {
          if (shouldThrow) throw new Error('update error')
          return <div>ok</div>
        }
      }

      root.render(<Component />)
      expect(container.innerHTML).toBe('<div>ok</div>')

      shouldThrow = true
      update!()
      root.flush()

      // Previous DOM is preserved
      expect(container.innerHTML).toBe('<div>ok</div>')
    })

    it('preserves DOM when event handler throws', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.addEventListener('error', () => {})

      root.render(
        <button
          on={{
            click: () => {
              throw new Error('click error')
            },
          }}
        >
          Click
        </button>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<button>Click</button>')

      let button = container.querySelector('button')!
      button.click()

      // DOM unchanged after event error
      expect(container.innerHTML).toBe('<button>Click</button>')
    })
  })

  describe('cascading updates protection', () => {
    it('dispatches error when handle.update() is called during render', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let renderCount = 0
      let triggerUpdate: () => void

      function InfiniteLoop(handle: Handle) {
        triggerUpdate = () => {
          handle.update()
        }
        return () => {
          renderCount++
          if (renderCount > 1) {
            handle.update()
          }
          return <div>count: {renderCount}</div>
        }
      }

      root.render(<InfiniteLoop />)
      root.flush()
      expect(container.innerHTML).toBe('<div>count: 1</div>')
      expect(renderCount).toBe(1)

      triggerUpdate!()
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(errorHandler).toHaveBeenCalled()
      let error = (errorHandler.mock.calls[0][0] as ErrorEvent).error as Error
      expect(error.message).toContain('infinite loop detected')
      expect(renderCount).toBeLessThan(100)
    })

    it('allows legitimate multiple updates within same event loop turn', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = vi.fn()
      root.addEventListener('error', errorHandler)

      let count = 0
      let update: () => void

      function Counter(handle: Handle) {
        update = () => handle.update()
        return () => <div>count: {count}</div>
      }

      root.render(<Counter />)
      root.flush()

      count++
      update!()
      root.flush()

      count++
      update!()
      root.flush()

      count++
      update!()
      root.flush()

      expect(container.innerHTML).toBe('<div>count: 3</div>')
      expect(errorHandler).not.toHaveBeenCalled()
    })
  })
})
