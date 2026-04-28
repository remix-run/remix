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

  describe('form elements', () => {
    it('hydrates input with value attribute', async () => {
      let html = await renderToString(<input type="text" value="server value" readOnly />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="text" value="server value" readOnly />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.value).toBe('server value')
    })

    it('hydrates input with defaultValue', async () => {
      let html = await renderToString(<input type="text" defaultValue="default" />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="text" defaultValue="default" />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.value).toBe('default')
    })

    it('hydrates checkbox with checked attribute', async () => {
      let html = await renderToString(<input type="checkbox" checked readOnly />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="checkbox" checked readOnly />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.checked).toBe(true)
    })

    it('hydrates checkbox with defaultChecked', async () => {
      let html = await renderToString(<input type="checkbox" defaultChecked />)
      container.innerHTML = html

      let existingInput = container.querySelector('input')
      invariant(existingInput)

      let root = createRoot(container)
      root.render(<input type="checkbox" defaultChecked />)
      root.flush()

      expect(container.querySelector('input')).toBe(existingInput)
      expect(existingInput.checked).toBe(true)
    })

    it('hydrates radio with checked attribute', async () => {
      let html = await renderToString(
        <div>
          <input type="radio" name="choice" value="a" checked readOnly />
          <input type="radio" name="choice" value="b" readOnly />
        </div>,
      )
      container.innerHTML = html

      let inputs = container.querySelectorAll('input')
      expect(inputs[0].checked).toBe(true)
      expect(inputs[1].checked).toBe(false)

      let root = createRoot(container)
      root.render(
        <div>
          <input type="radio" name="choice" value="a" checked readOnly />
          <input type="radio" name="choice" value="b" readOnly />
        </div>,
      )
      root.flush()

      let hydratedInputs = container.querySelectorAll('input')
      expect(hydratedInputs[0]).toBe(inputs[0])
      expect(hydratedInputs[1]).toBe(inputs[1])
      expect(hydratedInputs[0].checked).toBe(true)
      expect(hydratedInputs[1].checked).toBe(false)
    })

    it('hydrates textarea with value', async () => {
      let html = await renderToString(<textarea value="textarea content" readOnly />)
      container.innerHTML = html

      let existingTextarea = container.querySelector('textarea')
      invariant(existingTextarea)

      let root = createRoot(container)
      root.render(<textarea value="textarea content" readOnly />)
      root.flush()

      expect(container.querySelector('textarea')).toBe(existingTextarea)
      expect(existingTextarea.value).toBe('textarea content')
    })

    it('hydrates select with selected option', async () => {
      let html = await renderToString(
        <select value="b">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>,
      )
      container.innerHTML = html

      let existingSelect = container.querySelector('select')
      invariant(existingSelect)

      let root = createRoot(container)
      root.render(
        <select value="b">
          <option value="a">A</option>
          <option value="b">B</option>
          <option value="c">C</option>
        </select>,
      )
      root.flush()

      expect(container.querySelector('select')).toBe(existingSelect)
      expect(existingSelect.value).toBe('b')
    })
  })
})
