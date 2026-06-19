import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'

import { Combobox, ComboboxOption } from './components.tsx'

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

describe('Combobox', () => {
  it('renders the styled combobox wrapper with ui primitive roles', () => {
    let { container } = renderApp(
      <Combobox inputId="framework" name="framework" placeholder="Search frameworks">
        <ComboboxOption label="Remix framework" value="remix">
          Remix
        </ComboboxOption>
      </Combobox>,
    )

    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let option = container.querySelector('[role="option"]') as HTMLElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    expect(input.id).toBe('framework')
    expect(input.placeholder).toBe('Search frameworks')
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-controls')).toBe(list.id)
    expect(option.textContent).toContain('Remix')
    expect(hiddenInput.name).toBe('framework')
  })

  it('composes ui combobox keyboard state', async () => {
    let { container, root } = renderApp(
      <Combobox inputId="framework" name="framework">
        <ComboboxOption label="Remix framework" value="remix">
          Remix
        </ComboboxOption>
      </Combobox>,
    )

    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }))
    await Promise.resolve()
    root.flush()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    root.flush()

    let option = container.querySelector('[role="option"]') as HTMLElement

    expect(input.getAttribute('aria-activedescendant')).toBe(option.id)
    expect(container.querySelector('[popover]')?.matches(':popover-open')).toBe(true)
  })
})
