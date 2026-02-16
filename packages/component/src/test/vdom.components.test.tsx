import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
import { invariant } from '../lib/invariant.ts'
import type { Handle } from '../lib/component.ts'

describe('vnode rendering', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

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

    it('hoists head-managed elements on client updates', () => {
      let container = document.createElement('div')
      document.body.appendChild(container)

      let rerender = () => {}

      function App(handle: Handle) {
        let phase = 0
        rerender = () => {
          phase++
          handle.update()
        }

        return () => {
          if (phase === 0) {
            return (
              <>
                <title>Page A</title>
                <meta name="description" content="A" />
                <script type="application/ld+json">{'{"name":"A"}'}</script>
                <script type="text/javascript">window.__regular = "A"</script>
                <div>Phase A</div>
              </>
            )
          }

          if (phase === 1) {
            return (
              <>
                <title>Page B</title>
                <meta name="description" content="B" />
                <script type="application/ld+json">{'{"name":"B"}'}</script>
                <div>Phase B</div>
              </>
            )
          }

          return <div>Phase C</div>
        }
      }

      let root = createRoot(container)
      root.render(<App />)
      root.flush()

      expect(document.head.querySelector('title')?.textContent).toBe('Page A')
      expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
        'A',
      )
      expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toBe(
        '{"name":"A"}',
      )
      expect(container.querySelector('script[type="text/javascript"]')).toBeTruthy()
      expect(container.querySelector('title')).toBeNull()
      expect(container.querySelector('meta[name="description"]')).toBeNull()
      expect(container.querySelector('script[type="application/ld+json"]')).toBeNull()

      rerender()
      root.flush()

      expect(document.head.querySelector('title')?.textContent).toBe('Page B')
      expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
        'B',
      )
      expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1)
      expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toBe(
        '{"name":"B"}',
      )
      expect(container.innerHTML).toBe('<div>Phase B</div>')

      rerender()
      root.flush()

      expect(document.head.querySelector('title')).toBeNull()
      expect(document.head.querySelector('meta[name="description"]')).toBeNull()
      expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()
      expect(container.innerHTML).toBe('<div>Phase C</div>')
    })

    it('dispose cleans up explicit head subtree', () => {
      let container = document.createElement('div')
      document.body.appendChild(container)

      let root = createRoot(container)
      root.render(
        <>
          <head>
            <title>Dispose title</title>
            <meta name="dispose-description" content="dispose" />
            <script type="application/ld+json">{'{"dispose":true}'}</script>
          </head>
          <div>Content</div>
        </>,
      )
      root.flush()

      expect(document.head.querySelector('title')?.textContent).toBe('Dispose title')
      expect(document.head.querySelector('meta[name="dispose-description"]')).toBeTruthy()
      expect(document.head.querySelector('script[type="application/ld+json"]')?.textContent).toBe(
        '{"dispose":true}',
      )

      root.dispose()

      expect(document.head.querySelector('title')).toBeNull()
      expect(document.head.querySelector('meta[name="dispose-description"]')).toBeNull()
      expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull()
      expect(container.innerHTML).toBe('')
    })
  })
})
