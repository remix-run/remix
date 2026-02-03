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

  describe('boolean attributes', () => {
    it('hydrates disabled attribute', async () => {
      let html = await renderToString(<button disabled>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      expect(existingButton.disabled).toBe(true)

      let root = createRoot(container)
      root.render(<button disabled>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(true)
    })

    it('hydrates readonly attribute', async () => {
      let html = await renderToString(<input readOnly />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input readOnly />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.readOnly).toBe(true)
    })

    it('hydrates required attribute', async () => {
      let html = await renderToString(<input required />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input required />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.required).toBe(true)
    })

    it('hydrates multiple attribute on select', async () => {
      let html = await renderToString(
        <select multiple>
          <option>A</option>
          <option>B</option>
        </select>,
      )
      container.innerHTML = html

      let existingSelect = container.querySelector('select')
      invariant(existingSelect)

      let root = createRoot(container)
      root.render(
        <select multiple>
          <option>A</option>
          <option>B</option>
        </select>,
      )
      root.flush()

      expect(container.querySelector('select')).toBe(existingSelect)
      expect(existingSelect.multiple).toBe(true)
    })

    it('hydrates hidden attribute', async () => {
      let html = await renderToString(<div hidden>Hidden content</div>)
      container.innerHTML = html

      let existingDiv = container.querySelector('div')
      invariant(existingDiv)

      let root = createRoot(container)
      root.render(<div hidden>Hidden content</div>)
      root.flush()

      expect(container.querySelector('div')).toBe(existingDiv)
      expect(existingDiv.hidden).toBe(true)
    })

    it('hydrates boolean attribute with true value', async () => {
      let html = await renderToString(<button disabled={true}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<button disabled={true}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(true)
    })

    it('hydrates boolean attribute with false value', async () => {
      let html = await renderToString(<button disabled={false}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)

      let root = createRoot(container)
      root.render(<button disabled={false}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(false)
    })
  })
})
