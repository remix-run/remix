import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createRoot, type RemixNode } from '@remix-run/ui'

import { CheckboxChangeEvent, onCheckboxChange, type CheckboxState } from './primitives.ts'
import * as checkbox from './primitives.ts'

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

describe('checkbox.control', () => {
  it('tracks mixed state on a native checkbox input without a provider', () => {
    let changes: CheckboxState[] = []
    let events: CheckboxChangeEvent[] = []
    let inputRef: HTMLInputElement | null = null

    let { container, root } = renderApp(
      <div
        mix={onCheckboxChange((event) => {
          events.push(event)
        })}
      >
        <input
          aria-label="Standalone"
          mix={checkbox.control({
            defaultChecked: 'mixed',
            inputRef: (input) => {
              inputRef = input
            },
            name: 'selection',
            onCheckedChange: (checked) => {
              changes.push(checked)
            },
          })}
        />
      </div>,
    )

    let input = container.querySelector('input[type="checkbox"]') as HTMLInputElement

    expect(input).toBe(inputRef)
    expect(input.name).toBe('selection')
    expect(input.checked).toBe(false)
    expect(input.indeterminate).toBe(true)
    expect(input.getAttribute('aria-checked')).toBe('mixed')
    expect(input.getAttribute('data-state')).toBe('mixed')

    input.click()
    root.flush()

    expect(input.checked).toBe(true)
    expect(input.indeterminate).toBe(false)
    expect(input.getAttribute('aria-checked')).toBe('true')
    expect(input.getAttribute('data-state')).toBe('checked')
    expect(changes).toEqual([true])
    expect(events[0]).toBeInstanceOf(CheckboxChangeEvent)
    expect(events[0]?.checked).toBe(true)
  })

  it('supports non-input hosts with checkbox role and space-key toggling', () => {
    let changes: CheckboxState[] = []
    let { container, root } = renderApp(
      <span
        aria-label="Standalone span"
        mix={checkbox.control({
          defaultChecked: 'mixed',
          onCheckedChange: (checked) => {
            changes.push(checked)
          },
        })}
      />,
    )

    let control = container.querySelector('[role="checkbox"]') as HTMLElement

    expect(control.tabIndex).toBe(0)
    expect(control.getAttribute('aria-checked')).toBe('mixed')
    expect(control.getAttribute('data-state')).toBe('mixed')

    control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
    root.flush()

    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.getAttribute('data-state')).toBe('checked')
    expect(changes).toEqual([true])
  })
})
