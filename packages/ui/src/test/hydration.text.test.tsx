import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import { createRoot } from '../runtime/vdom.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/invariant.ts'

describe('hydration', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('text node handling', () => {
    it('adopts single server text node when client has multiple text children', async () => {
      // Server renders "Hello world" as single text node
      let html = await renderToString(<span>Hello world</span>)
      container.innerHTML = html

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)
      let originalTextNode = existingSpan.firstChild
      invariant(originalTextNode instanceof Text)

      // Client has two text children: ["Hello ", "world"]
      let root = createRoot(container)
      root.render(
        <span>
          {'Hello '}
          {'world'}
        </span>,
      )
      root.flush()

      // Span should be adopted
      expect(container.querySelector('span')).toBe(existingSpan)
      // Text content should match (even if internal structure differs)
      expect(existingSpan.textContent).toBe('Hello world')
    })

    it('subsequent update patches consolidated text content', async () => {
      let html = await renderToString(<span>Hello world</span>)
      container.innerHTML = html

      let existingSpan = container.querySelector('span')
      invariant(existingSpan)

      let name = 'world'
      function render() {
        root.render(
          <span>
            {'Hello '}
            {name}
          </span>,
        )
        root.flush()
      }

      let root = createRoot(container)
      render()

      expect(existingSpan.textContent).toBe('Hello world')

      // Update the dynamic part
      name = 'Ryan'
      render()

      expect(existingSpan.textContent).toBe('Hello Ryan')
    })

    it('handles null children as empty text', async () => {
      let html = await renderToString(<div>{null}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{null}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles undefined children as empty text', async () => {
      let html = await renderToString(<div>{undefined}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{undefined}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles false children as empty text', async () => {
      let html = await renderToString(<div>{false}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{false}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles true children as empty text', async () => {
      let html = await renderToString(<div>{true}</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div>{true}</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.textContent).toBe('')
    })

    it('handles a single text node larger than the browser text-node cap', async () => {
      // ~80 KB of distinct, countable lines; well above Chromium's 65536-char limit
      // which causes the HTML parser to split the text into multiple adjacent Text nodes.
      let lineCount = 10000
      let largeText = Array.from({ length: lineCount }, (_, i) => `row-${i}`).join('\n')
      // Sanity: the text must be large enough to trigger parser splitting
      expect(largeText.length).toBeGreaterThan(65536)

      let html = await renderToString(<pre>{largeText}</pre>)
      container.innerHTML = html

      let existingPre = container.querySelector('pre')
      invariant(existingPre)

      // Before hydration the parser may have split the text into multiple nodes
      // After hydration the reconciler should consolidate them into a single text node
      let root = createRoot(container)
      root.render(<pre>{largeText}</pre>)
      root.flush()

      let hydratedPre = container.querySelector('pre')
      invariant(hydratedPre)
      expect(hydratedPre).toBe(existingPre)
      // Must be a single text node — no leftover split siblings
      expect(hydratedPre.childNodes.length).toBe(1)
      // Content must match exactly — no duplication
      expect(hydratedPre.textContent).toBe(largeText)
      expect(hydratedPre.textContent.split('\n').length).toBe(lineCount)
    })
  })
})
