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

  describe('special case props to HTML attributes', () => {
    it('hydrates className as class attribute', async () => {
      let html = await renderToString(<div className="my-class">Hello</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)
      expect(existingDiv.getAttribute('class')).toBe('my-class')

      let root = createRoot(container)
      root.render(<div className="my-class">Hello</div>)
      root.flush()

      // Same DOM node should be adopted
      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('class')).toBe('my-class')
    })

    it('hydrates htmlFor as for attribute', async () => {
      let html = await renderToString(
        <div>
          <label htmlFor="my-input">Label</label>
          <input id="my-input" />
        </div>,
      )
      container.innerHTML = html

      let existingLabel = container.querySelector('label')
      invariant(existingLabel)
      expect(existingLabel.getAttribute('for')).toBe('my-input')

      let root = createRoot(container)
      root.render(
        <div>
          <label htmlFor="my-input">Label</label>
          <input id="my-input" />
        </div>,
      )
      root.flush()

      expect(container.querySelector('label')).toBe(existingLabel)
      expect(existingLabel.getAttribute('for')).toBe('my-input')
    })

    it('hydrates tabIndex as tabindex attribute', async () => {
      let html = await renderToString(<button tabIndex={0}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<button tabIndex={0}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.getAttribute('tabindex')).toBe('0')
    })

    it('hydrates acceptCharset as accept-charset attribute', async () => {
      let html = await renderToString(<form acceptCharset="UTF-8" />)
      container.innerHTML = html

      let existingForm = container.querySelector('form')
      invariant(existingForm)

      let root = createRoot(container)
      root.render(<form acceptCharset="UTF-8" />)
      root.flush()

      expect(container.querySelector('form')).toBe(existingForm)
      expect(existingForm.getAttribute('accept-charset')).toBe('UTF-8')
    })

    it('hydrates httpEquiv as http-equiv attribute', async () => {
      let html = await renderToString(<meta httpEquiv="refresh" content="5" />)
      container.innerHTML = html

      let existingMeta = container.querySelector('meta')
      invariant(existingMeta)

      let root = createRoot(container)
      root.render(<meta httpEquiv="refresh" content="5" />)
      root.flush()

      expect(document.head.querySelector('meta')).toBe(existingMeta)
      expect(container.querySelector('meta')).toBeNull()
      expect(existingMeta.getAttribute('http-equiv')).toBe('refresh')
    })

    it('hydrates aria-* attributes unchanged', async () => {
      let html = await renderToString(
        <button aria-label="Close" aria-expanded="false">
          X
        </button>,
      )
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(
        <button aria-label="Close" aria-expanded="false">
          X
        </button>,
      )
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.getAttribute('aria-label')).toBe('Close')
      expect(existingButton.getAttribute('aria-expanded')).toBe('false')
    })

    it('hydrates data-* attributes unchanged', async () => {
      let html = await renderToString(<div data-testid="my-div" data-value="42" />)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div data-testid="my-div" data-value="42" />)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.getAttribute('data-testid')).toBe('my-div')
      expect(existingDiv.getAttribute('data-value')).toBe('42')
    })

    it('hydrates SVG xlinkHref as xlink:href', async () => {
      let html = await renderToString(
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )
      container.innerHTML = html

      let existingUse = container.querySelector('use')
      invariant(existingUse)

      let root = createRoot(container)
      root.render(
        <svg>
          <use xlinkHref="#icon-star" />
        </svg>,
      )
      root.flush()

      expect(container.querySelector('use')).toBe(existingUse)
      expect(existingUse.getAttributeNS('http://www.w3.org/1999/xlink', 'href')).toBe('#icon-star')
    })

    it('hydrates SVG viewBox with preserved case', async () => {
      let html = await renderToString(<svg viewBox="0 0 24 24" />)
      container.innerHTML = html

      let existingSvg = container.querySelector('svg')
      invariant(existingSvg)

      let root = createRoot(container)
      root.render(<svg viewBox="0 0 24 24" />)
      root.flush()

      expect(container.querySelector('svg')).toBe(existingSvg)
      expect(existingSvg.getAttribute('viewBox')).toBe('0 0 24 24')
    })

    it('hydrates SVG preserveAspectRatio with preserved case', async () => {
      let html = await renderToString(<svg preserveAspectRatio="xMidYMid meet" />)
      container.innerHTML = html

      let existingSvg = container.querySelector('svg')
      invariant(existingSvg)

      let root = createRoot(container)
      root.render(<svg preserveAspectRatio="xMidYMid meet" />)
      root.flush()

      expect(container.querySelector('svg')).toBe(existingSvg)
      expect(existingSvg.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')
    })
  })
})
