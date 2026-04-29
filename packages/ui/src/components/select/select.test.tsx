import { expect } from '@remix-run/assert'
import {
  afterEach,
  beforeEach,
  describe,
  it,
  mock,
  type FakeTimers,
} from '@remix-run/test'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/ui'

import * as popover from '../popover/popover.ts'
import { onSelectChange, Option, Select, SelectChangeEvent } from './select.tsx'
import * as select from './select.tsx'

const flashDurationMs = 60
const labelDelayMs = 75
let roots: ReturnType<typeof createRoot>[] = []
const unsetDefaultValue = undefined

type RenderSelectOptions = {
  defaultLabel?: string
  defaultValue?: string
  name?: string
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

function renderSelect(props: RenderSelectOptions = {}) {
  let { defaultLabel = 'Select a framework', defaultValue, name } = props

  return (
    <Select defaultLabel={defaultLabel} defaultValue={defaultValue} name={name}>
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

function getTrigger(container: HTMLElement) {
  return container.querySelector('button') as HTMLButtonElement
}

function getSurface(container: HTMLElement) {
  return container.querySelector('[popover]') as HTMLElement
}

function getHiddenInput(container: HTMLElement) {
  return container.querySelector('input[type="hidden"]') as HTMLInputElement
}

function getList(container: HTMLElement) {
  return container.querySelector('[role="listbox"]') as HTMLElement
}

function getOptionByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (option) => option.textContent?.trim() === text,
  ) as HTMLElement
}

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
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

async function openSelect(
  container: HTMLElement,
  root: ReturnType<typeof createRoot>,
  keyToOpen?: 'ArrowDown' | 'ArrowUp',
) {
  let trigger = getTrigger(container)

  if (keyToOpen) {
    key(trigger, keyToOpen)
  } else {
    click(trigger)
  }

  await settleFrames(root)
}

async function finishCloseTransition(surface: HTMLElement) {
  await Promise.resolve()
  surface.dispatchEvent(new TransitionEvent('transitionrun', { propertyName: 'opacity' }))
  surface.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
  await Promise.resolve()
}

let timers!: FakeTimers
let scrollIntoViewSpy: ReturnType<typeof mock.method>

async function finishSelectUpdate(surface: HTMLElement, root: ReturnType<typeof createRoot>) {
  await timers.advanceAsync(flashDurationMs)
  await finishCloseTransition(surface)
  await settle(root)
  await timers.advanceAsync(labelDelayMs)
  await settle(root)
}

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

describe('Select', () => {
  it('applies defaultValue to the selected option while keeping defaultLabel on the trigger and wiring aria-describedby', async () => {
    let { container, root } = renderApp(renderSelect({ defaultValue: 'react' }))

    await settle(root)

    let trigger = getTrigger(container)
    let react = getOptionByText(container, 'React')

    expect(trigger.textContent).toContain('Select a framework')
    expect(trigger.getAttribute('aria-describedby')).toBe(react.id)
    expect(react.getAttribute('aria-selected')).toBe('true')
  })

  it('supports lower-level composition while keeping defaultLabel before selection settles', async (t) => {
    function SelectValue(handle: Handle) {
      let context = handle.context.get(select.Context)

      return () => <>{context.displayedLabel}</>
    }

    function Indirection() {
      return () => (
        <>
          <div mix={select.option({ label: 'Bug', value: 'bug' })}>Bug</div>
          <div mix={select.option({ label: 'Feature', value: 'feature' })}>Feature</div>
        </>
      )
    }

    let { container, root } = renderApp(
      <select.Context defaultLabel="Select a type" defaultValue={unsetDefaultValue}>
        <button type="button" mix={select.trigger()}>
          <SelectValue />
        </button>
        <popover.Context>
          <div mix={select.popover()}>
            <div mix={select.list()}>
              <Indirection />
            </div>
          </div>
        </popover.Context>
      </select.Context>,
    )
    let trigger = getTrigger(container)
    let surface = getSurface(container)

    expect(trigger.textContent).toContain('Select a type')

    await openSelect(container, root)

    timers = t.useFakeTimers()

    let feature = getOptionByText(container, 'Feature')
    click(feature)
    await settle(root)

    expect(feature.getAttribute('data-select-flash')).toBe('true')
    expect(trigger.textContent).toContain('Select a type')

    await finishSelectUpdate(surface, root)

    expect(trigger.textContent).toContain('Feature')
  })

  it('commits Option.label to the trigger after the flash, close transition, and label delay', async (t) => {
    let { container, root } = renderApp(renderSelect())
    let trigger = getTrigger(container)
    let surface = getSurface(container)

    expect(trigger.textContent).toContain('Select a framework')
    expect(surface.matches(':popover-open')).toBe(false)

    await openSelect(container, root)

    timers = t.useFakeTimers()

    let react = getOptionByText(container, 'React')
    click(react)
    await settle(root)

    expect(react.getAttribute('data-select-flash')).toBe('true')
    expect(trigger.textContent).toContain('Select a framework')
    expect(surface.matches(':popover-open')).toBe(true)

    await finishSelectUpdate(surface, root)

    expect(trigger.textContent).toContain('React framework')
    expect(trigger.textContent).not.toContain('React Router framework')
    expect(trigger.getAttribute('aria-describedby')).toBe(react.id)
    expect(surface.matches(':popover-open')).toBe(false)
  })

  it('opens on click, syncs min-width, moves focus into the list, and restores focus on escape', async () => {
    let { container, root } = renderApp(renderSelect())
    let trigger = getTrigger(container)
    let surface = getSurface(container)

    Object.defineProperty(trigger, 'offsetWidth', {
      configurable: true,
      value: 212,
    })

    expect(surface.style.minWidth).toBe('')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await openSelect(container, root)

    let list = getList(container)

    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger.getAttribute('aria-controls')).toBe(list.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(surface.style.minWidth).toBe('212px')
    expect(surface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(list)

    key(list, 'Escape')
    await settleFrames(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(surface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('lets an outer popover focus the Select trigger with popover.focusOnShow()', async () => {
    function OuterPopoverWithSelect(handle: Handle) {
      let open = false

      return () => (
        <popover.Context>
          <button
            id="outer-trigger"
            mix={[
              popover.anchor({ placement: 'bottom-start' }),
              popover.focusOnHide(),
              on('click', () => {
                open = true
                void handle.update()
              }),
            ]}
          >
            Open filters
          </button>

          <div
            id="outer-surface"
            mix={popover.surface({
              open,
              onHide() {
                open = false
                void handle.update()
              },
            })}
          >
            <Select
              id="grouping"
              defaultLabel="No grouping"
              defaultValue="none"
              mix={popover.focusOnShow()}
            >
              <Option label="No grouping" value="none" />
              <Option label="Status" value="status" />
              <Option label="Priority" value="priority" />
            </Select>
          </div>
        </popover.Context>
      )
    }

    let { container, root } = renderApp(<OuterPopoverWithSelect />)
    let outerTrigger = container.querySelector('#outer-trigger') as HTMLButtonElement
    let selectTrigger = container.querySelector('#grouping') as HTMLButtonElement

    outerTrigger.focus()
    click(outerTrigger)
    await settleFrames(root)

    expect(document.activeElement).toBe(selectTrigger)
  })

  it('typeahead on the closed trigger selects a matching option immediately', async () => {
    let changes: SelectChangeEvent[] = []

    let { container, root } = renderApp(
      <div
        mix={onSelectChange((event) => {
          changes.push(event)
        })}
      >
        {renderSelect()}
      </div>,
    )
    let trigger = getTrigger(container)
    let surface = getSurface(container)
    let remix = getOptionByText(container, 'Remix')

    trigger.focus()
    key(trigger, 'r')
    await settle(root)

    expect(surface.matches(':popover-open')).toBe(false)
    expect(trigger.textContent).toContain('Remix framework')
    expect(trigger.getAttribute('aria-describedby')).toBe(remix.id)
    expect(remix.getAttribute('aria-selected')).toBe('true')
    expect(changes).toHaveLength(1)
    expect(changes[0]?.value).toBe('remix')
    expect(changes[0]?.target).toBe(trigger)
  })

  it('typeahead on the closed trigger matches option textValue values', async () => {
    let { container, root } = renderApp(
      <Select defaultLabel="Select an environment" defaultValue={unsetDefaultValue}>
        <Option label="Production environment" value="production">
          Production
        </Option>
        <Option label="Staging environment" textValue="beta" value="staging">
          Staging
        </Option>
        <Option label="Local environment" textValue="dev" value="local">
          Local
        </Option>
      </Select>,
    )
    let trigger = getTrigger(container)
    let staging = getOptionByText(container, 'Staging')

    trigger.focus()
    key(trigger, 'b')
    await settle(root)

    expect(trigger.textContent).toContain('Staging environment')
    expect(trigger.getAttribute('aria-describedby')).toBe(staging.id)
    expect(staging.getAttribute('aria-selected')).toBe('true')
  })

  it('ArrowDown and ArrowUp reopen from the selected value', async () => {
    let { container, root } = renderApp(
      <Select defaultLabel="Select an environment" defaultValue="staging">
        <Option label="Local" value="local" />
        <Option label="Staging" value="staging" />
        <Option label="Production" value="production" />
      </Select>,
    )
    let trigger = getTrigger(container)

    await settle(root)
    await openSelect(container, root, 'ArrowDown')

    let list = getList(container)
    let staging = getOptionByText(container, 'Staging')

    expect(document.activeElement).toBe(list)
    expect(staging.getAttribute('data-highlighted')).toBe('true')

    key(list, 'Escape')
    await settleFrames(root)

    expect(document.activeElement).toBe(trigger)

    await openSelect(container, root, 'ArrowUp')

    list = getList(container)
    staging = getOptionByText(container, 'Staging')

    expect(document.activeElement).toBe(list)
    expect(staging.getAttribute('data-highlighted')).toBe('true')
  })

  it('participates in formdata with hidden input', async (t) => {
    let { container, root } = renderApp(
      <form>
        <Select defaultLabel="Select a framework" name="framework" type="button">
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
      </form>,
    )
    let form = container.querySelector('form') as HTMLFormElement
    let hiddenInput = getHiddenInput(container)
    let surface = getSurface(container)

    expect(hiddenInput.name).toBe('framework')
    expect(hiddenInput.value).toBe('')

    await openSelect(container, root)

    timers = t.useFakeTimers()

    let react = getOptionByText(container, 'React')
    click(react)
    await settle(root)
    await finishSelectUpdate(surface, root)

    let formData = new FormData(form)

    expect(hiddenInput.value).toBe('react')
    expect(formData.get('framework')).toBe('react')
  })
  it('dispatches change event', async (t) => {
    let changes: SelectChangeEvent[] = []
    let { container, root } = renderApp(
      <div
        mix={onSelectChange((event) => {
          changes.push(event)
        })}
      >
        {renderSelect()}
      </div>,
    )
    let trigger = getTrigger(container)
    let surface = getSurface(container)

    await openSelect(container, root)

    timers = t.useFakeTimers()

    let react = getOptionByText(container, 'React')
    click(react)
    await settle(root)
    await finishSelectUpdate(surface, root)

    expect(changes).toHaveLength(1)
    expect(changes[0]).toBeInstanceOf(SelectChangeEvent)
    expect(changes[0]?.label).toBe('React framework')
    expect(changes[0]?.optionId).toBe(react.id)
    expect(changes[0]?.value).toBe('react')
    expect(changes[0]?.target).toBe(trigger)
  })
  it.todo('arrow down/up selects first last when there is no selection')
  it.todo('aria-activedescendant is correctly on open')
})
