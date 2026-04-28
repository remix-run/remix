import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from '../lib/vdom.ts'
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

  describe('attribute mismatch handling', () => {
    it('adopts element and patches mismatched attributes', async () => {
      let html = await renderToString(<div className="server-class" data-value="server" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div className="client-class" data-value="client" />)
      root.flush()

      // Same DOM node should be adopted (not recreated)
      expect(container.querySelector('div')).toBe(existingDiv)
      // Attributes should be patched to client values
      expect(existingDiv.getAttribute('class')).toBe('client-class')
      expect(existingDiv.getAttribute('data-value')).toBe('client')
    })

    it('adds missing attributes during hydration', async () => {
      let html = await renderToString(<div className="existing" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div className="existing" data-new="added" title="hello" />)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('data-new')).toBe('added')
      expect(existingDiv.getAttribute('title')).toBe('hello')
    })

    it('leaves extra attributes alone during hydration', async () => {
      let html = await renderToString(<div className="keep" data-extra="yes" title="extra" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.getAttribute('data-extra')).toBe('yes')
      expect(existingDiv.getAttribute('title')).toBe('extra')

      let root = createRoot(container)
      root.render(<div className="keep" />)
      root.flush()

      // Element should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('class')).toBe('keep')
      // Extra attributes left alone during hydration (not tracked, so not removed)
      expect(existingDiv.hasAttribute('data-extra')).toBe(true)
      expect(existingDiv.hasAttribute('title')).toBe(true)
    })

    it('preserves DOM node identity when only attributes differ', async () => {
      let html = await renderToString(
        <div id="test" className="old" data-value="old">
          <span>Child</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('#test')
      let existingSpan = container.querySelector('span')
      invariant(existingDiv && existingSpan)

      let root = createRoot(container)
      root.render(
        <div id="test" className="new" data-value="new">
          <span>Child</span>
        </div>,
      )
      root.flush()

      // Both parent and child should be the same DOM nodes
      expect(container.querySelector('#test')).toBe(existingDiv)
      expect(container.querySelector('span')).toBe(existingSpan)
    })
  })

  describe('type mismatch handling', () => {
    it('advances cursor once on type mismatch to find our element', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Inject different element type at start
      let injected = document.createElement('div')
      injected.className = 'injected'
      existingDiv.insertBefore(injected, existingSpan)

      // Suppress console.error for expected hydration mismatch log
      let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      errorSpy.mockRestore()

      // Our span should be adopted after advancing past injected div
      expect(container.querySelector('span')).toBe(existingSpan)
    })

    it('recreates element if retry also fails', async () => {
      let html = await renderToString(
        <div>
          <span>Original</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Replace span with completely different structure
      existingDiv.innerHTML = '<div>Wrong</div><p>Also wrong</p>'

      let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let root = createRoot(container)
      root.render(
        <div>
          <span>Original</span>
        </div>,
      )
      root.flush()

      errorSpy.mockRestore()

      // Should have created a new span since no match found
      let newSpan = container.querySelector('span')
      expect(newSpan).not.toBe(existingSpan)
      expect(newSpan?.textContent).toBe('Original')
    })

    it('leaves skipped nodes in place', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      // Inject element that will be skipped
      let skipped = document.createElement('aside')
      skipped.id = 'skipped'
      skipped.textContent = 'Extension content'
      existingDiv.insertBefore(skipped, existingSpan)

      let errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      errorSpy.mockRestore()

      // Skipped element should still be in the DOM
      expect(existingDiv.querySelector('#skipped')).toBe(skipped)
    })
  })
})
