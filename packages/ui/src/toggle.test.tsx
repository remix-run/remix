import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'
import { createRoot, on, type RemixNode } from '@remix-run/component'

import { ToggleChangeEvent, onToggleChange, toggle } from './toggle.ts'

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

function nextTask() {
  return new Promise<void>((resolve) => setTimeout(resolve))
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('toggle', () => {
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
          mix={toggle({
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

  it('works without options', () => {
    let { container, root } = renderApp(<button mix={toggle()} type="button" />)
    let button = container.querySelector('button') as HTMLButtonElement

    expect(button.getAttribute('aria-checked')).toBe('false')

    button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ' ' }))
    root.flush()

    expect(button.getAttribute('aria-checked')).toBe('true')
    expect(button.dataset.state).toBe('checked')
  })

  it('supports non-input hosts with switch role and space-key toggling', () => {
    let changes: boolean[] = []
    let { container, root } = renderApp(
      <span
        aria-label="Standalone span"
        mix={toggle({
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
          mix={toggle({
            defaultChecked: true,
            disabled: true,
            onCheckedChange: (checked) => {
              disabledChanges.push(checked)
            },
          })}
        />
        <input
          mix={toggle({
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

  it('restores defaultChecked and data-state when the form resets', async () => {
    let changes: boolean[] = []
    let { container, root } = renderApp(
      <form>
        <input name="a" mix={toggle({ onCheckedChange: (checked) => changes.push(checked) })} />
        <input name="b" mix={toggle({ defaultChecked: true })} />
      </form>,
    )
    let form = container.querySelector('form') as HTMLFormElement
    let [a, b] = [...container.querySelectorAll('input')] as HTMLInputElement[]

    a.click()
    b.click()
    root.flush()

    expect([a.checked, b.checked]).toEqual([true, false])

    form.reset()
    await nextTask()
    root.flush()

    expect([a.checked, b.checked]).toEqual([false, true])
    expect([a.dataset.state, b.dataset.state]).toEqual(['unchecked', 'checked'])
    expect(changes).toEqual([true])

    a.click()
    root.flush()

    expect(a.checked).toBe(true)
    expect(a.dataset.state).toBe('checked')
  })

  it('keeps controlled state and DOM in sync across a form reset', async () => {
    let { container, root } = renderApp(
      <form>
        <input mix={toggle({ checked: true })} />
      </form>,
    )
    let input = container.querySelector('input') as HTMLInputElement

    ;(container.querySelector('form') as HTMLFormElement).reset()
    await nextTask()
    root.flush()

    expect(input.checked).toBe(true)
    expect(input.dataset.state).toBe('checked')
  })

  it('ignores a canceled form reset', async () => {
    let { container, root } = renderApp(
      <form
        mix={on('reset', (event) => {
          event.preventDefault()
        })}
      >
        <input mix={toggle()} />
      </form>,
    )
    let input = container.querySelector('input') as HTMLInputElement

    input.click()
    root.flush()
    ;(container.querySelector('form') as HTMLFormElement).reset()
    await nextTask()
    root.flush()

    expect(input.checked).toBe(true)
    expect(input.dataset.state).toBe('checked')
  })
})
