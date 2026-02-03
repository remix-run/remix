import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, resetStyleState } from '../lib/vdom.ts'
import { renderToString } from '../lib/stream.ts'
import { invariant } from '../lib/invariant.ts'

describe('hydration', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('css prop hydration', () => {
    afterEach(() => {
      // Reset the global style manager state between tests
      resetStyleState()
    })

    it('hydrates element with css prop and adopts server style', async () => {
      let html = await renderToString(<div css={{ color: 'red' }}>Hello</div>)

      // Inject server styles into document.head and append body content
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let originalDataCss = existingDiv.getAttribute('data-css')
      expect(originalDataCss).toMatch(/^rmx-/)

      let root = createRoot(container)
      root.render(<div css={{ color: 'red' }}>Hello</div>)
      root.flush()

      // Element should be adopted (same DOM node)
      expect(container.querySelector('div')).toBe(existingDiv)
      // data-css attribute should be preserved
      expect(existingDiv.getAttribute('data-css')).toBe(originalDataCss)
      // Style should apply
      expect(getComputedStyle(existingDiv).color).toBe('rgb(255, 0, 0)')
    })

    it('updates css prop after hydration', async () => {
      let html = await renderToString(<div css={{ color: 'red' }}>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div css={{ color: 'red' }}>Hello</div>)
      root.flush()

      expect(getComputedStyle(existingDiv).color).toBe('rgb(255, 0, 0)')

      // Update to different css
      root.render(<div css={{ color: 'blue' }}>Hello</div>)
      root.flush()

      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 0, 255)')
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)
    })

    it('removes css prop after hydration', async () => {
      let html = await renderToString(<div css={{ color: 'red' }}>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div css={{ color: 'red' }}>Hello</div>)
      root.flush()

      expect(existingDiv.hasAttribute('data-css')).toBe(true)

      // Remove css prop entirely
      root.render(<div>Hello</div>)
      root.flush()

      expect(existingDiv.hasAttribute('data-css')).toBe(false)
    })

    it('hydrates css prop combined with className', async () => {
      let html = await renderToString(
        <div className="my-class" css={{ color: 'green' }}>
          Hello
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.className).toBe('my-class')
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)

      let root = createRoot(container)
      root.render(
        <div className="my-class" css={{ color: 'green' }}>
          Hello
        </div>,
      )
      root.flush()

      // Element should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      // Both className and data-css should be preserved
      expect(existingDiv.className).toBe('my-class')
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)
      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 128, 0)')
    })

    it('multiple elements with same css share style during hydration', async () => {
      let html = await renderToString(
        <div>
          <span css={{ color: 'purple' }}>First</span>
          <span css={{ color: 'purple' }}>Second</span>
        </div>,
      )
      container.innerHTML = html

      let spans = container.querySelectorAll('span')
      expect(spans).toHaveLength(2)

      // Both should have the same data-css selector (deduplication)
      let firstDataCss = spans[0].getAttribute('data-css')
      let secondDataCss = spans[1].getAttribute('data-css')
      expect(firstDataCss).toBe(secondDataCss)
      expect(firstDataCss).toMatch(/^rmx-/)

      let root = createRoot(container)
      root.render(
        <div>
          <span css={{ color: 'purple' }}>First</span>
          <span css={{ color: 'purple' }}>Second</span>
        </div>,
      )
      root.flush()

      // Both spans should be adopted
      let hydratedSpans = container.querySelectorAll('span')
      expect(hydratedSpans[0]).toBe(spans[0])
      expect(hydratedSpans[1]).toBe(spans[1])

      // Both should still have the same data-css
      expect(hydratedSpans[0].getAttribute('data-css')).toBe(firstDataCss)
      expect(hydratedSpans[1].getAttribute('data-css')).toBe(firstDataCss)

      // Style should apply to both
      expect(getComputedStyle(hydratedSpans[0]).color).toBe('rgb(128, 0, 128)')
      expect(getComputedStyle(hydratedSpans[1]).color).toBe('rgb(128, 0, 128)')
    })

    it('handles element unmount with css prop after hydration', async () => {
      let html = await renderToString(
        <div>
          <span css={{ color: 'orange' }}>Will unmount</span>
        </div>,
      )
      container.innerHTML = html

      let root = createRoot(container)
      root.render(
        <div>
          <span css={{ color: 'orange' }}>Will unmount</span>
        </div>,
      )
      root.flush()

      expect(container.querySelector('span')).not.toBe(null)

      // Remove the span
      root.render(<div />)
      root.flush()

      // Span should be gone
      expect(container.querySelector('span')).toBe(null)
    })

    it('adds css prop during hydration when server had none', async () => {
      // Server renders without css prop
      let html = await renderToString(<div>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.hasAttribute('data-css')).toBe(false)

      // Client adds css prop
      let root = createRoot(container)
      root.render(<div css={{ color: 'cyan' }}>Hello</div>)
      root.flush()

      // Element should be adopted and css applied
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('data-css')).toMatch(/^rmx-/)
      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 255, 255)')
    })
  })
})
