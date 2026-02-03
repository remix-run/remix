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
  })
})
