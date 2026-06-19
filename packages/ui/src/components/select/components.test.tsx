import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'

import { Option, Select, triggerStyle } from './components.tsx'

let roots: ReturnType<typeof createRoot>[] = []

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('Select', () => {
  it('renders the styled select wrapper with ui primitive roles', () => {
    let { container } = renderApp(
      <Select defaultLabel="Select a framework" name="framework">
        <Option label="Remix framework" value="remix">
          Remix
        </Option>
        <Option disabled label="React Router framework" value="react-router">
          React Router
        </Option>
      </Select>,
    )

    let trigger = container.querySelector('button') as HTMLButtonElement
    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let options = container.querySelectorAll('[role="option"]')
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    expect(trigger.type).toBe('button')
    expect(trigger.textContent).toContain('Select a framework')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger.getAttribute('aria-controls')).toBe(list.id)
    expect(options).toHaveLength(2)
    expect(hiddenInput.name).toBe('framework')
  })

  it('composes ui select state updates', async () => {
    let { container, root } = renderApp(
      <Select defaultLabel="Select a framework">
        <Option label="Remix framework" value="remix">
          Remix
        </Option>
      </Select>,
    )

    let trigger = container.querySelector('button') as HTMLButtonElement
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'r' }))
    await Promise.resolve()
    root.flush()

    expect(trigger.textContent).toContain('Remix framework')
    expect(container.querySelector('[role="option"]')?.getAttribute('aria-selected')).toBe('true')
  })

  it('serializes the trigger style with the input frame treatment', async () => {
    let html = await renderToString(<button mix={triggerStyle}>Select a framework</button>)

    expect(html).toMatch(/height: 32px/)
    expect(html).toMatch(/padding-inline-start: 12px/)
    expect(html).toMatch(/padding-inline-end: 8px/)
    expect(html).toMatch(/border-radius: 8px/)
    expect(html).toMatch(/background: #FFFFFF/)
    expect(html).toMatch(/0 0 0 1px rgba\(0, 0, 0, 0\.12\)/)
    expect(html).toMatch(/font-weight: 400/)
    expect(html).toMatch(/font-size: 13px/)
    expect(html).toMatch(/line-height: 20px/)
    expect(html).toMatch(/:focus-visible/)
    expect(html).toMatch(/outline: 0/)
    expect(html).toMatch(/0 0 0 1px #3573F6/)
    expect(html).not.toMatch(/outline: 2px solid/)
    expect(html).not.toMatch(/transition/)
  })
})
