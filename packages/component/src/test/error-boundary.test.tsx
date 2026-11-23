import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import type { TestContext } from '@remix-run/test'
import type { Handle, RemixNode } from '../runtime/component.ts'
import { createMixin, ErrorBoundary, on } from '../index.ts'
import { createRoot } from '../runtime/vdom.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'

function Broken(): () => null {
  throw new Error('Broken render')
}

// Strips the boundary's marker comments so assertions read like the rendered HTML.
function html(container: Element): string {
  return container.innerHTML.replace(/<!--\s*\/?rmx:eb(?::error)?\s*-->/g, '')
}

function silenceConsoleError(t: TestContext) {
  return t.mock.method(console, 'error', () => {})
}

describe('ErrorBoundary', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  describe('client rendering', () => {
    it('renders children between marker comments', () => {
      let root = createRoot(container)
      root.render(
        <main>
          <ErrorBoundary fallback="Failed">
            <p>Reviews</p>
          </ErrorBoundary>
        </main>,
      )
      root.flush()

      expect(container.innerHTML).toBe('<main><!-- rmx:eb --><p>Reviews</p><!-- /rmx:eb --></main>')
    })

    it('renders the fallback when a child throws on the first render', (t) => {
      let errorSpy = silenceConsoleError(t)
      let rootErrors: unknown[] = []
      let root = createRoot(container)
      root.addEventListener('error', (event) => rootErrors.push(event.error))

      root.render(
        <main>
          <h1>Book</h1>
          <ErrorBoundary fallback={(error) => <p>Failed: {(error as Error).message}</p>}>
            <section>
              <p>Before</p>
              <Broken />
            </section>
          </ErrorBoundary>
          <footer>Footer</footer>
        </main>,
      )
      root.flush()

      expect(html(container)).toBe(
        '<main><h1>Book</h1><p>Failed: Broken render</p><footer>Footer</footer></main>',
      )
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect((errorSpy.mock.calls[0]!.arguments[0] as Error).message).toBe('Broken render')
      expect(rootErrors).toEqual([])
    })

    it('renders a static fallback', (t) => {
      silenceConsoleError(t)
      let root = createRoot(container)

      root.render(
        <ErrorBoundary fallback={<p>Failed</p>}>
          <Broken />
        </ErrorBoundary>,
      )
      root.flush()

      expect(html(container)).toBe('<p>Failed</p>')
    })

    it('disposes components and mixins created by the failed render', (t) => {
      silenceConsoleError(t)
      let signals: AbortSignal[] = []
      let removedMixins = 0

      function Sibling(handle: Handle) {
        signals.push(handle.signal)
        return () => <span>Sibling</span>
      }

      let tracked = createMixin((handle) => {
        handle.addEventListener('remove', () => {
          removedMixins++
        })
        return () => {}
      })

      let root = createRoot(container)
      root.render(
        <ErrorBoundary fallback="Failed">
          <Sibling />
          <div mix={tracked()}>Tracked</div>
          <Broken />
        </ErrorBoundary>,
      )
      root.flush()

      expect(html(container)).toBe('Failed')
      expect(signals).toHaveLength(1)
      expect(signals[0]!.aborted).toBe(true)
      expect(removedMixins).toBe(1)
    })

    it('renders the fallback when a child throws while its parent updates', (t) => {
      silenceConsoleError(t)
      let signals: AbortSignal[] = []
      let fail = false
      let update = () => {}

      function Child() {
        return () => {
          if (fail) throw new Error('Update failed')
          return <span>Child</span>
        }
      }

      function Sibling(handle: Handle) {
        signals.push(handle.signal)
        return () => <span>Sibling</span>
      }

      function Parent(handle: Handle) {
        update = () => handle.update()
        return () => (
          <ErrorBoundary fallback={(error) => <p>{(error as Error).message}</p>}>
            <Sibling />
            <Child />
          </ErrorBoundary>
        )
      }

      let root = createRoot(container)
      root.render(<Parent />)
      root.flush()
      expect(html(container)).toBe('<span>Sibling</span><span>Child</span>')

      fail = true
      update()
      root.flush()

      expect(html(container)).toBe('<p>Update failed</p>')
      expect(signals[0]!.aborted).toBe(true)
    })

    it('renders the fallback when a descendant throws while updating itself', (t) => {
      silenceConsoleError(t)
      let rootErrors: unknown[] = []
      let signals: AbortSignal[] = []
      let fail = false
      let update = () => {}

      function Counter(handle: Handle) {
        signals.push(handle.signal)
        update = () => handle.update()
        return () => {
          if (fail) throw new Error('Counter failed')
          return <button type="button">Count</button>
        }
      }

      let root = createRoot(container)
      root.addEventListener('error', (event) => rootErrors.push(event.error))
      root.render(
        <div>
          <ErrorBoundary fallback={(error) => <p>{(error as Error).message}</p>}>
            <section>
              <Counter />
            </section>
          </ErrorBoundary>
          <aside>Outside</aside>
        </div>,
      )
      root.flush()

      fail = true
      update()
      root.flush()

      expect(html(container)).toBe('<div><p>Counter failed</p><aside>Outside</aside></div>')
      expect(signals[0]!.aborted).toBe(true)
      expect(rootErrors).toEqual([])
    })

    it('disposes components created by a failed descendant update', (t) => {
      silenceConsoleError(t)
      let signals: AbortSignal[] = []
      let fail = false
      let update = () => {}

      function Created(handle: Handle) {
        signals.push(handle.signal)
        return () => <em>Created</em>
      }

      function Grows(handle: Handle) {
        update = () => handle.update()
        return () =>
          fail ? (
            <>
              <Created />
              <Broken />
            </>
          ) : (
            <span>Small</span>
          )
      }

      let root = createRoot(container)
      root.render(
        <ErrorBoundary fallback="Failed">
          <Grows />
        </ErrorBoundary>,
      )
      root.flush()

      fail = true
      update()
      root.flush()

      expect(html(container)).toBe('Failed')
      expect(signals).toHaveLength(1)
      expect(signals[0]!.aborted).toBe(true)
    })

    it('keeps showing the fallback with updated props when its parent updates', (t) => {
      silenceConsoleError(t)
      let label = 'First'
      let update = () => {}

      function Parent(handle: Handle) {
        update = () => handle.update()
        return () => (
          <ErrorBoundary fallback={<p>{label}</p>}>
            <Broken />
          </ErrorBoundary>
        )
      }

      let root = createRoot(container)
      root.render(<Parent />)
      root.flush()
      let fallback = container.querySelector('p')
      expect(fallback?.textContent).toBe('First')

      label = 'Second'
      update()
      root.flush()

      expect(container.querySelector('p')).toBe(fallback)
      expect(fallback?.textContent).toBe('Second')
    })

    it('does not catch errors from queued tasks', (t) => {
      silenceConsoleError(t)
      let rootErrors: unknown[] = []

      function Task(handle: Handle) {
        handle.queueTask(() => {
          throw new Error('Task failed')
        })
        return () => <span>Task</span>
      }

      let root = createRoot(container)
      root.addEventListener('error', (event) => rootErrors.push(event.error))
      root.render(
        <ErrorBoundary fallback="Failed">
          <Task />
        </ErrorBoundary>,
      )
      root.flush()

      expect(html(container)).toBe('<span>Task</span>')
      expect(rootErrors.map((error) => (error as Error).message)).toEqual(['Task failed'])
    })

    it('still reports errors outside any boundary to the root', (t) => {
      silenceConsoleError(t)
      let rootErrors: unknown[] = []
      let root = createRoot(container)
      root.addEventListener('error', (event) => rootErrors.push(event.error))

      root.render(
        <div>
          <Broken />
        </div>,
      )
      root.flush()

      expect(rootErrors.map((error) => (error as Error).message)).toEqual(['Broken render'])
    })
  })

  describe('nested boundaries', () => {
    it('lets the nearest boundary handle an error', (t) => {
      silenceConsoleError(t)
      let root = createRoot(container)

      root.render(
        <ErrorBoundary fallback="Outer">
          <div>
            <ErrorBoundary fallback="Inner">
              <Broken />
            </ErrorBoundary>
            <span>Sibling</span>
          </div>
        </ErrorBoundary>,
      )
      root.flush()

      expect(html(container)).toBe('<div>Inner<span>Sibling</span></div>')
    })

    it('lets the next boundary up handle an error thrown by a fallback', (t) => {
      let errorSpy = silenceConsoleError(t)
      let root = createRoot(container)

      root.render(
        <ErrorBoundary fallback={(error) => <p>Outer: {(error as Error).message}</p>}>
          <div>
            <ErrorBoundary
              fallback={() => {
                throw new Error('Fallback failed')
              }}
            >
              <Broken />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>,
      )
      root.flush()

      expect(html(container)).toBe('<p>Outer: Fallback failed</p>')
      expect(errorSpy.mock.calls.map((call) => (call.arguments[0] as Error).message)).toEqual([
        'Broken render',
        'Fallback failed',
      ])
    })

    it('lets the next boundary up handle a fallback that throws after a descendant update fails', (t) => {
      silenceConsoleError(t)
      let fail = false
      let update = () => {}

      function Counter(handle: Handle) {
        update = () => handle.update()
        return () => {
          if (fail) throw new Error('Counter failed')
          return <span>Counter</span>
        }
      }

      let root = createRoot(container)
      root.render(
        <section>
          <ErrorBoundary fallback={(error) => <p>Outer: {(error as Error).message}</p>}>
            <ErrorBoundary
              fallback={() => {
                throw new Error('Fallback failed')
              }}
            >
              <Counter />
            </ErrorBoundary>
          </ErrorBoundary>
        </section>,
      )
      root.flush()

      fail = true
      update()
      root.flush()

      expect(html(container)).toBe('<section><p>Outer: Fallback failed</p></section>')
    })
  })

  describe('retry', () => {
    it('renders the children again with new component instances', (t) => {
      silenceConsoleError(t)
      let fail = true
      let setups = 0
      let retry = () => {}

      function Flaky() {
        setups++
        if (fail) throw new Error('Flaky failed')
        return () => <span>Loaded</span>
      }

      let root = createRoot(container)
      root.render(
        <ErrorBoundary
          fallback={(_error, retryBoundary) => {
            retry = retryBoundary
            return <p>Failed</p>
          }}
        >
          <Flaky />
        </ErrorBoundary>,
      )
      root.flush()
      expect(html(container)).toBe('<p>Failed</p>')

      fail = false
      retry()
      root.flush()

      expect(html(container)).toBe('<span>Loaded</span>')
      expect(setups).toBe(2)
    })

    it('renders the fallback again when the retry fails', (t) => {
      let errorSpy = silenceConsoleError(t)
      let retry = () => {}
      let attempts: unknown[] = []

      let root = createRoot(container)
      root.render(
        <ErrorBoundary
          fallback={(error, retryBoundary) => {
            attempts.push(error)
            retry = retryBoundary
            return <p>Failed {attempts.length}</p>
          }}
        >
          <Broken />
        </ErrorBoundary>,
      )
      root.flush()

      retry()
      root.flush()

      expect(html(container)).toBe('<p>Failed 2</p>')
      expect(attempts).toHaveLength(2)
      expect(attempts[0]).not.toBe(attempts[1])
      expect(errorSpy).toHaveBeenCalledTimes(2)
    })

    it('retries from a click handler in the fallback', async (t) => {
      silenceConsoleError(t)
      let fail = true

      function Flaky() {
        return () => {
          if (fail) throw new Error('Flaky failed')
          return <span>Loaded</span>
        }
      }

      let root = createRoot(container)
      root.render(
        <ErrorBoundary
          fallback={(_error, retry) => (
            <button type="button" mix={on('click', retry)}>
              Try again
            </button>
          )}
        >
          <Flaky />
        </ErrorBoundary>,
      )
      root.flush()

      fail = false
      let button = container.querySelector('button')
      invariant(button)
      button.click()
      root.flush()

      expect(html(container)).toBe('<span>Loaded</span>')
    })

    it('keeps the same retry function across renders', (t) => {
      silenceConsoleError(t)
      let retries: Array<() => void> = []
      let update = () => {}

      function Parent(handle: Handle) {
        update = () => handle.update()
        return () => (
          <ErrorBoundary
            fallback={(_error, retry) => {
              retries.push(retry)
              return 'Failed'
            }}
          >
            <Broken />
          </ErrorBoundary>
        )
      }

      let root = createRoot(container)
      root.render(<Parent />)
      root.flush()
      update()
      root.flush()

      expect(retries).toHaveLength(2)
      expect(retries[0]).toBe(retries[1])
    })

    it('resets when the boundary key changes', (t) => {
      silenceConsoleError(t)
      let fail = true
      let key = 'a'
      let update = () => {}

      function Flaky() {
        return () => {
          if (fail) throw new Error('Flaky failed')
          return <span>Loaded</span>
        }
      }

      function Parent(handle: Handle) {
        update = () => handle.update()
        return () => (
          <div>
            <ErrorBoundary key={key} fallback="Failed">
              <Flaky />
            </ErrorBoundary>
          </div>
        )
      }

      let root = createRoot(container)
      root.render(<Parent />)
      root.flush()
      expect(html(container)).toBe('<div>Failed</div>')

      fail = false
      key = 'b'
      update()
      root.flush()

      expect(html(container)).toBe('<div><span>Loaded</span></div>')
      expect(container.innerHTML.match(/rmx:eb/g)).toHaveLength(2)
    })
  })

  describe('tree operations', () => {
    it('moves the boundary content with its markers in keyed lists', (t) => {
      silenceConsoleError(t)
      let order = ['a', 'b']
      let update = () => {}

      function List(handle: Handle) {
        update = () => handle.update()
        return () => (
          <ul>
            {order.map((id) => (
              <ErrorBoundary key={id} fallback={<li>{id} failed</li>}>
                {id === 'a' ? <Broken /> : <li>{id}</li>}
              </ErrorBoundary>
            ))}
          </ul>
        )
      }

      let root = createRoot(container)
      root.render(<List />)
      root.flush()
      expect(html(container)).toBe('<ul><li>a failed</li><li>b</li></ul>')

      order = ['b', 'a']
      update()
      root.flush()

      expect(container.innerHTML).toBe(
        '<ul><!-- rmx:eb --><li>b</li><!-- /rmx:eb --><!-- rmx:eb --><li>a failed</li><!-- /rmx:eb --></ul>',
      )
    })

    it('removes its markers and content when it is removed', () => {
      let show = true
      let update = () => {}

      function Parent(handle: Handle) {
        update = () => handle.update()
        return () => (
          <div>
            {show ? (
              <ErrorBoundary fallback="Failed">
                <p>Content</p>
              </ErrorBoundary>
            ) : null}
            <span>After</span>
          </div>
        )
      }

      let root = createRoot(container)
      root.render(<Parent />)
      root.flush()

      show = false
      update()
      root.flush()

      expect(container.innerHTML).toBe('<div><span>After</span></div>')
    })

    it('inserts content added by a child update inside the boundary', () => {
      let items = ['a']
      let update = () => {}

      function Items(handle: Handle) {
        update = () => handle.update()
        return () => items.map((item) => <li key={item}>{item}</li>)
      }

      let root = createRoot(container)
      root.render(
        <ul>
          <ErrorBoundary fallback="Failed">
            <Items />
          </ErrorBoundary>
          <li>last</li>
        </ul>,
      )
      root.flush()

      items = ['a', 'b']
      update()
      root.flush()

      expect(container.innerHTML).toBe(
        '<ul><!-- rmx:eb --><li>a</li><li>b</li><!-- /rmx:eb --><li>last</li></ul>',
      )
    })
  })

  describe('hydration', () => {
    async function renderAndHydrate(node: () => RemixNode, onError?: (error: unknown) => void) {
      container.innerHTML = await renderToString(node())
      let root = createRoot(container)
      if (onError) root.addEventListener('error', (event) => onError(event.error))
      root.render(node())
      root.flush()
      return root
    }

    it('adopts server-rendered children', async () => {
      function App() {
        return () => (
          <main>
            <ErrorBoundary fallback="Failed">
              <p>Reviews</p>
            </ErrorBoundary>
            <footer>Footer</footer>
          </main>
        )
      }

      container.innerHTML = await renderToString(<App />)
      let serverParagraph = container.querySelector('p')
      let serverFooter = container.querySelector('footer')

      let root = createRoot(container)
      root.render(<App />)
      root.flush()

      expect(container.querySelector('p')).toBe(serverParagraph)
      expect(container.querySelector('footer')).toBe(serverFooter)
      expect(container.innerHTML).toBe(
        '<main><!-- rmx:eb --><p>Reviews</p><!-- /rmx:eb --><footer>Footer</footer></main>',
      )
    })

    it('adopts a server-rendered fallback without rendering the children', async (t) => {
      let errorSpy = silenceConsoleError(t)
      let renders = 0
      let errors: unknown[] = []
      let fail = true

      function Reviews() {
        renders++
        if (fail) throw new Error('Database unavailable')
        return () => <p>Reviews</p>
      }

      function App() {
        return () => (
          <main>
            <ErrorBoundary
              fallback={(error, retry) => {
                errors.push(error)
                return (
                  <button type="button" mix={on('click', retry)}>
                    Retry
                  </button>
                )
              }}
            >
              <Reviews />
            </ErrorBoundary>
            <footer>Footer</footer>
          </main>
        )
      }

      container.innerHTML = await renderToString(<App />)
      expect(container.innerHTML).toContain('<!-- rmx:eb:error -->')
      let serverButton = container.querySelector('button')
      let serverError = errors[0]
      errors = []
      renders = 0
      errorSpy.mock.resetCalls()

      let root = createRoot(container)
      root.render(<App />)
      root.flush()

      expect(container.querySelector('button')).toBe(serverButton)
      expect(renders).toBe(0)
      expect(errorSpy).not.toHaveBeenCalled()
      expect(errors).toHaveLength(1)
      expect(errors[0]).not.toBe(serverError)
      expect((errors[0] as Error).message).toBe(
        'ErrorBoundary content failed to render on the server',
      )

      fail = false
      serverButton?.click()
      root.flush()

      expect(html(container)).toBe('<main><p>Reviews</p><footer>Footer</footer></main>')
    })

    it('replaces server content with the fallback when the children throw while hydrating', async (t) => {
      silenceConsoleError(t)
      let inBrowser = false

      function BrowserOnly() {
        return () => {
          if (inBrowser) throw new Error('Browser failed')
          return (
            <>
              <p>One</p>
              <p>Two</p>
            </>
          )
        }
      }

      function App() {
        return () => (
          <main>
            <ErrorBoundary fallback={<p>Failed</p>}>
              <BrowserOnly />
            </ErrorBoundary>
            <footer>Footer</footer>
          </main>
        )
      }

      container.innerHTML = await renderToString(<App />)
      let serverFooter = container.querySelector('footer')
      inBrowser = true

      let root = createRoot(container)
      root.render(<App />)
      root.flush()

      expect(html(container)).toBe('<main><p>Failed</p><footer>Footer</footer></main>')
      expect(container.querySelector('footer')).toBe(serverFooter)
    })

    it('hydrates nested boundaries', async (t) => {
      silenceConsoleError(t)
      let root = await renderAndHydrate(() => (
        <ErrorBoundary fallback="Outer">
          <ErrorBoundary fallback={<p>Inner</p>}>
            <Broken />
          </ErrorBoundary>
          <span>Sibling</span>
        </ErrorBoundary>
      ))

      expect(container.innerHTML).toBe(
        '<!-- rmx:eb --><!-- rmx:eb:error --><p>Inner</p><!-- /rmx:eb --><span>Sibling</span><!-- /rmx:eb -->',
      )
      root.dispose()
    })

    it('hydrates content rendered without boundary markers', () => {
      container.innerHTML = '<main><p>Reviews</p><footer>Footer</footer></main>'
      let serverParagraph = container.querySelector('p')
      let serverFooter = container.querySelector('footer')

      let root = createRoot(container)
      root.render(
        <main>
          <ErrorBoundary fallback="Failed">
            <p>Reviews</p>
          </ErrorBoundary>
          <footer>Footer</footer>
        </main>,
      )
      root.flush()

      expect(container.querySelector('p')).toBe(serverParagraph)
      expect(container.querySelector('footer')).toBe(serverFooter)
      expect(container.innerHTML).toBe(
        '<main><!-- rmx:eb --><p>Reviews</p><!-- /rmx:eb --><footer>Footer</footer></main>',
      )
    })
  })
})
