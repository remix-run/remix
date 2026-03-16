// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import { Glyph } from './glyph.tsx'
import { Listbox } from './listbox.tsx'
import type { ListboxChangeEvent, ListboxOpenChangeEvent, ListboxProps } from './listbox.tsx'
import { isPopoverOpen } from './popover.tsx'
import { ui } from './theme.ts'

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

function renderExampleListbox(props: Partial<ListboxProps> = {}) {
  return (
    <Listbox defaultLabel="Select a status" mix={ui.listbox.root} setup={{ label: 'Backlog' }} {...props}>
      <button mix={ui.listbox.trigger}>
        <span mix={ui.listbox.value}>Select a status</span>
        <Glyph mix={ui.listbox.indicator} name="chevronDown" />
      </button>
      <div mix={ui.listbox.popup}>
        <div mix={ui.listbox.list}>
          <div mix={ui.listbox.item('backlog', { textValue: 'Backlog' })}>
            <Glyph mix={ui.listbox.itemIndicator} name="check" />
            <span mix={ui.listbox.itemLabel}>Backlog</span>
          </div>
          <div mix={ui.listbox.item('in-progress', { textValue: 'In progress' })}>
            <Glyph mix={ui.listbox.itemIndicator} name="check" />
            <span mix={ui.listbox.itemLabel}>In progress</span>
          </div>
          <div mix={ui.listbox.item('done', { disabled: true, textValue: 'Done' })}>
            <Glyph mix={ui.listbox.itemIndicator} name="check" />
            <span mix={ui.listbox.itemLabel}>Done</span>
          </div>
        </div>
      </div>
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
        defaultValue: 'backlog',
        name: 'status',
      }),
    )

    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    root.flush()

    expect(trigger.textContent).toContain('Backlog')
    expect(hiddenInput.name).toBe('status')
    expect(hiddenInput.value).toBe('backlog')

    press(trigger, 'ArrowDown')
    root.flush()

    let list = container.querySelector('[data-rmx-listbox-part="list"]') as HTMLElement
    press(list, 'ArrowDown')
    press(list, 'Enter')
    await wait(480)
    root.flush()

    expect(trigger.textContent).toContain('In progress')
    expect(hiddenInput.value).toBe('in-progress')
  })

  it('renders the selected label on initial mount when defaultValue is provided', () => {
    let { container } = renderApp(
      renderExampleListbox({
        defaultValue: 'backlog',
        defaultLabel: 'Select a status',
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

    press(trigger, 'ArrowDown')
    root.flush()

    let list = container.querySelector('[data-rmx-listbox-part="list"]') as HTMLElement
    press(list, 'ArrowDown')
    press(list, 'Enter')
    await wait(480)
    root.flush()

    expect(trigger.textContent).toContain('In progress')
  })

  it('supports controlled open state through bubbling open-change events', () => {
    let { container, root } = renderApp(renderExampleListbox({ open: false }))

    root.render(renderExampleListbox({ open: true }))
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    expect(isPopoverOpen(popup)).toBe(true)

    root.render(renderExampleListbox({ open: false }))
    root.flush()

    let nextPopup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    expect(isPopoverOpen(nextPopup)).toBe(false)
  })

  it('matches popup width to the trigger and skips disabled items during keyboard navigation', () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement
    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement

    mockLayout(trigger, { top: 40, left: 200, width: 180, height: 28 })
    mockLayout(popup, { top: 0, left: 0, width: 220, height: 140 })

    press(trigger, 'ArrowDown')
    root.flush()

    let list = container.querySelector('[data-rmx-listbox-part="list"]') as HTMLElement
    press(list, 'ArrowDown')
    root.flush()

    expect(popup.style.minWidth).toBe('180px')
    let highlighted = container.querySelector('[data-rmx-listbox-highlighted="true"]') as HTMLElement
    expect(highlighted.getAttribute('data-rmx-listbox-value')).toBe('in-progress')
  })

  it('keeps the popup open on Tab and moves highlight to the first item', () => {
    let { container, root } = renderApp(renderExampleListbox())
    let trigger = container.querySelector('[data-rmx-listbox-part="trigger"]') as HTMLButtonElement

    press(trigger, 'ArrowDown')
    root.flush()

    let popup = container.querySelector('[data-rmx-listbox-part="popup"]') as HTMLElement
    let list = container.querySelector('[data-rmx-listbox-part="list"]') as HTMLElement

    expect(isPopoverOpen(popup)).toBe(true)

    press(list, 'ArrowDown')
    root.flush()

    press(list, 'Tab')
    root.flush()

    expect(isPopoverOpen(popup)).toBe(true)
    let highlighted = container.querySelector('[data-rmx-listbox-highlighted="true"]') as HTMLElement
    expect(highlighted.getAttribute('data-rmx-listbox-value')).toBe('backlog')
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
    press(trigger, 'ArrowDown')
    root.flush()

    let list = container.querySelector('[data-rmx-listbox-part="list"]') as HTMLElement
    press(list, 'Enter')
    await wait(480)
    root.flush()

    expect(openEvents).toContain(true)
    expect(changeEvent?.value).toBe('backlog')
  })
})
