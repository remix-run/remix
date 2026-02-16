import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Handle } from '../lib/component.ts'
import { createRoot } from '../lib/vdom.ts'
import { renderToString } from '../lib/stream.ts'
import { clientEntry } from '../lib/client-entries.ts'
import { invariant } from '../lib/invariant.ts'

describe('hydration', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

  describe('component edge cases', () => {
    it('hydrates component that returns null', async () => {
      function NullComponent() {
        return () => null
      }

      let html = await renderToString(
        <div>
          <NullComponent />
          <span>After</span>
        </div>,
      )
      container.innerHTML = html

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let root = createRoot(container)
      root.render(
        <div>
          <NullComponent />
          <span>After</span>
        </div>,
      )
      root.flush()

      expect(container.querySelector('span')).toBe(existingSpan)
      expect(existingSpan.textContent).toBe('After')
    })

    it('hydrates component that returns fragment', async () => {
      function FragmentComponent() {
        return () => (
          <>
            <span>First</span>
            <span>Second</span>
          </>
        )
      }

      let html = await renderToString(
        <div>
          <FragmentComponent />
        </div>,
      )
      container.innerHTML = html

      let spans = container.querySelectorAll('span')
      expect(spans).toHaveLength(2)

      let root = createRoot(container)
      root.render(
        <div>
          <FragmentComponent />
        </div>,
      )
      root.flush()

      let hydratedSpans = container.querySelectorAll('span')
      expect(hydratedSpans[0]).toBe(spans[0])
      expect(hydratedSpans[1]).toBe(spans[1])
    })

    it('hydrates nested hydration boundaries', async () => {
      let Outer = clientEntry('/outer.js#Outer', function Outer(handle: Handle) {
        return (props: { children: any }) => <div className="outer">{props.children}</div>
      })

      let Inner = clientEntry('/inner.js#Inner', function Inner(handle: Handle) {
        return () => <span className="inner">Inner content</span>
      })

      let html = await renderToString(
        <Outer>
          <Inner />
        </Outer>,
      )
      container.innerHTML = html

      // Should have hydration comment markers
      expect(html).toContain('<!-- rmx:h:')
      expect(html).toContain('<!-- /rmx:h -->')

      let existingOuter = container.querySelector('.outer')
      let existingInner = container.querySelector('.inner')
      invariant(existingOuter && existingInner)

      // For this test, we use createRoot which should handle the comment markers
      let root = createRoot(container)
      root.render(
        <Outer>
          <Inner />
        </Outer>,
      )
      root.flush()

      // Both should be adopted
      expect(container.querySelector('.outer')).toBe(existingOuter)
      expect(container.querySelector('.inner')).toBe(existingInner)
    })

    it('hydrates component with state preservation', async () => {
      function Counter(handle: Handle, setup: number) {
        let count = setup
        return () => (
          <button
            on={{
              click: () => {
                count++
                handle.update()
              },
            }}
          >
            Count: {count}
          </button>
        )
      }

      let html = await renderToString(<Counter setup={5} />)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      expect(existingButton.textContent).toBe('Count: 5')

      let root = createRoot(container)
      root.render(<Counter setup={5} />)
      root.flush()

      // Button should be adopted
      expect(container.querySelector('button')).toBe(existingButton)

      // Clicking should work
      existingButton.click()
      root.flush()

      expect(existingButton.textContent).toBe('Count: 6')
    })
  })

  describe('additional scenarios', () => {
    it('hydrates context across component boundaries', async () => {
      function Provider(handle: Handle<{ value: string }>) {
        handle.context.set({ value: 'from context' })
        return (props: { children: any }) => <div className="provider">{props.children}</div>
      }

      function Consumer(handle: Handle) {
        let ctx = handle.context.get(Provider)
        return () => <span className="consumer">{ctx?.value ?? 'no context'}</span>
      }

      let html = await renderToString(
        <Provider>
          <Consumer />
        </Provider>,
      )
      container.innerHTML = html

      let existingProvider = container.querySelector('.provider')
      let existingConsumer = container.querySelector('.consumer')
      invariant(existingProvider && existingConsumer)
      expect(existingConsumer.textContent).toBe('from context')

      let root = createRoot(container)
      root.render(
        <Provider>
          <Consumer />
        </Provider>,
      )
      root.flush()

      expect(container.querySelector('.provider')).toBe(existingProvider)
      expect(container.querySelector('.consumer')).toBe(existingConsumer)
      expect(existingConsumer.textContent).toBe('from context')
    })

    it('hydrates SVG elements with case-sensitive tags', async () => {
      let html = await renderToString(
        <svg>
          <defs>
            <linearGradient id="grad1">
              <stop offset="0%" stopColor="red" />
              <stop offset="100%" stopColor="blue" />
            </linearGradient>
          </defs>
          <rect fill="url(#grad1)" width="100" height="100" />
        </svg>,
      )
      container.innerHTML = html

      let existingSvg = container.querySelector('svg')
      let existingGradient = container.querySelector('linearGradient')
      let existingRect = container.querySelector('rect')
      invariant(existingSvg && existingGradient && existingRect)

      let root = createRoot(container)
      root.render(
        <svg>
          <defs>
            <linearGradient id="grad1">
              <stop offset="0%" stopColor="red" />
              <stop offset="100%" stopColor="blue" />
            </linearGradient>
          </defs>
          <rect fill="url(#grad1)" width="100" height="100" />
        </svg>,
      )
      root.flush()

      expect(container.querySelector('svg')).toBe(existingSvg)
      expect(container.querySelector('linearGradient')).toBe(existingGradient)
      expect(container.querySelector('rect')).toBe(existingRect)
    })

    it('hydrates innerHTML prop', async () => {
      let html = await renderToString(<div innerHTML="<span>Raw HTML</span>" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.innerHTML).toBe('<span>Raw HTML</span>')

      let root = createRoot(container)
      root.render(<div innerHTML="<span>Raw HTML</span>" />)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.innerHTML).toBe('<span>Raw HTML</span>')
    })

    it('hydrates style prop as object', async () => {
      let html = await renderToString(
        <div style={{ color: 'red', backgroundColor: 'blue', padding: '10px' }}>Styled</div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(
        <div style={{ color: 'red', backgroundColor: 'blue', padding: '10px' }}>Styled</div>,
      )
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      // Style should be applied
      expect(existingDiv.style.color).toBe('red')
      expect(existingDiv.style.backgroundColor).toBe('blue')
    })

    it('calls connect callback after hydration', async () => {
      let connectedNode: HTMLDivElement | null = null

      function WithConnect() {
        return () => (
          <div
            connect={(node) => {
              connectedNode = node as HTMLDivElement
            }}
          >
            Connected
          </div>
        )
      }

      let html = await renderToString(<WithConnect />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<WithConnect />)
      root.flush()

      // Connect should be called with the adopted node
      expect(connectedNode).toBe(existingDiv)
    })

    it('attaches event handlers during hydration', async () => {
      let clicked = false

      function Clickable() {
        return () => (
          <button
            on={{
              click: () => {
                clicked = true
              },
            }}
          >
            Click me
          </button>
        )
      }

      let html = await renderToString(<Clickable />)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<Clickable />)
      root.flush()

      // Button should be adopted
      expect(container.querySelector('button')).toBe(existingButton)

      // Event should work
      existingButton.click()
      expect(clicked).toBe(true)
    })

    it('hydrates keyed elements', async () => {
      let items = [
        { id: 'a', text: 'Item A' },
        { id: 'b', text: 'Item B' },
        { id: 'c', text: 'Item C' },
      ]

      let html = await renderToString(
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>,
      )
      container.innerHTML = html

      let existingItems = container.querySelectorAll('li')
      expect(existingItems).toHaveLength(3)

      let root = createRoot(container)
      root.render(
        <ul>
          {items.map((item) => (
            <li key={item.id}>{item.text}</li>
          ))}
        </ul>,
      )
      root.flush()

      let hydratedItems = container.querySelectorAll('li')
      expect(hydratedItems[0]).toBe(existingItems[0])
      expect(hydratedItems[1]).toBe(existingItems[1])
      expect(hydratedItems[2]).toBe(existingItems[2])
    })

    it('hydrates deeply nested elements', async () => {
      let html = await renderToString(
        <div className="level-1">
          <div className="level-2">
            <div className="level-3">
              <div className="level-4">
                <span>Deep content</span>
              </div>
            </div>
          </div>
        </div>,
      )
      container.innerHTML = html

      let level1 = container.querySelector('.level-1')
      let level2 = container.querySelector('.level-2')
      let level3 = container.querySelector('.level-3')
      let level4 = container.querySelector('.level-4')
      let span = container.querySelector('span')
      invariant(level1 && level2 && level3 && level4 && span)

      let root = createRoot(container)
      root.render(
        <div className="level-1">
          <div className="level-2">
            <div className="level-3">
              <div className="level-4">
                <span>Deep content</span>
              </div>
            </div>
          </div>
        </div>,
      )
      root.flush()

      // All levels should be adopted
      expect(container.querySelector('.level-1')).toBe(level1)
      expect(container.querySelector('.level-2')).toBe(level2)
      expect(container.querySelector('.level-3')).toBe(level3)
      expect(container.querySelector('.level-4')).toBe(level4)
      expect(container.querySelector('span')).toBe(span)
    })

    it('hoists head-managed elements during hydration', () => {
      container.innerHTML =
        '<title>Hydrated title</title>' +
        '<meta name="description" content="Hydrated description" />' +
        '<script type="application/ld+json">{"@type":"Thing","name":"Hydrated"}</script>' +
        '<div id="content">Body content</div>'

      let existingTitle = container.querySelector('title')
      let existingMeta = container.querySelector('meta[name="description"]')
      let existingLdJson = container.querySelector('script[type="application/ld+json"]')
      let existingContent = container.querySelector('#content')
      invariant(existingTitle && existingMeta && existingLdJson && existingContent)

      let root = createRoot(container)
      root.render(
        <>
          <title>Hydrated title</title>
          <meta name="description" content="Hydrated description" />
          <script type="application/ld+json">{'{"@type":"Thing","name":"Hydrated"}'}</script>
          <div id="content">Body content</div>
        </>,
      )
      root.flush()

      expect(document.head.querySelector('title')).toBe(existingTitle)
      expect(document.head.querySelector('meta[name="description"]')).toBe(existingMeta)
      expect(document.head.querySelector('script[type="application/ld+json"]')).toBe(existingLdJson)
      expect(container.querySelector('title')).toBeNull()
      expect(container.querySelector('meta[name="description"]')).toBeNull()
      expect(container.querySelector('script[type="application/ld+json"]')).toBeNull()
      expect(container.querySelector('#content')).toBe(existingContent)
    })
  })
})
