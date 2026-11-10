import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock } from '@remix-run/test'

import { createRoot, type Handle, type Props, type RemixNode } from '@remix-run/component'

import { onComboboxChange, type ComboboxChangeEvent, type ComboboxHandle } from './combobox.tsx'
import * as combobox from './combobox.tsx'
import { pointer as mousePointer } from './test/pointer.ts'

let roots: ReturnType<typeof createRoot>[] = []

type TestComboboxProps = Props<'div'> &
  Omit<combobox.ComboboxContextProps, 'ref'> & {
    inputId?: string
    placeholder?: string
  }

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function TestCombobox(handle: Handle<TestComboboxProps>): () => RemixNode {
  return () => {
    let { children, defaultValue, disabled, inputId, name, placeholder, ...divProps } = handle.props

    return (
      <combobox.Context defaultValue={defaultValue} disabled={disabled} name={name}>
        <div {...divProps}>
          <input
            defaultValue={defaultValue ?? undefined}
            id={inputId}
            mix={combobox.input()}
            placeholder={placeholder}
          />
          <div mix={combobox.popover()}>
            <div mix={combobox.list()}>{children}</div>
          </div>
          {name && <input mix={combobox.hiddenInput()} />}
        </div>
      </combobox.Context>
    )
  }
}

function TestComboboxOption(
  handle: Handle<Props<'div'> & combobox.ComboboxOptionOptions>,
): () => RemixNode {
  return () => {
    let { children, disabled, label, searchValue, value, ...divProps } = handle.props

    return (
      <div {...divProps} mix={combobox.option({ disabled, label, searchValue, value })}>
        {children ?? label}
      </div>
    )
  }
}

function renderCombobox(props: Partial<TestComboboxProps> = {}) {
  return (
    <TestCombobox inputId="framework" name="framework" placeholder="Search a framework" {...props}>
      <TestComboboxOption label="Remix framework" value="remix">
        Remix
      </TestComboboxOption>
      <TestComboboxOption disabled label="React Router framework" value="react-router">
        React Router
      </TestComboboxOption>
      <TestComboboxOption label="React framework" value="react">
        React
      </TestComboboxOption>
    </TestCombobox>
  )
}

function renderObservedCombobox(
  changes: ComboboxChangeEvent[],
  props: Partial<TestComboboxProps> = {},
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
  it('keeps the input text cursor and text selection', () => {
    let { container } = renderApp(renderCombobox())
    let style = getComputedStyle(container.querySelector('input[type="text"]') as HTMLElement)

    expect(style.cursor).not.toBe('default')
    expect(style.userSelect).not.toBe('none')
  })

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
            <TestComboboxOption label="Remix framework" value="remix">
              Remix
            </TestComboboxOption>
            <TestComboboxOption disabled label="React Router framework" value="react-router">
              React Router
            </TestComboboxOption>
            <TestComboboxOption label="React framework" value="react">
              React
            </TestComboboxOption>
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
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('')
    expect(surface.matches('[data-open]')).toBe(true)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe(null)
  })

  it('typing matching text opens the popover, filters visible options, and keeps focus on the input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    let list = container.querySelector('[role="listbox"]') as HTMLElement
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')
    input.focus()

    changeInputValue(input, 'rea')
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
    expect(surface.getAttribute('data-show-reason')).toBe('hint')
    expect(input.getAttribute('data-surface-visible')).toBe('true')
    expect(remix.hidden).toBe(true)
    expect(getComputedStyle(remix).display).toBe('none')
    expect(reactRouter.hidden).toBe(false)
    expect(getComputedStyle(reactRouter).display).not.toBe('none')
    expect(react.hidden).toBe(false)
    expect(getComputedStyle(react).display).not.toBe('none')
    expect(list.id).toBe(input.getAttribute('aria-controls'))
  })

  it('allows real typing without resetting the input value between characters', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    await typeText(input, root, 'rea')

    expect(input.value).toBe('rea')
    expect(surface.matches('[data-open]')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('allows typing spaces into the input while the popup is open', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    await typeText(input, root, 'react f')

    expect(input.value).toBe('react f')
    expect(surface.matches('[data-open]')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('hides the popover when the input is empty or there are no matches', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 're')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)

    changeInputValue(input, '')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)

    changeInputValue(input, 'zzz')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)
  })

  it('typing switches an open nav popover into hint mode', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(surface.getAttribute('data-show-reason')).toBe('nav')

    changeInputValue(input, 're')
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(true)
    expect(surface.getAttribute('data-show-reason')).toBe('hint')
  })

  it('typing no matches switches an open nav popover into hint mode before closing', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(surface.getAttribute('data-show-reason')).toBe('nav')

    changeInputValue(input, 'zzz')
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(false)
    expect(surface.getAttribute('data-show-reason')).toBe('hint')
  })

  it('ArrowDown on an exact-match closed input opens an unfiltered list while keeping focus on the input', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
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

    expect(surface.matches('[data-open]')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(remix.hidden).toBe(false)
    expect(reactRouter.hidden).toBe(false)
    expect(react.hidden).toBe(false)
    expect(surface.getAttribute('data-show-reason')).toBe('nav')
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
  })

  it('commits an option on the click, not on press, keeping focus on the input', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[role="combobox"]') as HTMLInputElement
    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    let react = getOptionByText(container, 'React')
    mousePointer(react, 'pointerdown')
    await settle(root)

    expect(input.value).toBe('rea')
    expect(changes).toHaveLength(0)
    expect(document.activeElement).toBe(input)

    mousePointer(react, 'pointerup')
    pointer(react, 'click')

    expect(input.value).toBe('React framework')

    await settle(root)

    expect(container.querySelector<HTMLInputElement>('input[type="hidden"]')?.value).toBe('react')
    expect(changes).toHaveLength(1)
  })

  it('clicking the focused input opens the list without an active item when nothing is selected', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    pointer(input, 'click')
    await settleFrames(root)

    expect(surface.matches('[data-open]')).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(surface.getAttribute('data-show-reason')).toBe('nav')
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('opens on the click of the input, not on mouse press', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    mousePointer(input, 'pointerdown')
    await settleFrames(root)

    expect(surface.matches('[data-open]')).toBe(false)
    expect(document.activeElement).toBe(input)

    mousePointer(input, 'pointerup')
    pointer(input, 'click')
    await settleFrames(root)

    expect(surface.matches('[data-open]')).toBe(true)
  })

  it('waits for the click when the input is pressed by touch', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    mousePointer(input, 'pointerdown', { pointerType: 'touch' })
    await settleFrames(root)
    expect(surface.matches('[data-open]')).toBe(false)

    pointer(input, 'click')
    await settleFrames(root)

    expect(surface.matches('[data-open]')).toBe(true)
  })

  it('clicking the focused input activates the selected item when one exists', async () => {
    let { container, root } = renderApp(renderCombobox({ defaultValue: 'react' }))
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    let react = getOptionByText(container, 'React')
    input.focus()

    pointer(input, 'click')
    await settleFrames(root)

    expect(surface.matches('[data-open]')).toBe(true)
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
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    key(input, 'Enter')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(false)

    key(input, 'ArrowDown')
    await settleFrames(root)
    expect(surface.matches('[data-open]')).toBe(true)

    key(input, ' ')
    await settle(root)
    expect(surface.matches('[data-open]')).toBe(true)
    expect(hiddenInput.value).toBe('')
  })

  it('Enter commits the input value, hidden value, and change event before the popover finishes closing', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    let react = getOptionByText(container, 'React')
    let remix = getOptionByText(container, 'Remix')
    let reactRouter = getOptionByText(container, 'React Router')

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    key(input, 'ArrowDown')
    await settle(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)

    key(input, 'Enter')

    expect(input.value).toBe('React framework')
    expectInputSelection(input)

    await settle(root)

    expect(hiddenInput.value).toBe('react')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('react')
    expect(surface.matches('[data-open]')).toBe(false)
    expect(input.getAttribute('data-surface-visible')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(react.id)
    expect(remix.hidden).toBe(true)
    expect(getComputedStyle(remix).display).toBe('none')
    expect(reactRouter.hidden).toBe(false)
    expect(getComputedStyle(reactRouter).display).not.toBe('none')

    await finishCloseTransition(surface)
    await settle(root)

    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expect(hiddenInput.value).toBe('react')
    expect(input.getAttribute('data-surface-visible')).toBe(null)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
    expect(changes).toHaveLength(1)
  })

  it('selecting from an untouched input commits immediately', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let remix = getOptionByText(container, 'Remix')

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)

    expect(input.getAttribute('aria-activedescendant')).toBe(remix.id)
    expect(input.value).toBe('')

    key(input, 'Enter')

    expect(input.value).toBe('Remix framework')

    await settle(root)

    expect(hiddenInput.value).toBe('remix')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('remix')
    expectInputSelection(input)
  })

  it('does not dispatch a change when the selected option is already committed', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes, { defaultValue: 'remix' })
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    key(input, 'ArrowDown')
    await settleFrames(root)
    key(input, 'Enter')
    await settle(root)
    await finishCloseTransition(surface)
    await settle(root)

    expect(changes).toHaveLength(0)
  })

  it('does not clobber typing or a reopened popover during the exit transition', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    let react = getOptionByText(container, 'React')

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)
    key(input, 'ArrowDown')
    await settle(root)
    key(input, 'Enter')
    await settle(root)

    expect(input.value).toBe('React framework')
    expect(changes).toHaveLength(1)

    changeInputValue(input, 'Rem')
    await settle(root)
    await finishCloseTransition(surface)
    await settle(root)

    expect(input.value).toBe('Rem')
    expect(hiddenInput.value).toBe('')
    expect(surface.matches('[data-open]')).toBe(true)
    expect(react.hidden).toBe(true)
    expect(changes).toHaveLength(2)
    expect(changes[1]?.value).toBe(null)
  })

  it('Enter does nothing when typing has opened the popover but no option is active', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'rea')
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(true)
    expect(input.getAttribute('aria-activedescendant')).toBe(null)

    key(input, 'Enter')
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(true)
    expect(input.value).toBe('rea')
    expect(hiddenInput.value).toBe('')
    expect(changes).toHaveLength(0)
  })

  it('selects the input text after selection even when the label is already visible', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'React framework')
    await settle(root)

    key(input, 'ArrowDown')
    await settle(root)

    key(input, 'Enter')
    await settle(root)
    await finishCloseTransition(surface)
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(false)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
    expectInputSelection(input)
  })

  it('clears the input selection when arrow navigation starts', async () => {
    let { container, root } = renderApp(renderCombobox())
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    let react = getOptionByText(container, 'React')

    input.focus()
    changeInputValue(input, 'React framework')
    await settle(root)

    key(input, 'ArrowDown')
    await settle(root)
    key(input, 'Enter')
    await settle(root)
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
        <TestCombobox inputId="environment" name="environment" placeholder="Search an environment">
          <TestComboboxOption label="Production" value="production" />
          <TestComboboxOption label="Staging" searchValue={['staging', 'beta']} value="staging" />
          <TestComboboxOption
            label="Local"
            searchValue={['local', 'dev', 'workbench']}
            value="local"
          />
        </TestCombobox>
      </div>,
    )
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement

    input.focus()
    changeInputValue(input, 'beta')
    await settle(root)

    blur(input)
    await settle(root)

    expect(surface.matches('[data-open]')).toBe(false)
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
      <TestCombobox inputId="environment" name="environment" placeholder="Search an environment">
        <TestComboboxOption label="Production" value="production" />
        <TestComboboxOption label="Staging" searchValue={['staging', 'beta']} value="staging" />
        <TestComboboxOption disabled label="Dev Null" searchValue="dev" value="dev-null" />
        <TestComboboxOption
          label="Local"
          searchValue={['local', 'dev', 'workbench']}
          value="local"
        />
      </TestCombobox>,
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
    expect(getComputedStyle(staging).display).not.toBe('none')
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
    expect(getComputedStyle(devNull).display).not.toBe('none')
    expect(local.hidden).toBe(false)
    expect(getComputedStyle(local).display).not.toBe('none')
    expect(input.getAttribute('aria-activedescendant')).toBe(null)
  })

  it('pointer selection commits immediately and keeps focus on the input', async () => {
    let changes: ComboboxChangeEvent[] = []
    let { container, root } = renderObservedCombobox(changes)
    let input = container.querySelector('input[type="text"]') as HTMLInputElement
    let hiddenInput = container.querySelector('input[type="hidden"]') as HTMLInputElement
    let surface = container.querySelector('[data-popover]') as HTMLElement
    input.focus()

    changeInputValue(input, 'rea')
    await settle(root)

    let react = getOptionByText(container, 'React')
    pointer(react, 'pointerdown')
    pointer(react, 'pointerup')
    pointer(react, 'click')

    expect(input.value).toBe('React framework')

    await settle(root)

    expect(document.activeElement).toBe(input)
    expect(hiddenInput.value).toBe('react')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('react')
    expect(surface.matches('[data-open]')).toBe(false)
    expectInputSelection(input)

    await finishCloseTransition(surface)
    await settle(root)

    expect(document.activeElement).toBe(input)
    expect(input.value).toBe('React framework')
  })
})
