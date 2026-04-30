import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type FakeTimers } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'

import {
  Combobox,
  ComboboxOption,
  onComboboxChange,
  type ComboboxChangeEvent,
  type ComboboxHandle,
  type ComboboxProps,
} from './combobox.tsx'
import * as combobox from './combobox.tsx'

const flashDurationMs = 60
const inputCommitDelayMs = 50
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

function renderCombobox(props: Partial<ComboboxProps> = {}) {
  return (
    <Combobox inputId="framework" name="framework" placeholder="Search a framework" {...props}>
      <ComboboxOption label="Remix framework" value="remix">
        Remix
      </ComboboxOption>
      <ComboboxOption disabled label="React Router framework" value="react-router">
        React Router
      </ComboboxOption>
      <ComboboxOption label="React framework" value="react">
        React
      </ComboboxOption>
    </Combobox>
  )
}

function renderObservedCombobox(
  changes: ComboboxChangeEvent[],
  props: Partial<ComboboxProps> = {},
) {
  return renderApp(
    <div
      mix={onComboboxChange((event) => {
        changes.push(event)
      })}
    >
      {renderCombobox(props)}
    </div>,
  )
}

function getOptionByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option) => option.textContent?.trim() === text,
  ) as HTMLElement
}

function stubScrollIntoView(node: HTMLElement) {
  let spy = mock.fn()

  Object.defineProperty(node, 'scrollIntoView', {
    configurable: true,
    value: spy,
  })

  return spy
}

function expectInputSelection(input: HTMLInputElement) {
  expect(input.selectionStart).toBe(0)
  expect(input.selectionEnd).toBe(input.value.length)
}

function expectInputSelectionCleared(input: HTMLInputElement) {
  expect(input.selectionStart).toBe(input.value.length)
  expect(input.selectionEnd).toBe(input.value.length)
}

function key(target: HTMLElement, key: string, options: { repeat?: boolean } = {}) {
  let event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
    repeat: options.repeat,
  })
  target.dispatchEvent(event)
  return event
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

function changeInputValue(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function typeText(
  input: HTMLInputElement,
  root: ReturnType<typeof createRoot>,
  text: string,
) {
  for (let character of text) {
    let event = key(input, character)
    if (event.defaultPrevented) {
      await settle(root)
      continue
    }

    input.value += character
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(root)
  }
}

function blur(target: HTMLElement) {
  target.dispatchEvent(new FocusEvent('blur'))
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

let timers!: FakeTimers

async function finishSelectionFlash(root: ReturnType<typeof createRoot>) {
  await timers.advanceAsync(flashDurationMs)
  await settle(root)
}

async function finishInputCommit(root: ReturnType<typeof createRoot>) {
  await timers.advanceAsync(inputCommitDelayMs)
  await settle(root)
}

async function finishCloseTransition(surface: HTMLElement) {
  await Promise.resolve()
  surface.dispatchEvent(new TransitionEvent('transitionrun', { propertyName: 'opacity' }))
  surface.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
  await Promise.resolve()
}

let scrollIntoViewSpy: ReturnType<typeof mock.method>

beforeEach(() => {
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
  scrollIntoViewSpy = mock.method(HTMLElement.prototype, 'scrollIntoView', () => {})
})

afterEach(() => {
  scrollIntoViewSpy.mock.restore!()
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  document.documentElement.removeAttribute('style')
})

describe('Combobox', () => {
  it('applies the raw defaultValue to the input text while keeping the hidden input committed', async () => {
    let { container, root } = renderApp(renderCombobox({ defaultValue: 'react' }))
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    await settle(root)

    expect(input.value).toBe('react')
    expect(hiddenInput.value).toBe('react')
  })

  it('calls the public ref only on first render', async () => {
    let handles: ComboboxHandle[] = []
    let { container, root } = renderApp(
      <combobox.Context
        name="framework"
        ref={(handle: ComboboxHandle) => {
          handles.push(handle)
        }}
      >
        <input id="framework" mix={combobox.input()} placeholder="Search a framework" />
        <div mix={combobox.popover()}>
          <div mix={combobox.list()}>
            <ComboboxOption label="Remix framework" value="remix">
              Remix
            </ComboboxOption>
            <ComboboxOption disabled label="React Router framework" value="react-router">
              React Router
            </ComboboxOption>
            <ComboboxOption label="React framework" value="react">
              React
            </ComboboxOption>
          </div>
        </div>
      </combobox.Context>,
    )
    let input = container.querySelector('input[type="text"]') as HTMLInputElement

    await settle(root)
    expect(handles).toHaveLength(1)

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(handles).toHaveLength(1)
    expect(handles[0]?.isOpen).toBe(true)
  })

  it('clears the committed selection as soon as the user types', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes, { defaultValue: 'react' })
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe(null)
  })

  it('typing matching text opens the popover, filters visible options, and keeps focus on the input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')
    input.focus()

    changeInputValue(input, 'rea')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
    expect(surface.getAttribute('data-show-reason')).toBe('hint')
    expect(input.getAttribute('data-surface-visible')).toBe('true')
    expect(remix.hidden).toBe(true)
    expect(getComputedStyle(remix).display).toBe('none')
    expect(reactRouter.hidden).toBe(false)
    expect(getComputedStyle(reactRouter).display).toBe('grid')
    expect(react.hidden).toBe(false)
    expect(getComputedStyle(react).display).toBe('grid')
    expect(list.id).toBe(input.getAttribute('aria-controls'))
  })

  it('allows real typing without resetting the input value between characters', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    await typeText(input, root, 'rea')

    expect(input.value).toBe('rea')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('allows typing spaces into the input while the popup is open', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    await typeText(input, root, 'react f')

    expect(input.value).toBe('react f')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('hides the popover when the input is empty or there are no matches', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 're')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(true)

    changeInputValue(input, '')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(false)

    changeInputValue(input, 'zzz')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(false)
  })

  it('typing switches an open nav popover into hint mode', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(surface.getAttribute('data-show-reason')).toBe('nav')

    changeInputValue(input, 're')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(surface.getAttribute('data-show-reason')).toBe('hint')
  })

  it('typing no matches switches an open nav popover into hint mode before closing', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(surface.getAttribute('data-show-reason')).toBe('nav')

    changeInputValue(input, 'zzz')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(surface.getAttribute('data-show-reason')).toBe('hint')
  })

  it('ArrowDown on an exact-match closed input opens an unfiltered list while keeping focus on the input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')
    input.focus()

    changeInputValue(input, 'react framework')
    await settle(root)

    key(input, 'Escape')
    await settle(root)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)

    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(remix.hidden).toBe(false)
    expect(reactRouter.hidden).toBe(false)
    expect(react.hidden).toBe(false)
    expect(surface.getAttribute('data-show-reason')).toBe('nav')
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('clicking the focused input opens the list without an active item when nothing is selected', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    pointer(input, 'click')
    await settleFrames(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(surface.getAttribute('data-show-reason')).toBe('nav')
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('clicking the focused input activates the selected item when one exists', async () => {
    let { container, root } = renderApp(renderCombobox({ defaultValue: 'react' }))
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let react = getOptionByText(container, 'React')
    input.focus()

    pointer(input, 'click')
    await settleFrames(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('ArrowUp and ArrowDown navigate the active descendant while the input stays focused', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')
    input.focus()

    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)
    expect(input.getAttribute('data-surface-visible')).toBe('true')

    key(input, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)

    key(input, 'ArrowUp')
    await settle(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)
  })

  it('scrolls the active descendant into view during keyboard navigation', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')
    let scrollRemix = stubScrollIntoView(remix)
    let scrollReact = stubScrollIntoView(react)

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)
    expect(scrollRemix).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })

    key(input, 'ArrowDown')
    await settle(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(scrollReact).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })
  })

  it('Enter does not open from the closed input and Space does not select from the open input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    key(input, 'Enter')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(false)

    key(input, 'ArrowDown')
    await settleFrames(root)
    expect(surface.matches(':popover-open')).toBe(true)

    key(input, ' ')
    await settle(root)
    expect(surface.matches(':popover-open')).toBe(true)
    expect(hiddenInput.value).toBe('')
  })

  it('Enter selects the active option, flashes it, then closes the popover and emits onComboboxChange', async (t) => {
    timers = t.useFakeTimers()
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    key(input, 'ArrowDown')
    await settle(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)

    key(input, 'Enter')
    await settle(root)

    expect(react.getAttribute('data-combobox-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(changes).toHaveLength(0)
    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('react')
    expect(input.getAttribute('data-surface-visible')).toBe('true')
    expect(remix.hidden).toBe(true)
    expect(getComputedStyle(remix).display).toBe('none')
    expect(reactRouter.hidden).toBe(false)
    expect(getComputedStyle(reactRouter).display).toBe('grid')

    await finishSelectionFlash(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(input.value).toBe('rea')
    expect(input.getAttribute('data-surface-visible')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)

    await finishCloseTransition(surface)
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('react')
    expect(input.getAttribute('data-surface-visible')).toBe(null)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)

    await finishInputCommit(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')
    expectInputSelection(input)
    expect(react.getAttribute('data-combobox-flash')).toBe(null)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('react')
  })

  it('selecting from an untouched input delays the visible input commit until after close', async (t) => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)
    timers = t.useFakeTimers()

    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)
    expect(input.value).toBe('')

    key(input, 'Enter')
    await settle(root)

    expect(remix.getAttribute('data-combobox-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(input.value).toBe('')
    expect(hiddenInput.value).toBe('remix')
    expect(changes).toHaveLength(0)

    await finishSelectionFlash(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(input.value).toBe('')

    await finishCloseTransition(surface)
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(input.value).toBe('')

    await finishInputCommit(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('Remix framework')
    expect(hiddenInput.value).toBe('remix')
    expectInputSelection(input)
    expect(remix.getAttribute('data-combobox-flash')).toBe(null)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('remix')
  })

  it('Enter does nothing when typing has opened the popover but no option is active', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)

    key(input, 'Enter')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(true)
    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('')
    expect(changes).toHaveLength(0)
  })

  it('selects the input text after menu selection even when the label is already visible', async (t) => {
    timers = t.useFakeTimers()
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'React framework')
    await settle(root)

    key(input, 'ArrowDown')
    await settle(root)

    key(input, 'Enter')
    await settle(root)
    await finishSelectionFlash(root)
    await finishCloseTransition(surface)
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expectInputSelection(input)
  })

  it('clears the input selection when arrow navigation starts', async (t) => {
    timers = t.useFakeTimers()
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    let react = getOptionByText(container, 'React')

    input.focus()
    changeInputValue(input, 'React framework')
    await settle(root)

    key(input, 'ArrowDown')
    await settle(root)
    key(input, 'Enter')
    await settle(root)
    await finishSelectionFlash(root)
    await finishCloseTransition(surface)
    await settle(root)

    expectInputSelection(input)

    key(input, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
    expectInputSelectionCleared(input)
  })

  it('Escape with a non-matching value clears the input and selection', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes, { defaultValue: 'react' })
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    input.focus()
    changeInputValue(input, 'zzz')
    await settle(root)

    key(input, 'Escape')
    await settle(root)

    expect(input.value).toBe('')
    expect(hiddenInput.value).toBe('')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe(null)
  })

  it('blur commits an exact input match without rewriting the visible input text', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderApp(
      <div
        mix={onComboboxChange((event) => {
          changes.push(event)
        })}
      >
        <Combobox inputId="environment" name="environment" placeholder="Search an environment">
          <ComboboxOption label="Production" value="production" />
          <ComboboxOption label="Staging" searchValue={['staging', 'beta']} value="staging" />
          <ComboboxOption label="Local" searchValue={['local', 'dev', 'workbench']} value="local" />
        </Combobox>
      </div>,
    )
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'beta')
    await settle(root)

    blur(input)
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(input.value).toBe('beta')
    expect(hiddenInput.value).toBe('staging')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('staging')
  })

  it('blur with a non-matching value clears the input and selection', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes, { defaultValue: 'remix' })
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement

    input.focus()
    changeInputValue(input, 'zzz')
    await settle(root)

    blur(input)
    await settle(root)

    expect(input.value).toBe('')
    expect(hiddenInput.value).toBe('')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe(null)
  })

  it('skips disabled options and supports searchValue string and array filtering', async () => {
    let { container, root } = renderApp(
      <Combobox inputId="environment" name="environment" placeholder="Search an environment">
        <ComboboxOption label="Production" value="production" />
        <ComboboxOption label="Staging" searchValue={['staging', 'beta']} value="staging" />
        <ComboboxOption disabled label="Dev Null" searchValue="dev" value="dev-null" />
        <ComboboxOption label="Local" searchValue={['local', 'dev', 'workbench']} value="local" />
      </Combobox>,
    )
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let production = getOptionByText(container, 'Production')
    let staging = getOptionByText(container, 'Staging')
    let devNull = getOptionByText(container, 'Dev Null')
    let local = getOptionByText(container, 'Local')
    input.focus()

    changeInputValue(input, 'bet')
    await settle(root)

    expect(staging.hidden).toBe(false)
    expect(getComputedStyle(staging).display).toBe('grid')
    expect(local.hidden).toBe(true)
    expect(getComputedStyle(local).display).toBe('none')
    expect(input.getAttribute('aria-activedescendant')).toBe(null)

    changeInputValue(input, 'dev')
    await settle(root)

    expect(production.hidden).toBe(true)
    expect(getComputedStyle(production).display).toBe('none')
    expect(staging.hidden).toBe(true)
    expect(getComputedStyle(staging).display).toBe('none')
    expect(devNull.hidden).toBe(false)
    expect(getComputedStyle(devNull).display).toBe('grid')
    expect(local.hidden).toBe(false)
    expect(getComputedStyle(local).display).toBe('grid')
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('pointer selection keeps focus on the input', async (t) => {
    timers = t.useFakeTimers()
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[popover]') as HTMLElement
    input.focus()

    changeInputValue(input, 'rea')
    await settle(root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(react.getAttribute('data-combobox-flash')).toBe('true')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('react')

    await finishSelectionFlash(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(input.value).toBe('rea')

    await finishCloseTransition(surface)
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)

    await finishInputCommit(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')
    expectInputSelection(input)
    expect(react.getAttribute('data-combobox-flash')).toBe(null)
  })
})
