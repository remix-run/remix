import {
  Checkbox,
  CheckboxChangeEvent,
  CheckboxGroup,
  CheckboxGroupChangeEvent,
  CheckboxGroupParent,
  CheckboxItem,
  onCheckboxGroupChange,
  onCheckboxChange,
  type CheckboxState,
} from '@remix-run/ui/components/checkbox'
import { createRoot, type RemixNode } from '@remix-run/ui'
import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

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

describe('Checkbox component', () => {
  it('renders mixed aria state on a native checkbox input', () => {
    let inputRef: HTMLInputElement | null = null
    let { container } = renderApp(
      <Checkbox
        defaultChecked="mixed"
        inputRef={(input) => {
          inputRef = input
        }}
        name="selection"
      />,
    )

    let input = container.querySelector('input[type="checkbox"]') as HTMLInputElement

    expect(input).toBe(inputRef)
    expect(input.getAttribute('aria-checked')).toBe('mixed')
    expect(input.getAttribute('data-state')).toBe('mixed')
    expect(input.checked).toBe(false)
    expect(input.indeterminate).toBe(true)
    expect(input.name).toBe('selection')
  })

  it('toggles from mixed to checked with click and space', () => {
    let changes: CheckboxState[] = []
    let events: CheckboxState[] = []
    let { container, root } = renderApp(
      <div
        mix={onCheckboxChange((event) => {
          events.push(event.checked)
        })}
      >
        <Checkbox
          defaultChecked="mixed"
          onCheckedChange={(checked) => {
            changes.push(checked)
          }}
        />
      </div>,
    )

    let input = container.querySelector('input[type="checkbox"]') as HTMLInputElement

    input.click()
    root.flush()

    expect(input.getAttribute('aria-checked')).toBe('true')
    expect(input.checked).toBe(true)
    expect(input.indeterminate).toBe(false)
    expect(changes).toEqual([true])
    expect(events).toEqual([true])

    input.click()
    root.flush()

    expect(input.getAttribute('aria-checked')).toBe('false')
    expect(input.checked).toBe(false)
    expect(changes).toEqual([true, false])
    expect(events).toEqual([true, false])
  })

  it('does not toggle when disabled or read-only', () => {
    let disabledChanges: CheckboxState[] = []
    let readOnlyChanges: CheckboxState[] = []
    let { container, root } = renderApp(
      <>
        <Checkbox
          defaultChecked="mixed"
          disabled
          onCheckedChange={(checked) => {
            disabledChanges.push(checked)
          }}
        />
        <Checkbox
          defaultChecked="mixed"
          onCheckedChange={(checked) => {
            readOnlyChanges.push(checked)
          }}
          readOnly
        />
      </>,
    )

    let controls = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]

    controls[0]?.click()
    controls[1]?.click()
    root.flush()

    expect(controls[0]?.getAttribute('aria-disabled')).toBe('true')
    expect(controls[0]?.getAttribute('aria-checked')).toBe('mixed')
    expect(controls[1]?.getAttribute('aria-readonly')).toBe('true')
    expect(controls[1]?.getAttribute('aria-checked')).toBe('mixed')
    expect(disabledChanges).toEqual([])
    expect(readOnlyChanges).toEqual([])
  })

  it('keeps read-only state when an associated label activates the input', () => {
    let { container, root } = renderApp(
      <label>
        <Checkbox id="read-only-checkbox" readOnly />
        Read only
      </label>,
    )

    let label = container.querySelector('label') as HTMLLabelElement
    let input = container.querySelector('#read-only-checkbox') as HTMLInputElement

    label.click()
    root.flush()

    expect(input.getAttribute('aria-checked')).toBe('false')
    expect(input.checked).toBe(false)
    expect(input.indeterminate).toBe(false)
  })

  it('dispatches CheckboxChangeEvent from the input', () => {
    let events: CheckboxChangeEvent[] = []
    let { container, root } = renderApp(
      <div
        mix={onCheckboxChange((event) => {
          events.push(event)
        })}
      >
        <Checkbox />
      </div>,
    )

    let input = container.querySelector('input[type="checkbox"]') as HTMLInputElement
    input.click()
    root.flush()

    let event = events[0]
    expect(event).toBeInstanceOf(CheckboxChangeEvent)
    expect(event?.checked).toBe(true)
  })
})

describe('CheckboxGroup component', () => {
  it('renders the parent checkbox as mixed when some children are selected', () => {
    let { container } = renderApp(
      <CheckboxGroup defaultValue={['read']}>
        <CheckboxGroupParent aria-label="All permissions" />
        <CheckboxItem aria-label="Read" value="read" />
        <CheckboxItem aria-label="Write" value="write" />
      </CheckboxGroup>,
    )

    let inputs = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]

    expect(inputs[0]?.getAttribute('aria-checked')).toBe('mixed')
    expect(inputs[0]?.getAttribute('data-state')).toBe('mixed')
    expect(inputs[0]?.indeterminate).toBe(true)
    expect(inputs[1]?.checked).toBe(true)
    expect(inputs[1]?.getAttribute('data-state')).toBe('checked')
    expect(inputs[2]?.checked).toBe(false)
    expect(inputs[2]?.getAttribute('data-state')).toBe('unchecked')
  })

  it('updates parent state when children toggle', () => {
    let values: string[][] = []
    let events: CheckboxGroupChangeEvent[] = []
    let { container, root } = renderApp(
      <CheckboxGroup
        defaultValue={['read']}
        mix={onCheckboxGroupChange((event) => {
          events.push(event)
        })}
        onValueChange={(value) => {
          values.push(value)
        }}
      >
        <CheckboxGroupParent aria-label="All permissions" />
        <CheckboxItem aria-label="Read" value="read" />
        <CheckboxItem aria-label="Write" value="write" />
      </CheckboxGroup>,
    )

    let inputs = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    let parent = inputs[0] as HTMLInputElement
    let write = inputs[2] as HTMLInputElement

    write.click()
    root.flush()

    expect(parent.getAttribute('aria-checked')).toBe('true')
    expect(parent.checked).toBe(true)
    expect(write.checked).toBe(true)
    expect(write.getAttribute('data-state')).toBe('checked')
    expect(values).toEqual([['read', 'write']])
    expect(events[0]).toBeInstanceOf(CheckboxGroupChangeEvent)
    expect(events[0]?.changedValue).toBe('write')
    expect(events[0]?.value).toEqual(['read', 'write'])

    write.click()
    root.flush()

    expect(parent.getAttribute('aria-checked')).toBe('mixed')
    expect(parent.indeterminate).toBe(true)
    expect(write.checked).toBe(false)
    expect(write.getAttribute('data-state')).toBe('unchecked')
    expect(values).toEqual([['read', 'write'], ['read']])
  })

  it('selects or clears enabled children from the parent checkbox', () => {
    let { container, root } = renderApp(
      <CheckboxGroup defaultValue={['read']}>
        <CheckboxGroupParent aria-label="All permissions" />
        <CheckboxItem aria-label="Read" value="read" />
        <CheckboxItem aria-label="Write" value="write" />
        <CheckboxItem aria-label="Deploy" disabled value="deploy" />
      </CheckboxGroup>,
    )

    let inputs = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    let parent = inputs[0] as HTMLInputElement
    let read = inputs[1] as HTMLInputElement
    let write = inputs[2] as HTMLInputElement
    let deploy = inputs[3] as HTMLInputElement

    parent.click()
    root.flush()

    expect(parent.getAttribute('aria-checked')).toBe('true')
    expect(read.checked).toBe(true)
    expect(write.checked).toBe(true)
    expect(deploy.checked).toBe(false)

    parent.click()
    root.flush()

    expect(parent.getAttribute('aria-checked')).toBe('false')
    expect(read.checked).toBe(false)
    expect(write.checked).toBe(false)
    expect(deploy.checked).toBe(false)
  })

  it('passes the group name to child item inputs', () => {
    let { container } = renderApp(
      <CheckboxGroup defaultValue={['read']} name="permissions">
        <CheckboxGroupParent aria-label="All permissions" />
        <CheckboxItem aria-label="Read" value="read" />
        <CheckboxItem aria-label="Write" name="custom-permissions" value="write" />
      </CheckboxGroup>,
    )

    let inputs = [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]

    expect(inputs[1]?.name).toBe('permissions')
    expect(inputs[1]?.value).toBe('read')
    expect(inputs[2]?.name).toBe('custom-permissions')
    expect(inputs[2]?.value).toBe('write')
  })
})
