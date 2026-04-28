import { describe, it, expect, beforeEach, afterEach } from 'vitest'
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

  describe('extra DOM nodes (browser extension injection)', () => {
    it('ignores extra nodes at the end of container', async () => {
      let html = await renderToString(
        <div>
          <span>Our content</span>
        </div>,
      )
      container.innerHTML = html

      // Simulate browser extension injecting content at the end
      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let injected = document.createElement('aside')
      injected.id = 'ext-injected'
      injected.textContent = 'extension content'
      existingDiv.appendChild(injected)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      // Our content should be adopted
      expect(container.querySelector('span')).toBe(existingSpan)
      // Injected content should still be there
      expect(existingDiv.querySelector('#ext-injected')).toBe(injected)
    })

    it('skips injected node at start and adopts our content', async () => {
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

      // Simulate browser extension injecting content at the START
      let injected = document.createElement('aside')
      injected.id = 'ext-start'
      injected.textContent = 'extension content'
      existingDiv.insertBefore(injected, existingSpan)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      // Our span should be adopted (cursor advanced past injected aside)
      expect(container.querySelector('span')).toBe(existingSpan)
      // Injected content should still be there
      expect(existingDiv.querySelector('#ext-start')).toBe(injected)
    })

    it('handles injected nodes at both start and end', async () => {
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

      // Inject at start
      let injectedStart = document.createElement('aside')
      injectedStart.id = 'ext-start'
      injectedStart.textContent = 'start extension'
      existingDiv.insertBefore(injectedStart, existingSpan)

      // Inject at end
      let injectedEnd = document.createElement('aside')
      injectedEnd.id = 'ext-end'
      injectedEnd.textContent = 'end extension'
      existingDiv.appendChild(injectedEnd)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Our content</span>
        </div>,
      )
      root.flush()

      // Our span should be adopted
      expect(container.querySelector('span')).toBe(existingSpan)
      // Both injected elements should remain
      expect(existingDiv.querySelector('#ext-start')).toBe(injectedStart)
      expect(existingDiv.querySelector('#ext-end')).toBe(injectedEnd)
    })

    it('extra nodes survive through subsequent updates', async () => {
      let html = await renderToString(
        <div>
          <span>Content 1</span>
        </div>,
      )
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      // Inject at end
      let injected = document.createElement('aside')
      injected.id = 'extension'
      injected.textContent = 'extension content'
      existingDiv.appendChild(injected)

      let root = createRoot(container)
      root.render(
        <div>
          <span>Content 1</span>
        </div>,
      )
      root.flush()

      expect(existingDiv.querySelector('#extension')).toBe(injected)

      // Update our content
      root.render(
        <div>
          <span>Content 2</span>
        </div>,
      )
      root.flush()

      // Injected content should still be there after update
      expect(existingDiv.querySelector('#extension')).toBe(injected)
      expect(existingDiv.querySelector('span')?.textContent).toBe('Content 2')
    })
  })
})
