import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import { on } from '../index.ts'
import { createRoot } from '../runtime/vdom.ts'
import { createElement } from '../runtime/create-element.ts'
import { renderToString } from '../server/stream.ts'
import { invariant } from '../runtime/core/vnode.ts'

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
    it('keeps array defaults for an empty-string multiple attribute across mounting and hydration', async (t) => {
      let attrs: Record<string, unknown> = { multiple: '' }
      let node = (
        <form>
          <select {...attrs} defaultValue={['a', 'b']}>
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </form>
      )
      let clientContainer = document.createElement('div')
      let clientRoot = createRoot(clientContainer)
      t.after(() => clientRoot.dispose())
      clientRoot.render(node)
      clientRoot.flush()

      let mountedForm = clientContainer.querySelector('form')
      let mountedSelect = clientContainer.querySelector('select')
      invariant(mountedForm && mountedSelect)
      expect([...mountedSelect.selectedOptions].map((option) => option.value)).toEqual(['a', 'b'])
      mountedSelect.value = 'a'
      mountedForm.reset()
      expect([...mountedSelect.selectedOptions].map((option) => option.value)).toEqual(['a', 'b'])

      container.innerHTML = await renderToString(node)
      let existingForm = container.querySelector('form')
      let existingSelect = container.querySelector('select')
      invariant(existingForm && existingSelect)
      expect([...existingSelect.selectedOptions].map((option) => option.value)).toEqual(['a', 'b'])

      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(node)
      root.flush()

      expect(container.querySelector('select')).toBe(existingSelect)
      expect([...existingSelect.selectedOptions].map((option) => option.value)).toEqual(['a', 'b'])
      existingSelect.value = 'a'
      existingForm.reset()
      expect([...existingSelect.selectedOptions].map((option) => option.value)).toEqual(['a', 'b'])
    })

    it('keeps native global booleans on custom elements when mounting and hydrating', async (t) => {
      let node = createElement('x-remix-native-global-booleans', { inert: '' })
      container.innerHTML = await renderToString(node)
      let existing = container.firstElementChild
      invariant(existing instanceof HTMLElement)
      expect(existing.inert).toBe(true)

      let root = createRoot(container)
      t.after(() => root.dispose())
      root.render(node)
      root.flush()

      expect(container.firstElementChild).toBe(existing)
      expect(existing.inert).toBe(true)

      let clientContainer = document.createElement('div')
      let clientRoot = createRoot(clientContainer)
      t.after(() => clientRoot.dispose())
      clientRoot.render(node)
      clientRoot.flush()

      let mounted = clientContainer.firstElementChild
      invariant(mounted instanceof HTMLElement)
      expect(mounted.inert).toBe(true)
    })

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

    it('keeps boolean attributes given an empty string present, as the server renders them', async () => {
      // Untyped attribute objects, such as headless UI libraries' slot attributes, use "" for a
      // present boolean attribute.
      let attrs = { disabled: '', hidden: '' } as Record<string, unknown>
      let html = await renderToString(<button {...attrs}>Click</button>)
      container.innerHTML = html

      let existingButton = container.querySelector('button')
      invariant(existingButton)
      expect(existingButton.disabled).toBe(true)
      expect(existingButton.hidden).toBe(true)

      let root = createRoot(container)
      root.render(<button {...attrs}>Click</button>)
      root.flush()

      expect(container.querySelector('button')).toBe(existingButton)
      expect(existingButton.disabled).toBe(true)
      expect(existingButton.hidden).toBe(true)
    })
  })

  it('keeps and replays form control edits made before hydration', async () => {
    let events: string[] = []
    let form = (
      <form
        mix={[
          on('input', (event) => {
            invariant(event.target instanceof HTMLInputElement)
            let { name, type, checked, value } = event.target
            events.push(`input ${name}=${type === 'checkbox' ? checked : value}`)
          }),
          on('change', (event) => {
            invariant(event.target instanceof HTMLInputElement)
            events.push(`change ${event.target.name}`)
          }),
        ]}
      >
        <input name="q" value="" />
        <input name="agree" type="checkbox" checked={false} />
      </form>
    )
    container.innerHTML = await renderToString(form)
    let text = container.querySelector<HTMLInputElement>('input[name="q"]')
    let checkbox = container.querySelector<HTMLInputElement>('input[name="agree"]')
    invariant(text && checkbox)
    text.value = 'accessibility'
    checkbox.checked = true

    let root = createRoot(container)
    root.render(form)
    root.flush()

    expect(text.value).toBe('accessibility')
    expect(checkbox.checked).toBe(true)
    expect(events).toEqual([
      'input q=accessibility',
      'change q',
      'input agree=true',
      'change agree',
    ])
  })

  it('does not replay server values the browser normalized', async () => {
    let events: string[] = []
    let form = (
      <form
        mix={on('input', (event) => {
          invariant(event.target instanceof HTMLInputElement)
          events.push(event.target.name)
        })}
      >
        <input name="color" type="color" value="#FF0000" />
        <input name="email" type="email" value=" a@b.co " />
        <input name="range" type="range" max="100" value="150" />
        <input name="number" type="number" value="abc" />
        <input name="text" value={'a\nb'} />
      </form>
    )
    container.innerHTML = await renderToString(form)

    let root = createRoot(container)
    root.render(form)
    root.flush()

    expect(events).toEqual([])
  })
})
