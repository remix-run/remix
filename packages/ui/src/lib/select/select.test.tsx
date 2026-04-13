import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type RemixNode } from '@remix-run/component'

import { Option, Select, SelectCloseRequestEvent, select } from './select.tsx'
import type { SelectChangeEvent } from './select.tsx'
import type { SelectProps } from './select.tsx'

let flashDurationMs = 75
let labelDelayMs = 50
let pointerSelectionGuardMs = 300
let typeaheadTimeoutMs = 750
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

function renderSelect(props: Partial<SelectProps> = {}) {
  return (
    <Select initialLabel="Select a framework" name="framework" {...props}>
      <Option label="Remix framework" value="remix">
        Remix
      </Option>
      <Option disabled label="React Router framework" value="react-router">
        React Router
      </Option>
      <Option label="React framework" value="react">
        React
      </Option>
    </Select>
  )
}

function getOptionByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option) => option.textContent?.trim() === text,
  ) as HTMLElement
}

function stubScrollIntoView(node: HTMLElement) {
  let spy = vi.fn()

  Object.defineProperty(node, 'scrollIntoView', {
    configurable: true,
    value: spy,
  })

  return spy
}

function pointer(
  target: HTMLElement,
  type: 'click' | 'pointerdown' | 'pointerup',
  options: { button?: number } = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: options.button ?? 0,
    }),
  )
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

async function openSelect(container: HTMLElement, root: ReturnType<typeof createRoot>) {
  let trigger = container.querySelector('button') as HTMLButtonElement
  pointer(trigger, 'pointerdown')
  await settle(root)
  pointer(trigger, 'pointerup')
  pointer(trigger, 'click')
  await settleFrames(root)
}

async function settle(root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  root.flush()
  await Promise.resolve()
  root.flush()
}

async function settleFrames(root: ReturnType<typeof createRoot>) {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
  await settle(root)
}

async function finishCloseTransition(surface: HTMLElement) {
  await Promise.resolve()
  surface.dispatchEvent(new TransitionEvent('transitionrun', { propertyName: 'opacity' }))
  surface.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
  await Promise.resolve()
}

async function finishSelectUpdate(
  surface: HTMLElement,
  root: ReturnType<typeof createRoot>,
) {
  await vi.advanceTimersByTimeAsync(flashDurationMs)
  await finishCloseTransition(surface)
  await settle(root)
  await vi.advanceTimersByTimeAsync(labelDelayMs)
  await settle(root)
}

beforeEach(() => {
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
  vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  for (let root of roots) {
    root.render(null)
    root.flush()
  }
  roots = []
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
})

describe('Select', () => {
  it.todo('wires aria-expanded on the trigger while the popup opens and closes')

  it.todo('wires aria-controls from the trigger to the controlled popup surface')

  it.todo('wires aria-activedescendant on the list to the highlighted option')

  it('applies defaultValue to the hidden input and selected option while keeping initialLabel', async () => {
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    await settle(root)

    expect(trigger.textContent).toContain('Select a framework')
    expect(hiddenInput.value).toBe('react')

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let react = getOptionByText(container, 'React')

    expect(react.getAttribute('aria-selected')).toBe('true')
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('keeps the initial label before selection UI settles and still registers options through indirection', async () => {
    function Indirection() {
      return () => (
        <>
          <Option label="Bug" value="bug" />
          <Option label="Feature" value="feature" />
        </>
      )
    }

    let { container, root } = renderApp(
      <Select initialLabel="Select a type" name="issue-type">
        <Indirection />
      </Select>,
    )
    let surface = container.querySelector('[popover]') as HTMLElement
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    expect(trigger.textContent).toContain('Select a type')
    expect(hiddenInput.value).toBe('')

    await openSelect(container, root)
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(pointerSelectionGuardMs)
    await settle(root)

    let feature = getOptionByText(container, 'Feature')
    pointer(feature, 'pointerdown')
    pointer(feature, 'pointerup')
    pointer(feature, 'click')
    await settle(root)

    expect(trigger.textContent).toContain('Select a type')
    expect(hiddenInput.value).toBe('feature')

    await finishSelectUpdate(surface, root)

    expect(trigger.textContent).toContain('Feature')
    expect(hiddenInput.value).toBe('feature')
  })

  it('commits the trigger label after the flash, close transition, and wrapper delay while the hidden input updates immediately', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    expect(trigger.textContent).toContain('Select a framework')
    expect(hiddenInput.value).toBe('')
    expect(surface.matches(':popover-open')).toBe(false)

    await openSelect(container, root)
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(pointerSelectionGuardMs)
    await settle(root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(react.getAttribute('data-select-flash')).toBe('true')
    expect(hiddenInput.value).toBe('react')
    expect(surface.matches(':popover-open')).toBe(true)

    await vi.advanceTimersByTimeAsync(flashDurationMs)
    await settle(root)

    expect(trigger.textContent).toContain('Select a framework')
    expect(hiddenInput.value).toBe('react')
    expect(surface.matches(':popover-open')).toBe(false)

    await finishCloseTransition(surface)
    await settle(root)

    expect(trigger.textContent).toContain('Select a framework')
    expect(hiddenInput.value).toBe('react')

    await vi.advanceTimersByTimeAsync(labelDelayMs)
    await settle(root)

    expect(trigger.textContent).toContain('React framework')
    expect(trigger.textContent).not.toContain('React Router framework')
    expect(hiddenInput.value).toBe('react')
  })

  it('locks document scrolling while the popover is open', async () => {
    let { container, root } = renderApp(renderSelect())
    let surface = container.querySelector('[popover]') as HTMLElement

    await openSelect(container, root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.body.style.position).toBe('fixed')

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    key(list, 'Escape')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.body.style.position).toBe('')
  })

  it('ignores the opening pointer release if it lands on an option immediately after open', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    pointer(trigger, 'pointerdown')
    await settle(root)

    let remix = getOptionByText(container, 'Remix')
    pointer(remix, 'pointerup')
    pointer(remix, 'click')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(hiddenInput.value).toBe('')
    expect(remix.getAttribute('data-select-flash')).toBe(null)

    await vi.advanceTimersByTimeAsync(pointerSelectionGuardMs)
    await settle(root)

    pointer(remix, 'pointerdown')
    pointer(remix, 'pointerup')
    pointer(remix, 'click')
    await settle(root)

    expect(remix.getAttribute('data-select-flash')).toBe('true')
    expect(hiddenInput.value).toBe('remix')
  })

  it('allows the opening pointer release to select once the pointer moves to a different option', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    pointer(trigger, 'pointerdown')
    await settle(root)

    let remix = getOptionByText(container, 'Remix')
    remix.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    await settle(root)

    pointer(remix, 'pointerup')
    pointer(remix, 'click')
    await settle(root)

    expect(remix.getAttribute('data-select-flash')).toBe('true')
    expect(hiddenInput.value).toBe('remix')
  })

  it('ignores ambient popup close requests while selection is in flight', async () => {
    let closeRequestPrevented = false
    let { container, root } = renderApp(renderSelect())
    let surface = container.querySelector('[popover]') as HTMLElement

    surface.addEventListener(select.closerequest, (event) => {
      if (!(event instanceof SelectCloseRequestEvent)) {
        return
      }

      closeRequestPrevented = event.defaultPrevented
    })

    await openSelect(container, root)
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(pointerSelectionGuardMs)
    await settle(root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    key(surface, 'Escape')
    await settle(root)

    expect(closeRequestPrevented).toBe(true)
    expect(surface.matches(':popover-open')).toBe(true)

    await finishSelectUpdate(surface, root)

    expect(surface.matches(':popover-open')).toBe(false)
  })

  it('sets the popover min-width from the trigger before opening', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement

    Object.defineProperty(trigger, 'offsetWidth', {
      configurable: true,
      value: 212,
    })

    expect(surface.style.minWidth).toBe('')

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')

    expect(surface.style.minWidth).toBe('212px')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('opens from a click-only virtual press and moves focus to the list', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement

    pointer(trigger, 'click')
    await settle(root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('typeahead on the closed trigger selects a matching value and emits Select.change immediately', async () => {
    vi.useFakeTimers()

    let changes: SelectChangeEvent[] = []
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    container.addEventListener(Select.change, (event) => {
      changes.push(event as SelectChangeEvent)
    })

    trigger.focus()
    key(trigger, 'r')
    await settle(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('remix')
    expect(hiddenInput.value).toBe('remix')
    expect(surface.matches(':popover-open')).toBe(false)
    expect(trigger.textContent).toContain('Select a framework')

    await vi.advanceTimersByTimeAsync(labelDelayMs)
    await settle(root)

    expect(trigger.textContent).toContain('Remix framework')
  })

  it('typeahead on the open list highlights the next enabled match without selecting it', async () => {
    let { container, root } = renderApp(renderSelect())
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let react = getOptionByText(container, 'React')
    let reactRouter = getOptionByText(container, 'React Router')

    key(list, 'r')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(react.getAttribute('data-highlighted')).toBe('true')
    expect(reactRouter.getAttribute('data-highlighted')).toBe('false')
    expect(hiddenInput.value).toBe('')
  })

  it('typeahead on the closed trigger supports searchValue strings and arrays, timeout reset, and Escape clearing', async () => {
    vi.useFakeTimers()

    let changes: SelectChangeEvent[] = []
    let { container, root } = renderApp(
      <Select initialLabel="Select an environment" name="environment">
        <Option label="Production" value="production" />
        <Option label="Staging" searchValue="beta" value="staging" />
        <Option label="Local" searchValue={['dev', 'workbench']} value="local" />
      </Select>,
    )
    let trigger = container.querySelector('button') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    container.addEventListener(Select.change, (event) => {
      changes.push(event as SelectChangeEvent)
    })

    trigger.focus()
    key(trigger, 'b')
    await settle(root)

    expect(changes.map((event) => event.value)).toEqual(['staging'])
    expect(hiddenInput.value).toBe('staging')

    await vi.advanceTimersByTimeAsync(typeaheadTimeoutMs + 1)
    await settle(root)

    key(trigger, 'd')
    await settle(root)

    expect(changes.map((event) => event.value)).toEqual(['staging', 'local'])
    expect(hiddenInput.value).toBe('local')

    key(trigger, 'Escape')
    await settle(root)

    key(trigger, 'b')
    await settle(root)

    expect(changes.map((event) => event.value)).toEqual(['staging', 'local', 'staging'])
    expect(hiddenInput.value).toBe('staging')
  })

  it('typeahead on the open list builds and trims multi-character queries without selecting', async () => {
    let { container, root } = renderApp(
      <Select defaultValue="export" initialLabel="Select an action" name="action">
        <Option label="Save" value="save" />
        <Option label="Search" value="search" />
        <Option label="Export" value="export" />
      </Select>,
    )
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let save = getOptionByText(container, 'Save')
    let search = getOptionByText(container, 'Search')
    let exportAction = getOptionByText(container, 'Export')

    expect(list.getAttribute('aria-activedescendant')).toBe(exportAction.id)
    expect(hiddenInput.value).toBe('export')

    key(list, 's')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(save.id)
    expect(hiddenInput.value).toBe('export')

    key(list, 'e')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(search.id)
    expect(hiddenInput.value).toBe('export')

    key(list, 'Backspace')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(save.id)
    expect(hiddenInput.value).toBe('export')
  })

  it('typeahead on the open list still matches after pointerleave clears the active option', async () => {
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLDivElement
    let remix = getOptionByText(container, 'Remix')

    list.dispatchEvent(new PointerEvent('pointerleave'))
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(null)

    key(list, 'r')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('ArrowDown on the trigger opens the list with the first enabled option active', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement

    key(trigger, 'ArrowDown')
    await settle(root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')

    expect(surface.matches(':popover-open')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('ArrowUp on the trigger opens the list with the last enabled option active', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement

    key(trigger, 'ArrowUp')
    await settle(root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let react = getOptionByText(container, 'React')

    expect(surface.matches(':popover-open')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('scrolls the active option into view during keyboard navigation', async () => {
    let { container, root } = renderApp(
      <Select defaultValue="staging" initialLabel="Select an environment" name="environment">
        <Option label="Local" value="local" />
        <Option label="Staging" value="staging" />
        <Option label="Production" value="production" />
      </Select>,
    )
    let trigger = container.querySelector('button') as HTMLButtonElement
    let staging = getOptionByText(container, 'Staging')
    let production = getOptionByText(container, 'Production')
    let scrollStaging = stubScrollIntoView(staging)
    let scrollProduction = stubScrollIntoView(production)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement

    expect(list.getAttribute('aria-activedescendant')).toBe(staging.id)
    expect(scrollStaging).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })

    key(list, 'ArrowDown')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(production.id)
    expect(scrollProduction).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })
  })

  it('clears the active option when the pointer leaves the list', async () => {
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let react = getOptionByText(container, 'React')

    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)

    list.dispatchEvent(new PointerEvent('pointerleave'))
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('ArrowDown and ArrowUp restart from the boundaries after the active option is cleared', async () => {
    let { container, root } = renderApp(
      <Select defaultValue="staging" initialLabel="Select an environment" name="environment">
        <Option label="Local" value="local" />
        <Option label="Staging" value="staging" />
        <Option label="Production" value="production" />
      </Select>,
    )

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let local = getOptionByText(container, 'Local')
    let staging = getOptionByText(container, 'Staging')
    let production = getOptionByText(container, 'Production')

    expect(list.getAttribute('aria-activedescendant')).toBe(staging.id)

    list.dispatchEvent(new PointerEvent('pointerleave'))
    list.dispatchEvent(new FocusEvent('focus'))
    await settle(root)

    key(list, 'ArrowDown')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(local.id)

    list.dispatchEvent(new PointerEvent('pointerleave'))
    list.dispatchEvent(new FocusEvent('focus'))
    await settle(root)

    key(list, 'ArrowUp')
    await settle(root)

    expect(list.getAttribute('aria-activedescendant')).toBe(production.id)
  })

  it('ArrowDown and ArrowUp on the closed trigger reopen from the selected option', async () => {
    let { container, root } = renderApp(
      <Select defaultValue="staging" initialLabel="Select an environment" name="environment">
        <Option label="Local" value="local" />
        <Option label="Staging" value="staging" />
        <Option label="Production" value="production" />
      </Select>,
    )

    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement
    key(trigger, 'ArrowDown')
    await settle(root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let staging = getOptionByText(container, 'Staging')

    expect(list.getAttribute('aria-activedescendant')).toBe(staging.id)
    expect(document.activeElement).toBe(list)

    key(list, 'Escape')
    await settle(root)
    await finishCloseTransition(surface)
    await settle(root)

    key(trigger, 'ArrowUp')
    await settle(root)

    list = container.querySelector('[role="listbox"]') as HTMLElement

    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(staging.id)
  })

  it('Tab keeps the popup open and activates the first enabled option', async () => {
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))
    let surface = container.querySelector('[popover]') as HTMLElement

    await openSelect(container, root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')

    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)

    key(list, 'Tab')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('ignores repeated Enter keydowns after focus moves from the trigger to the open list', async () => {
    vi.useFakeTimers()

    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))
    let trigger = container.querySelector('button') as HTMLButtonElement
    let surface = container.querySelector('[popover]') as HTMLElement

    trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    await settle(root)

    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let react = getOptionByText(container, 'React')

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(list)
    expect(list.getAttribute('aria-activedescendant')).toBe(react.id)

    list.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', repeat: true }))
    await settle(root)

    expect(react.getAttribute('data-select-flash')).toBe(null)
    expect(surface.matches(':popover-open')).toBe(true)
  })

  it('bubbles Select.change after the flash and close transition settle', async () => {
    let changes: SelectChangeEvent[] = []
    let { container, root } = renderApp(renderSelect())
    container.addEventListener(Select.change, (event) => {
      changes.push(event as SelectChangeEvent)
    })

    await openSelect(container, root)

    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(pointerSelectionGuardMs)
    await settle(root)

    let react = getOptionByText(container, 'React')
    let surface = container.querySelector('[popover]') as HTMLElement
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(react.getAttribute('data-select-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)

    await vi.advanceTimersByTimeAsync(flashDurationMs)
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(surface.matches(':popover-open')).toBe(false)

    await finishCloseTransition(surface)
    await settle(root)

    expect(changes).toHaveLength(1)
    expect(changes[0].value).toBe('react')

    expect(react.getAttribute('data-select-flash')).toBe(null)
    expect(surface.matches(':popover-open')).toBe(false)
  })

  it('reselecting the current option still flashes before closing without bubbling Select.change', async () => {
    let changes: SelectChangeEvent[] = []
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    container.addEventListener(Select.change, (event) => {
      changes.push(event as SelectChangeEvent)
    })

    await openSelect(container, root)
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(pointerSelectionGuardMs)
    await settle(root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(hiddenInput.value).toBe('react')
    expect(react.getAttribute('data-select-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)

    await vi.advanceTimersByTimeAsync(flashDurationMs)
    await settle(root)

    expect(changes).toHaveLength(0)
    expect(hiddenInput.value).toBe('react')
    expect(surface.matches(':popover-open')).toBe(false)

    await finishCloseTransition(surface)
    await settle(root)

    expect(react.getAttribute('data-select-flash')).toBe(null)
    expect(surface.matches(':popover-open')).toBe(false)
  })

})
