import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, resetStyleState } from '../lib/vdom.ts'
import { renderToString } from '../lib/stream.ts'
import { invariant } from '../lib/invariant.ts'
import { css } from '../index.ts'

describe('hydration', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('css mixin hydration', () => {
    afterEach(() => {
      // Reset the global style manager state between tests
      resetStyleState()
    })

    it('hydrates element with css mixin and adopts server style', async () => {
      let html = await renderToString(<div mix={[css({ color: 'red' })]}>Hello</div>)

      // Inject server styles into document.head and append body content
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let originalClass = existingDiv.className
      expect(originalClass).toMatch(/rmxc-/)

      let root = createRoot(container)
      root.render(<div mix={[css({ color: 'red' })]}>Hello</div>)
      root.flush()

      // Element should be adopted (same DOM node)
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.className).toBe(originalClass)
      // Style should apply
      expect(getComputedStyle(existingDiv).color).toBe('rgb(255, 0, 0)')
    })

    it('updates css mixin after hydration', async () => {
      let html = await renderToString(<div mix={[css({ color: 'red' })]}>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div mix={[css({ color: 'red' })]}>Hello</div>)
      root.flush()

      expect(getComputedStyle(existingDiv).color).toBe('rgb(255, 0, 0)')

      // Update to different css mixin
      root.render(<div mix={[css({ color: 'blue' })]}>Hello</div>)
      root.flush()

      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 0, 255)')
      expect(existingDiv.className).toMatch(/rmxc-/)
    })

    it('hydrates css mixin combined with className', async () => {
      let html = await renderToString(
        <div className="my-class" mix={[css({ color: 'green' })]}>
          Hello
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.className).toContain('my-class')
      expect(existingDiv.className).toMatch(/rmxc-/)

      let root = createRoot(container)
      root.render(
        <div className="my-class" mix={[css({ color: 'green' })]}>
          Hello
        </div>,
      )
      root.flush()

      // Element should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.className).toContain('my-class')
      expect(existingDiv.className).toMatch(/rmxc-/)
      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 128, 0)')
    })

    it('multiple elements with same css mixin share style during hydration', async () => {
      let html = await renderToString(
        <div>
          <span mix={[css({ color: 'purple' })]}>First</span>
          <span mix={[css({ color: 'purple' })]}>Second</span>
        </div>,
      )
      container.innerHTML = html

      let spans = container.querySelectorAll('span')
      expect(spans).toHaveLength(2)

      let firstClassName = spans[0].className
      let secondClassName = spans[1].className
      expect(firstClassName).toBe(secondClassName)
      expect(firstClassName).toMatch(/rmxc-/)

      let root = createRoot(container)
      root.render(
        <div>
          <span mix={[css({ color: 'purple' })]}>First</span>
          <span mix={[css({ color: 'purple' })]}>Second</span>
        </div>,
      )
      root.flush()

      // Both spans should be adopted
      let hydratedSpans = container.querySelectorAll('span')
      expect(hydratedSpans[0]).toBe(spans[0])
      expect(hydratedSpans[1]).toBe(spans[1])

      expect(hydratedSpans[0].className).toBe(firstClassName)
      expect(hydratedSpans[1].className).toBe(firstClassName)

      // Style should apply to both
      expect(getComputedStyle(hydratedSpans[0]).color).toBe('rgb(128, 0, 128)')
      expect(getComputedStyle(hydratedSpans[1]).color).toBe('rgb(128, 0, 128)')
    })

    it('handles element unmount with css mixin after hydration', async () => {
      let html = await renderToString(
        <div>
          <span mix={[css({ color: 'orange' })]}>Will unmount</span>
        </div>,
      )
      container.innerHTML = html

      let root = createRoot(container)
      root.render(
        <div>
          <span mix={[css({ color: 'orange' })]}>Will unmount</span>
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

    it('adds css mixin during hydration when server had none', async () => {
      let html = await renderToString(<div>Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.className).toBe('')

      // Client adds css mixin
      let root = createRoot(container)
      root.render(<div mix={[css({ color: 'cyan' })]}>Hello</div>)
      root.flush()

      // Element should be adopted and css applied
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.className).toMatch(/rmxc-/)
      expect(getComputedStyle(existingDiv).color).toBe('rgb(0, 255, 255)')
    })
  })
})
