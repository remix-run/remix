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
    for (let node of Array.from(document.head.childNodes)) {
      document.head.removeChild(node)
    }
  })

  describe('self-closing/void elements', () => {
    it('hydrates input element', async () => {
      let html = await renderToString(<input type="text" placeholder="Enter text" />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="text" placeholder="Enter text" />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.placeholder).toBe('Enter text')
    })

    it('hydrates br element', async () => {
      let html = await renderToString(
        <div>
          Line 1<br />
          Line 2
        </div>,
      )
      container.innerHTML = html

      let existingBr = container.querySelector('br')
      invariant(existingBr)

      let root = createRoot(container)
      root.render(
        <div>
          Line 1<br />
          Line 2
        </div>,
      )
      root.flush()

      expect(container.querySelector('br')).toBe(existingBr)
    })

    it('hydrates img element', async () => {
      let html = await renderToString(<img src="/image.png" alt="Test image" />)
      container.innerHTML = html

      let existingImg = container.querySelector('img')
      invariant(existingImg)

      let root = createRoot(container)
      root.render(<img src="/image.png" alt="Test image" />)
      root.flush()

      expect(container.querySelector('img')).toBe(existingImg)
      expect(existingImg.getAttribute('src')).toBe('/image.png')
      expect(existingImg.getAttribute('alt')).toBe('Test image')
    })

    it('hydrates hr element', async () => {
      let html = await renderToString(
        <div>
          <p>Above</p>
          <hr />
          <p>Below</p>
        </div>,
      )
      container.innerHTML = html

      let existingHr = container.querySelector('hr')
      invariant(existingHr)

      let root = createRoot(container)
      root.render(
        <div>
          <p>Above</p>
          <hr />
          <p>Below</p>
        </div>,
      )
      root.flush()

      expect(container.querySelector('hr')).toBe(existingHr)
    })

    it('hydrates meta element', async () => {
      let html = await renderToString(<meta name="description" content="Test page" />)
      container.innerHTML = html

      let existingMeta = container.querySelector('meta')
      invariant(existingMeta)

      let root = createRoot(container)
      root.render(<meta name="description" content="Test page" />)
      root.flush()

      expect(document.head.querySelector('meta')).toBe(existingMeta)
      expect(container.querySelector('meta')).toBeNull()
      expect(existingMeta.getAttribute('name')).toBe('description')
      expect(existingMeta.getAttribute('content')).toBe('Test page')
    })

    it('hydrates link element', async () => {
      let html = await renderToString(<link rel="stylesheet" href="/styles.css" />)
      container.innerHTML = html

      let existingLink = container.querySelector('link')
      invariant(existingLink)

      let root = createRoot(container)
      root.render(<link rel="stylesheet" href="/styles.css" />)
      root.flush()

      expect(document.head.querySelector('link')).toBe(existingLink)
      expect(container.querySelector('link')).toBeNull()
      expect(existingLink.getAttribute('rel')).toBe('stylesheet')
      expect(existingLink.getAttribute('href')).toBe('/styles.css')
    })
  })
})
