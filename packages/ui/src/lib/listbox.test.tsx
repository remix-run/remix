// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import { Listbox, ListboxOption } from './listbox.tsx'
import type {
  ListboxChangeEvent,
  ListboxOpenChangeEvent,
  ListboxProps,
  ListboxSetup,
} from './listbox.tsx'
import { isPopoverOpen, popoverFadeDuration } from './popover.tsx'

function ensureAdoptedStyleSheets() {
  if (document.adoptedStyleSheets) {
    return
  }

  Object.defineProperty(document, 'adoptedStyleSheets', {
    configurable: true,
    value: [],
    writable: true,
  })
}

class MockCSSStyleSheet {
  cssRules: Array<{ cssText: string }> = []

  insertRule(rule: string) {
    this.cssRules.push({ cssText: rule })
    return this.cssRules.length - 1
  }

  deleteRule(index: number) {
    this.cssRules.splice(index, 1)
  }
}

function ensureConstructableStylesheets() {
  globalThis.CSSStyleSheet = MockCSSStyleSheet as unknown as typeof CSSStyleSheet
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function mockLayout(element: HTMLElement, rect: { top: number; left: number; width: number; height: number }) {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => rect.width,
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => rect.height,
  })

  element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

function renderExampleListbox(props: Partial<ListboxProps> & { setup?: ListboxSetup } = {}) {
  return (
    <Listbox setup={{ label: 'Select a status', value: 'backlog' }} {...props}>
      <ListboxOption value="backlog">Backlog</ListboxOption>
      <ListboxOption textValue="In progress" value="in-progress">
        In progress
      </ListboxOption>
      <ListboxOption disabled textValue="Done" value="done">
        Done
      </ListboxOption>
    </Listbox>
  )
}

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

ensureAdoptedStyleSheets()
ensureConstructableStylesheets()

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Listbox', () => {
  it('supports uncontrolled value and name submission', async () => {
    let { container, root } = renderApp(
      renderExampleListbox({
        name: 'status',
        setup: { label: 'Select a status', value: 'backlog' },
      }),
    )

    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    root.flush()

    expect(trigger.textContent).toContain('Backlog')
    expect(hiddenInput.name).toBe('status')
    expect(hiddenInput.value).toBe('backlog')

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('role')).toBe('combobox')

    press(trigger, 'ArrowDown')
    press(trigger, 'Enter')
    await wait(480)
    root.flush()

    expect(trigger.textContent).toContain('In progress')
    expect(hiddenInput.value).toBe('in-progress')
  })

  it('renders the selected label on initial mount when setup value is provided', () => {
    let { container } = renderApp(
      renderExampleListbox({
        setup: { label: 'Select a status', value: 'backlog' },
      }),
    )

    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    expect(trigger.textContent).toContain('Backlog')
    expect(trigger.textContent).not.toContain('Select a status')
  })

  it('supports controlled value through bubbling change events', async () => {
    function App(handle: Handle) {
      let value: string | null = 'backlog'

      return () => (
        <div
          mix={on(Listbox.change, (event) => {
            value = (event as ListboxChangeEvent).value
            void handle.update()
          })}
        >
          {renderExampleListbox({ value })}
        </div>
      )
    }

    let { container, root } = renderApp(<App />)
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    root.flush()

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    expect(document.activeElement).toBe(trigger)

    press(trigger, 'ArrowDown')
    press(trigger, 'Enter')
    await wait(480)
    root.flush()

    expect(trigger.textContent).toContain('In progress')
  })

  it('supports controlled open state through bubbling open-change events', async () => {
    let { container, root } = renderApp(renderExampleListbox({ open: false }))

    root.render(renderExampleListbox({ open: true }))
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    expect(isPopoverOpen(popup)).toBe(true)

    root.render(renderExampleListbox({ open: false }))
    root.flush()
    await wait(popoverFadeDuration + 20)

    let nextPopup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    expect(isPopoverOpen(nextPopup)).toBe(false)
  })

  it('matches popup width to the trigger and skips disabled items during keyboard navigation', () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement

    mockLayout(trigger, { top: 40, left: 200, width: 180, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 220, height: 140 })

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'ArrowDown')
    root.flush()

    expect(popup.style.minWidth).toBe('180px')
    let highlighted = container.querySelector('[data-rmx-listbox-highlighted="true"]') as HTMLElement
    expect(highlighted.getAttribute('data-rmx-listbox-value')).toBe('in-progress')
  })

  it('keeps the popup open on Tab and moves highlight to the first item', () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement

    expect(isPopoverOpen(popup)).toBe(true)

    expect(document.activeElement).toBe(trigger)

    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'Tab')
    root.flush()

    expect(isPopoverOpen(popup)).toBe(true)
    let highlighted = container.querySelector('[data-rmx-listbox-highlighted="true"]') as HTMLElement
    expect(highlighted.getAttribute('data-rmx-listbox-value')).toBe('backlog')
  })

  it('treats outside pointer dismissal like escape and restores focus to the trigger', async () => {
    let { container, root } = renderApp(
      <div>
        {renderExampleListbox()}
        <button type="button">Outside action</button>
      </div>,
    )
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    press(trigger, 'ArrowDown')
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    let outsideButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Outside action',
    ) as HTMLButtonElement

    expect(isPopoverOpen(popup)).toBe(true)

    outsideButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    root.flush()
    await wait(popoverFadeDuration + 20)

    expect(isPopoverOpen(popup)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('dehighlights on drag out, rehighlights on re-entry, and selects on pointerup inside', async () => {
    let { container, root } = renderApp(
      <div>
        {renderExampleListbox({ name: 'status' })}
        <button type="button">Outside action</button>
      </div>,
    )
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    press(trigger, 'ArrowDown')
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    let backlog = container.querySelector('[data-rmx-listbox-value="backlog"]') as HTMLElement
    let inProgress = container.querySelector('[data-rmx-listbox-value="in-progress"]') as HTMLElement
    let outsideButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Outside action',
    ) as HTMLButtonElement

    expect(isPopoverOpen(popup)).toBe(true)

    inProgress.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    root.flush()

    expect(inProgress.getAttribute('data-rmx-listbox-highlighted')).toBe('true')

    outsideButton.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
    root.flush()

    expect(container.querySelector('[data-rmx-listbox-highlighted="true"]')).toBe(null)

    backlog.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
    root.flush()

    expect(backlog.getAttribute('data-rmx-listbox-highlighted')).toBe('true')

    backlog.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
    root.flush()
    await wait(480)
    root.flush()

    expect(trigger.textContent).toContain('Backlog')
    expect(isPopoverOpen(popup)).toBe(false)
  })

  it('keeps highlight when dragging over the option indicator glyph', () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    press(trigger, 'ArrowDown')
    root.flush()

    let inProgress = container.querySelector('[data-rmx-listbox-value="in-progress"]') as HTMLElement
    let indicator = inProgress.querySelector(
      '[data-rmx-listbox-part="item-indicator"]',
    ) as HTMLElement

    inProgress.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    root.flush()

    indicator.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
    root.flush()

    expect(inProgress.getAttribute('data-rmx-listbox-highlighted')).toBe('true')
  })

  it('keeps focus on the trigger after pointer selection', async () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    let inProgress = container.querySelector('[data-rmx-listbox-value="in-progress"]') as HTMLElement

    inProgress.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    root.flush()

    inProgress.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
    root.flush()
    await wait(480)
    root.flush()

    expect(document.activeElement).toBe(trigger)
  })

  it('closes when a drag selection ends outside the popup', async () => {
    let { container, root } = renderApp(
      <div>
        {renderExampleListbox()}
        <button type="button">Outside action</button>
      </div>,
    )
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    press(trigger, 'ArrowDown')
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    let inProgress = container.querySelector('[data-rmx-listbox-value="in-progress"]') as HTMLElement
    let outsideButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Outside action',
    ) as HTMLButtonElement

    inProgress.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    root.flush()

    outsideButton.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }))
    root.flush()

    expect(container.querySelector('[data-rmx-listbox-highlighted="true"]')).toBe(null)

    outsideButton.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
    root.flush()
    await wait(popoverFadeDuration + 20)

    expect(isPopoverOpen(popup)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('closes when a trigger press ends outside the popup', async () => {
    let { container, root } = renderApp(
      <div>
        {renderExampleListbox()}
        <button type="button">Outside action</button>
      </div>,
    )
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    let outsideButton = [...container.querySelectorAll('button')].find(
      button => button.textContent === 'Outside action',
    ) as HTMLButtonElement

    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    expect(isPopoverOpen(popup)).toBe(true)

    outsideButton.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
    root.flush()
    await wait(popoverFadeDuration + 20)

    expect(isPopoverOpen(popup)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('dispatches bubbling change and open events', async () => {
    let changeEvent: ListboxChangeEvent | null = null
    let openEvents: boolean[] = []

    let { container, root } = renderApp(
      <div
        mix={[
          on(Listbox.change, (event) => {
            changeEvent = event as ListboxChangeEvent
          }),
          on(Listbox.openChange, (event) => {
            openEvents.push((event as ListboxOpenChangeEvent).open)
          }),
        ]}
      >
        {renderExampleListbox()}
      </div>,
    )

    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    trigger.focus()
    press(trigger, 'ArrowDown')
    root.flush()

    press(trigger, 'Enter')
    await wait(480)
    root.flush()

    expect(openEvents).toContain(true)
    expect(changeEvent?.value).toBe('backlog')
  })
})
