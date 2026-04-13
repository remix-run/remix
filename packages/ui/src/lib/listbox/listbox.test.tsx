import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type Handle, type RemixNode } from '@remix-run/component'

import { listbox, type ListboxOption, type ListboxRef, type ListboxValue } from './listbox.ts'

let flashDurationMs = 60
let roots: ReturnType<typeof createRoot>[] = []

type RenderListboxOptions = {
  activeValue?: ListboxValue
  flashSelection?: boolean
  onHighlight?: (value: ListboxValue, option?: ListboxOption) => void
  onSelect?: (value: ListboxValue, option?: ListboxOption) => void
  ref?: (ref: ListboxRef) => void
  tabIndex?: number
  value?: ListboxValue
}

type ControlledListboxOptions = RenderListboxOptions & {
  initialActiveValue?: ListboxValue
  initialValue?: ListboxValue
}

type SelectionCall = {
  option?: ListboxOption
  value: ListboxValue
}

let frameworkOptions: Array<Omit<ListboxOption, 'id'>> = [
  { label: 'Remix', value: 'remix' },
  { disabled: true, label: 'React Router', value: 'react-router' },
  { label: 'React', value: 'react' },
  { label: 'Preact', value: 'preact' },
]

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderListbox({
  activeValue = null,
  flashSelection = false,
  onHighlight = () => {},
  onSelect = () => {},
  ref,
  tabIndex,
  value = null,
}: RenderListboxOptions = {}) {
  return (
    <listbox.context
      activeValue={activeValue}
      flashSelection={flashSelection}
      onHighlight={onHighlight}
      onSelect={onSelect}
      ref={ref}
      value={value}
    >
      <div aria-label="Frameworks" tabIndex={tabIndex} mix={listbox.list()}>
        {frameworkOptions.map((option) => (
          <div key={option.value} mix={listbox.option(option)}>
            {option.label}
          </div>
        ))}
      </div>
    </listbox.context>
  )
}

function renderControlledListbox({
  flashSelection = false,
  initialActiveValue = null,
  initialValue = null,
  onHighlight = () => {},
  onSelect = () => {},
  ref,
  tabIndex,
}: ControlledListboxOptions = {}) {
  function App(handle: Handle) {
    let value = initialValue
    let activeValue = initialActiveValue

    return () =>
      renderListbox({
        activeValue,
        flashSelection,
        onHighlight(nextActiveValue, option) {
          activeValue = nextActiveValue
          onHighlight(nextActiveValue, option)
          void handle.update()
        },
        onSelect(nextValue, option) {
          value = nextValue
          onSelect(nextValue, option)
          void handle.update()
        },
        ref,
        tabIndex,
        value,
      })
  }

  return renderApp(<App />)
}

function getList(container: HTMLElement) {
  return container.querySelector('[role="listbox"]') as HTMLElement
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

function key(target: HTMLElement, key: string) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key })
  target.dispatchEvent(event)
  return event
}

function pointer(
  target: HTMLElement,
  type: 'click' | 'pointerleave' | 'pointermove' | 'pointerup',
  options: { button?: number } = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: options.button ?? 0,
    }),
  )
}

async function settle(root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  root.flush()
  await Promise.resolve()
  root.flush()
}

async function finishSelectionFlash(root: ReturnType<typeof createRoot>) {
  await vi.advanceTimersByTimeAsync(flashDurationMs)
  await settle(root)
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('listbox', () => {
  it('renders listbox roles, generated option ids, and the list tabIndex contract', async () => {
    let firstRender = renderApp(renderListbox())
    let secondRender = renderApp(renderListbox({ tabIndex: 0 }))

    await settle(firstRender.root)
    await settle(secondRender.root)

    let list = getList(firstRender.container)
    let remix = getOptionByText(firstRender.container, 'Remix')
    let reactRouter = getOptionByText(firstRender.container, 'React Router')
    let secondList = getList(secondRender.container)

    expect(list.getAttribute('role')).toBe('listbox')
    expect(list.tabIndex).toBe(-1)
    expect(secondList.tabIndex).toBe(0)

    expect(remix.getAttribute('role')).toBe('option')
    expect(remix.id).not.toBe('')
    expect(remix.getAttribute('aria-selected')).toBe('false')
    expect(remix.dataset.highlighted).toBe('false')
    expect(reactRouter.getAttribute('aria-disabled')).toBe('true')
  })

  it('calls onHighlight without changing DOM until the parent rerenders', async () => {
    let highlights: SelectionCall[] = []
    let { container, root } = renderApp(
      renderListbox({
        onHighlight(value, option) {
          highlights.push({ option, value })
        },
      }),
    )

    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')

    key(list, 'ArrowDown')
    await settle(root)

    expect(highlights).toHaveLength(1)
    expect(highlights[0]?.value).toBe('remix')
    expect(highlights[0]?.option).toEqual(
      expect.objectContaining({
        id: remix.id,
        label: 'Remix',
        value: 'remix',
      }),
    )
    expect(remix.dataset.highlighted).toBe('false')
  })

  it('calls onSelect without changing selection state until the parent rerenders', async () => {
    let selections: SelectionCall[] = []
    let { container, root } = renderApp(
      renderListbox({
        activeValue: 'react',
        onSelect(value, option) {
          selections.push({ option, value })
        },
      }),
    )

    let list = getList(container)
    let react = getOptionByText(container, 'React')

    key(list, 'Enter')
    await settle(root)

    expect(selections).toHaveLength(1)
    expect(selections[0]?.value).toBe('react')
    expect(selections[0]?.option).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(react.getAttribute('aria-selected')).toBe('false')
  })

  it('calls ref once with a live object exposing active and selected options', async () => {
    let refs: ListboxRef[] = []
    let { container, root } = renderControlledListbox({
      initialActiveValue: 'react',
      initialValue: 'remix',
      ref(ref) {
        refs.push(ref)
      },
    })

    await settle(root)

    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    expect(refs).toHaveLength(1)
    expect(refs[0]?.active).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(refs[0]?.selected).toEqual(
      expect.objectContaining({
        id: remix.id,
        label: 'Remix',
        value: 'remix',
      }),
    )

    key(list, 'End')
    await settle(root)
    key(list, 'Enter')
    await settle(root)

    expect(refs).toHaveLength(1)
    expect(refs[0]?.active).toEqual(
      expect.objectContaining({
        id: preact.id,
        label: 'Preact',
        value: 'preact',
      }),
    )
    expect(refs[0]?.selected).toEqual(
      expect.objectContaining({
        id: preact.id,
        label: 'Preact',
        value: 'preact',
      }),
    )
  })

  it('returns undefined ref values when the current values do not match an option', async () => {
    let refs: ListboxRef[] = []
    let { root } = renderApp(
      renderListbox({
        activeValue: 'missing',
        ref(ref) {
          refs.push(ref)
        },
        value: null,
      }),
    )

    await settle(root)

    expect(refs).toHaveLength(1)
    expect(refs[0]?.active).toBe(undefined)
    expect(refs[0]?.selected).toBe(undefined)
  })

  it('ArrowDown and ArrowUp update the controlled highlight and skip disabled options', async () => {
    let highlights: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onHighlight(value, option) {
        highlights.push({ option, value })
      },
    })

    let list = getList(container)
    let reactRouter = getOptionByText(container, 'React Router')
    let react = getOptionByText(container, 'React')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'ArrowUp')
    await settle(root)

    expect(highlights.map((highlight) => highlight.value)).toEqual([
      'remix',
      'react',
      'preact',
      'react',
    ])
    expect(reactRouter.dataset.highlighted).toBe('false')
    expect(react.dataset.highlighted).toBe('true')
  })

  it('ArrowUp with no active option and Home and End target enabled boundary options', async () => {
    let highlights: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onHighlight(value, option) {
        highlights.push({ option, value })
      },
    })

    let list = getList(container)
    let remix = getOptionByText(container, 'Remix')
    let preact = getOptionByText(container, 'Preact')

    key(list, 'ArrowUp')
    await settle(root)
    expect(preact.dataset.highlighted).toBe('true')

    key(list, 'Home')
    await settle(root)
    expect(remix.dataset.highlighted).toBe('true')

    key(list, 'End')
    await settle(root)
    expect(preact.dataset.highlighted).toBe('true')

    expect(highlights.map((highlight) => highlight.value)).toEqual(['preact', 'remix', 'preact'])
  })

  it('prevents default ArrowDown and ArrowUp handling', async () => {
    let { container, root } = renderControlledListbox({
      initialActiveValue: 'react',
    })

    let list = getList(container)
    let arrowDown = key(list, 'ArrowDown')
    await settle(root)

    let arrowUp = key(list, 'ArrowUp')
    await settle(root)

    expect(arrowDown.defaultPrevented).toBe(true)
    expect(arrowUp.defaultPrevented).toBe(true)
  })

  it('scrolls the active option into view on focus and keyboard navigation', async () => {
    let { container, root } = renderControlledListbox({
      initialActiveValue: 'react',
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')
    let scrollReact = stubScrollIntoView(react)
    let scrollPreact = stubScrollIntoView(preact)

    list.focus()
    await settle(root)

    expect(scrollReact).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })

    key(list, 'ArrowDown')
    await settle(root)

    expect(preact.dataset.highlighted).toBe('true')
    expect(scrollPreact).toHaveBeenCalledWith({
      block: 'nearest',
      inline: 'nearest',
    })
  })

  it('Enter and Space select the active option and pass option metadata', async () => {
    let selections: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onSelect(value, option) {
        selections.push({ option, value })
      },
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'Enter')
    await settle(root)

    expect(selections).toHaveLength(1)
    expect(selections[0]?.value).toBe('react')
    expect(selections[0]?.option).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(react.getAttribute('aria-selected')).toBe('true')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, ' ')
    await settle(root)

    expect(selections).toHaveLength(2)
    expect(selections[1]?.value).toBe('preact')
    expect(selections[1]?.option).toEqual(
      expect.objectContaining({
        id: preact.id,
        label: 'Preact',
        value: 'preact',
      }),
    )
    expect(preact.getAttribute('aria-selected')).toBe('true')
    expect(react.getAttribute('aria-selected')).toBe('false')
  })

  it('pointermove and pointerleave update the controlled highlight for enabled options', async () => {
    let highlights: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onHighlight(value, option) {
        highlights.push({ option, value })
      },
    })

    let react = getOptionByText(container, 'React')

    pointer(react, 'pointermove')
    await settle(root)

    expect(highlights).toHaveLength(1)
    expect(highlights[0]?.value).toBe('react')
    expect(highlights[0]?.option).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(react.dataset.highlighted).toBe('true')

    pointer(react, 'pointerleave')
    await settle(root)

    expect(highlights).toHaveLength(2)
    expect(highlights[1]).toEqual({ option: undefined, value: null })
    expect(react.dataset.highlighted).toBe('false')
  })

  it('ignores pointer interactions on disabled options', async () => {
    let highlights: SelectionCall[] = []
    let selections: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onHighlight(value, option) {
        highlights.push({ option, value })
      },
      onSelect(value, option) {
        selections.push({ option, value })
      },
    })

    let reactRouter = getOptionByText(container, 'React Router')

    pointer(reactRouter, 'pointermove')
    await settle(root)
    pointer(reactRouter, 'pointerup')
    await settle(root)
    pointer(reactRouter, 'click')
    await settle(root)

    expect(highlights).toHaveLength(0)
    expect(selections).toHaveLength(0)
    expect(reactRouter.dataset.highlighted).toBe('false')
    expect(reactRouter.getAttribute('aria-selected')).toBe('false')
  })

  it('selects once for a normal pointer interaction', async () => {
    let selections: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onSelect(value, option) {
        selections.push({ option, value })
      },
    })

    let react = getOptionByText(container, 'React')

    pointer(react, 'pointerup')
    pointer(react, 'click')
    await settle(root)

    expect(selections).toHaveLength(1)
    expect(selections[0]?.value).toBe('react')
    expect(selections[0]?.option).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(react.getAttribute('aria-selected')).toBe('true')
  })

  it('selects with click-only activation', async () => {
    let selections: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onSelect(value, option) {
        selections.push({ option, value })
      },
    })

    let react = getOptionByText(container, 'React')

    pointer(react, 'click')
    await settle(root)

    expect(selections).toHaveLength(1)
    expect(selections[0]?.value).toBe('react')
    expect(selections[0]?.option).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(react.getAttribute('aria-selected')).toBe('true')
  })

  it('selects the option under the pointer once after dragging between options', async () => {
    let highlights: SelectionCall[] = []
    let selections: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      onHighlight(value, option) {
        highlights.push({ option, value })
      },
      onSelect(value, option) {
        selections.push({ option, value })
      },
    })

    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    pointer(react, 'pointermove')
    await settle(root)
    pointer(preact, 'pointermove')
    await settle(root)
    pointer(preact, 'pointerup')
    pointer(preact, 'click')
    await settle(root)

    expect(highlights.map((highlight) => highlight.value)).toEqual(['react', 'preact'])
    expect(selections).toHaveLength(1)
    expect(selections[0]?.value).toBe('preact')
    expect(selections[0]?.option).toEqual(
      expect.objectContaining({
        id: preact.id,
        label: 'Preact',
        value: 'preact',
      }),
    )
    expect(preact.getAttribute('aria-selected')).toBe('true')
  })

  it('delays onSelect during flashSelection and ignores interactions until the flash completes', async () => {
    vi.useFakeTimers()

    let highlights: SelectionCall[] = []
    let selections: SelectionCall[] = []
    let { container, root } = renderControlledListbox({
      flashSelection: true,
      onHighlight(value, option) {
        highlights.push({ option, value })
      },
      onSelect(value, option) {
        selections.push({ option, value })
      },
    })

    let list = getList(container)
    let react = getOptionByText(container, 'React')
    let preact = getOptionByText(container, 'Preact')

    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'ArrowDown')
    await settle(root)
    key(list, 'Enter')
    await settle(root)

    expect(selections).toHaveLength(0)
    expect(react.getAttribute('data-flash')).toBe('true')

    key(list, 'End')
    pointer(preact, 'pointermove')
    await settle(root)

    expect(highlights.map((highlight) => highlight.value)).toEqual(['remix', 'react'])
    expect(preact.dataset.highlighted).toBe('false')
    expect(preact.getAttribute('aria-selected')).toBe('false')

    await finishSelectionFlash(root)

    expect(selections).toHaveLength(1)
    expect(selections[0]?.value).toBe('react')
    expect(selections[0]?.option).toEqual(
      expect.objectContaining({
        id: react.id,
        label: 'React',
        value: 'react',
      }),
    )
    expect(react.getAttribute('data-flash')).toBe(null)
    expect(react.getAttribute('aria-selected')).toBe('true')
  })
})
