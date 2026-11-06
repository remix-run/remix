import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createRoot } from '../runtime/vdom.ts'
import type { TestContext } from '@remix-run/test'
import { createMixin, on, ref } from '../index.ts'
import type { Handle } from '../runtime/component.ts'

describe('vdom error handling', () => {
  describe('root event forwarding', () => {
    it('forwards bubbling DOM error events to root listeners', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let forwarded: unknown

      root.addEventListener('error', (event) => {
        forwarded = (event as ErrorEvent).error
      })

      let expected = new Error('createRoot forwarded error')
      container.dispatchEvent(new ErrorEvent('error', { bubbles: true, error: expected }))

      expect(forwarded).toBe(expected)
    })

    it('stops forwarding bubbling DOM error events after dispose', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let forwarded: unknown

      root.addEventListener('error', (event) => {
        forwarded = (event as ErrorEvent).error
      })

      root.dispose()

      container.dispatchEvent(
        new ErrorEvent('error', { bubbles: true, error: new Error('after dispose') }),
      )

      expect(forwarded).toBeUndefined()
    })

    it('dispose is a no-op before first render', () => {
      let container = document.createElement('div')
      let root = createRoot(container)

      root.dispose()
      root.flush()

      expect(container.innerHTML).toBe('')
    })
  })

  describe('setup errors', () => {
    it('dispatches error event when setup throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('setup error')
      function BadComponent() {
        throw error
        return () => <div>ok</div>
      }

      root.render(<BadComponent />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when nested component setup throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
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
      expect((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error).toBe(error)
    })

    it('warns and ignores handle.update() calls during setup', async (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      let warnSpy = t.mock.method(console, 'warn', () => {})
      root.addEventListener('error', errorHandler)
      let updatePromise: Promise<AbortSignal> | undefined

      function SetupUpdate(handle: Handle) {
        updatePromise = handle.update()
        return () => <div>ok</div>
      }

      root.render(<SetupUpdate />)

      expect(errorHandler).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy.mock.calls[0]?.arguments[0]).toBe(
        'Ignored handle.update() while SetupUpdate is running its setup function. The initial render includes setup changes.',
      )
      expect(container.innerHTML).toBe('<div>ok</div>')

      if (updatePromise === undefined) throw new Error('Expected setup update promise')
      let signal = await updatePromise
      expect(signal.aborted).toBe(false)
    })

    it("reports updates to a parent before the parent's initial render commits", (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      root.addEventListener('error', errorHandler)

      function Child(handle: Handle<{ updateParent(): void }>) {
        handle.props.updateParent()
        return () => null
      }

      function Parent(handle: Handle) {
        return () => <Child updateParent={() => handle.update()} />
      }

      root.render(<Parent />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      let error = (errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error as Error
      expect(error.message).toBe(
        "Cannot call handle.update() before Parent's initial render commits. Call it from an event handler or handle.queueTask() instead.",
      )
    })
  })

  describe('render errors', () => {
    it('dispatches error event when render function throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      root.addEventListener('error', errorHandler)

      let error = new Error('render error')
      function BadComponent() {
        return () => {
          throw error
        }
      }

      root.render(<BadComponent />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when render throws on update', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
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
      expect((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error).toBe(error)
    })

    it('reports handle.update() calls during render', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      root.addEventListener('error', errorHandler)

      function RenderUpdate(handle: Handle) {
        return () => {
          handle.update()
          return <div>ok</div>
        }
      }

      root.render(<RenderUpdate />)

      expect(errorHandler).toHaveBeenCalledTimes(1)
      let error = (errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error as Error
      expect(error.message).toBe(
        'Cannot call handle.update() while RenderUpdate is running its render function. Call it from an event handler or handle.queueTask() instead.',
      )
    })
  })

  describe('event handler errors', () => {
    it('runs sync event handlers attached via on() mixin', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let clicks = 0

      root.render(
        <button
          mix={[
            on('click', () => {
              clicks++
            }),
          ]}
        >
          Click
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')!
      button.click()

      expect(clicks).toBe(1)
    })

    it('runs async event handlers attached via on() mixin', async () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let calls = 0

      root.render(
        <button
          mix={[
            on('click', async () => {
              await Promise.resolve()
              calls++
            }),
          ]}
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

      expect(calls).toBe(1)
    })
  })

  describe('queueTask errors', () => {
    it('dispatches error event when sync queueTask throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
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
      expect((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error).toBe(error)
    })

    it('dispatches error event when queueTask from update throws', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
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
      expect((errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error).toBe(error)
    })
  })

  describe('aborted async work', () => {
    it('ignores rejections from on() handlers superseded by a later event', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let rejectFirst: (error: unknown) => void = () => {}
      let calls = 0

      root.render(
        <button
          mix={[
            on('click', async () => {
              calls++
              if (calls === 1) {
                await new Promise((_resolve, reject) => {
                  rejectFirst = reject
                })
              }
            }),
          ]}
        >
          Click
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')!
      button.click()
      button.click()
      rejectFirst(new DOMException('Aborted', 'AbortError'))

      await waitForUnhandledRejections()
      expect(calls).toBe(2)
      expect(unhandledRejections).toEqual([])
    })

    it('ignores rejections from on() handlers whose element was removed', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let rejectHandler: (error: unknown) => void = () => {}

      root.render(
        <button
          mix={[
            on('click', async () => {
              await new Promise((_resolve, reject) => {
                rejectHandler = reject
              })
            }),
          ]}
        >
          Click
        </button>,
      )
      root.flush()

      container.querySelector('button')!.click()
      root.render(null)
      root.flush()
      rejectHandler(new DOMException('Aborted', 'AbortError'))

      await waitForUnhandledRejections()
      expect(unhandledRejections).toEqual([])
    })

    it('ignores rejections from aborted on() handlers combined with other mixins', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let rejectHandlers: Array<(error: unknown) => void> = []

      root.render(
        <button
          mix={[
            ref(() => {}),
            on('click', async () => {
              await new Promise((_resolve, reject) => {
                rejectHandlers.push(reject)
              })
            }),
          ]}
        >
          Click
        </button>,
      )
      root.flush()

      let button = container.querySelector('button')!
      button.click()
      button.click()
      root.render(null)
      root.flush()
      for (let reject of rejectHandlers) reject(new DOMException('Aborted', 'AbortError'))

      await waitForUnhandledRejections()
      expect(rejectHandlers).toHaveLength(2)
      expect(unhandledRejections).toEqual([])
    })

    it('surfaces rejections from on() handlers that were not aborted', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let error = new Error('handler failed')

      root.render(
        <button
          mix={[
            on('click', async () => {
              await Promise.resolve()
              throw error
            }),
          ]}
        >
          Click
        </button>,
      )
      root.flush()

      container.querySelector('button')!.click()

      await waitForUnhandledRejections()
      expect(unhandledRejections).toEqual([error])
    })

    it('ignores rejections from queued tasks after the component renders again', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let rejectTask: (error: unknown) => void = () => {}
      let update = () => {}

      function Component(handle: Handle) {
        handle.queueTask(async (signal) => {
          await new Promise((_resolve, reject) => {
            rejectTask = reject
          })
          signal.throwIfAborted()
        })
        update = () => handle.update()
        return () => <div>ok</div>
      }

      root.render(<Component />)
      root.flush()
      update()
      root.flush()
      rejectTask(new DOMException('Aborted', 'AbortError'))

      await waitForUnhandledRejections()
      expect(unhandledRejections).toEqual([])
    })

    it('ignores rejections from queued tasks after the component is removed', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let rejectTask: (error: unknown) => void = () => {}

      function Component(handle: Handle) {
        handle.queueTask(async (signal) => {
          await new Promise((_resolve, reject) => {
            rejectTask = reject
          })
          signal.throwIfAborted()
        })
        return () => <div>ok</div>
      }

      root.render(<Component />)
      root.flush()
      root.render(null)
      root.flush()
      rejectTask(new DOMException('Aborted', 'AbortError'))

      await waitForUnhandledRejections()
      expect(unhandledRejections).toEqual([])
    })

    it('surfaces rejections from queued tasks that were not aborted', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let errorHandler = t.mock.fn()
      let container = document.createElement('div')
      let root = createRoot(container)
      root.addEventListener('error', errorHandler)
      let error = new Error('task failed')

      function Component(handle: Handle) {
        handle.queueTask(async () => {
          await Promise.resolve()
          throw error
        })
        return () => <div>ok</div>
      }

      root.render(<Component />)
      root.flush()

      await waitForUnhandledRejections()
      expect(unhandledRejections).toEqual([error])
      expect(errorHandler).not.toHaveBeenCalled()
    })

    it('ignores rejections from mixin queued tasks after the host is removed', async (t) => {
      let unhandledRejections = captureUnhandledRejections(t)
      let container = document.createElement('div')
      let root = createRoot(container)
      let rejectTask: (error: unknown) => void = () => {}
      let taskStarted = false

      let loader = createMixin((handle) => {
        handle.addEventListener('insert', () => {
          handle.queueTask(async () => {
            taskStarted = true
            await new Promise((_resolve, reject) => {
              rejectTask = reject
            })
          })
        })
        return () => handle.element
      })

      root.render(<div mix={[loader()]} />)
      root.flush()
      expect(taskStarted).toBe(true)
      root.render(null)
      root.flush()
      rejectTask(new DOMException('Aborted', 'AbortError'))

      await waitForUnhandledRejections()
      expect(unhandledRejections).toEqual([])
    })
  })

  describe('error does not prevent other work', () => {
    it('continues running tasks after task error', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
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

    it('preserves DOM when event handler runs', () => {
      let container = document.createElement('div')
      let root = createRoot(container)
      root.addEventListener('error', () => {})

      root.render(
        <button
          mix={[
            on('click', () => {
              // no-op
            }),
          ]}
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
    it('dispatches error for a cascading queued update loop', async (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      root.addEventListener('error', errorHandler)

      let renderCount = 0
      let shouldLoop = false
      let triggerUpdate: () => void

      function InfiniteLoop(handle: Handle) {
        triggerUpdate = () => {
          handle.update()
        }
        return () => {
          renderCount++
          if (shouldLoop) {
            handle.queueTask(() => handle.update())
          }
          return <div>count: {renderCount}</div>
        }
      }

      root.render(<InfiniteLoop />)
      root.flush()
      expect(container.innerHTML).toBe('<div>count: 1</div>')
      expect(renderCount).toBe(1)

      shouldLoop = true
      triggerUpdate!()
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(errorHandler).toHaveBeenCalled()
      let error = (errorHandler.mock.calls[0]!.arguments[0] as ErrorEvent).error as Error
      expect(error.message).toContain('infinite loop detected')
      expect(renderCount).toBeLessThan(100)
    })

    it('allows legitimate multiple updates within same event loop turn', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
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

    it('warns instead of erroring when many component instances update in one event loop turn', (t) => {
      let container = document.createElement('div')
      let root = createRoot(container)
      let errorHandler = t.mock.fn()
      let warnSpy = t.mock.method(console, 'warn', () => {})
      root.addEventListener('error', errorHandler)

      let updateCount = 60
      let counts = Array.from({ length: updateCount }, () => 0)
      let updates: Array<() => void> = []

      function Counter(handle: Handle<{ index: number }>) {
        let index = handle.props.index
        updates[index] = () => {
          handle.update()
        }
        return () => <div data-index={index}>count: {counts[index] ?? 0}</div>
      }

      root.render(
        <>
          {Array.from({ length: updateCount }, (_, index) => (
            <Counter key={index} index={index} />
          ))}
        </>,
      )
      root.flush()

      for (let index = 0; index < updateCount; index++) {
        counts[index] = (counts[index] ?? 0) + 1
        let update = updates[index]
        if (!update) throw new Error(`Missing update for component ${index}`)
        update()
        root.flush()
      }

      expect(errorHandler).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(String(warnSpy.mock.calls[0]!.arguments[0])).toContain(
        '50 cascading component updates',
      )
      expect(String(warnSpy.mock.calls[0]!.arguments[0])).toContain('Counter x50')
      expect(container.querySelector('[data-index="59"]')?.textContent).toBe('count: 1')
    })
  })
})

function captureUnhandledRejections(t: TestContext): unknown[] {
  let reasons: unknown[] = []
  let onUnhandledRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault()
    reasons.push(event.reason)
  }
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  t.after(() => window.removeEventListener('unhandledrejection', onUnhandledRejection))
  return reasons
}

function waitForUnhandledRejections() {
  return new Promise((resolve) => setTimeout(resolve, 50))
}
