import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createRoot, type RemixNode } from '@remix-run/ui'

import { ToggleChangeEvent, onToggleChange } from './primitives.ts'
import * as toggle from './primitives.ts'

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

describe('toggle.control', () => {
  it('tracks switch state on a native checkbox input', () => {
    let changes: boolean[] = []
    let events: ToggleChangeEvent[] = []
    let inputRef: HTMLInputElement | null = null

    let { container, root } = renderApp(
      <div
        mix={onToggleChange((event) => {
          events.push(event)
        })}
      >
        <input
          aria-label="Notifications"
          mix={toggle.control({
            defaultChecked: true,
            inputRef: (input) => {
              inputRef = input
            },
            name: 'notifications',
            onCheckedChange: (checked) => {
              changes.push(checked)
            },
          })}
        />
      </div>,
    )

    let input = container.querySelector('input[type="checkbox"]') as HTMLInputElement

    expect(input).toBe(inputRef)
    expect(input.name).toBe('notifications')
    expect(input.checked).toBe(true)
    expect(input.getAttribute('role')).toBe('switch')
    expect(input.getAttribute('aria-checked')).toBe(null)
    expect(input.getAttribute('data-state')).toBe('checked')

    input.click()
    root.flush()

    expect(input.checked).toBe(false)
    expect(input.getAttribute('aria-checked')).toBe(null)
    expect(input.getAttribute('data-state')).toBe('unchecked')
    expect(changes).toEqual([false])
    expect(events[0]).toBeInstanceOf(ToggleChangeEvent)
    expect(events[0]?.checked).toBe(false)
  })

  it('supports non-input hosts with switch role and space-key toggling', () => {
    let changes: boolean[] = []
    let { container, root } = renderApp(
      <span
        aria-label="Standalone span"
        mix={toggle.control({
          onCheckedChange: (checked) => {
            changes.push(checked)
          },
        })}
      />,
    )

    let control = container.querySelector('[role="switch"]') as HTMLElement

    expect(control.tabIndex).toBe(0)
    expect(control.getAttribute('aria-checked')).toBe('false')
    expect(control.getAttribute('data-state')).toBe('unchecked')

    control.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
    root.flush()

    expect(control.getAttribute('aria-checked')).toBe('true')
    expect(control.getAttribute('data-state')).toBe('checked')
    expect(changes).toEqual([true])
  })

  it('does not toggle when disabled or read-only', () => {
    let disabledChanges: boolean[] = []
    let readOnlyChanges: boolean[] = []
    let { container, root } = renderApp(
      <>
        <input
          mix={toggle.control({
            defaultChecked: true,
            disabled: true,
            onCheckedChange: (checked) => {
              disabledChanges.push(checked)
            },
          })}
        />
        <input
          mix={toggle.control({
            defaultChecked: true,
            onCheckedChange: (checked) => {
              readOnlyChanges.push(checked)
            },
            readOnly: true,
          })}
        />
      </>,
    )

    let controls = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]

    controls[0]?.click()
    controls[1]?.click()
    root.flush()

    expect(controls[0]?.checked).toBe(true)
    expect(controls[0]?.getAttribute('data-state')).toBe('checked')
    expect(controls[1]?.checked).toBe(true)
    expect(controls[1]?.getAttribute('data-state')).toBe('checked')
    expect(disabledChanges).toEqual([])
    expect(readOnlyChanges).toEqual([])
  })
})
