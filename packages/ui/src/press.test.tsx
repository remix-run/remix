import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, on, type RemixNode } from '@remix-run/component'

import * as listbox from './listbox.ts'
import { press } from './press.ts'
import * as tabs from './tabs.ts'
import { toggle } from './toggle.ts'
import { mouseClick, pointer } from './test/pointer.ts'

let roots: ReturnType<typeof createRoot>[] = []

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return container
}

function record(container: HTMLElement) {
  let events: string[] = []
  for (let type of ['click', 'input', 'change', 'submit', 'reset']) {
    container.addEventListener(type, (event) => {
      if (type === 'submit') event.preventDefault()
      events.push(`${type}:${(event.target as HTMLElement).tagName.toLowerCase()}`)
    })
  }
  return events
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('press (public)', () => {
  it('toggles a native checkbox once on press, with native events', () => {
    let container = renderApp(<input type="checkbox" mix={press()} />)
    let events = record(container)
    let input = container.querySelector('input') as HTMLInputElement

    pointer(input, 'pointerdown')
    expect(input.checked).toBe(true)
    expect(events).toEqual(['click:input', 'input:input', 'change:input'])

    pointer(input, 'pointerup')
    input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(input.checked).toBe(true)
    expect(events).toEqual(['click:input', 'input:input', 'change:input'])
  })

  it('checks a native radio once on press', () => {
    let container = renderApp(
      <form>
        <input type="radio" name="size" value="s" defaultChecked />
        <input type="radio" name="size" value="m" mix={press()} />
      </form>,
    )
    let events = record(container)
    let [small, medium] = Array.from(container.querySelectorAll('input'))

    mouseClick(medium)

    expect(small.checked).toBe(false)
    expect(medium.checked).toBe(true)
    expect(events).toEqual(['click:input', 'input:input', 'change:input'])
  })

  it('forwards a press on a label to its checkbox once', () => {
    let container = renderApp(
      <div>
        <label mix={press()}>
          <input type="checkbox" />
          <span>Wrapped</span>
        </label>
        <input id="for-target" type="checkbox" />
        <label for="for-target" mix={press()}>
          For
        </label>
      </div>,
    )
    let events = record(container)
    let [wrapped, byFor] = Array.from(container.querySelectorAll<HTMLInputElement>('input'))

    mouseClick(container.querySelector('span') as HTMLElement)
    expect(wrapped.checked).toBe(true)

    mouseClick(container.querySelector('label[for]') as HTMLElement)
    expect(byFor.checked).toBe(true)

    expect(events.filter((event) => event === 'change:input')).toHaveLength(2)
  })

  it('submits and resets a form once, on press', () => {
    let container = renderApp(
      <form>
        <input name="q" defaultValue="a" />
        <button type="submit" mix={press()}>
          Submit
        </button>
        <button type="reset" mix={press()}>
          Reset
        </button>
      </form>,
    )
    let events = record(container)
    let input = container.querySelector('input') as HTMLInputElement
    let [submit, reset] = Array.from(container.querySelectorAll('button'))

    input.value = 'b'
    pointer(submit, 'pointerdown')
    expect(events).toContain('submit:form')
    pointer(submit, 'pointerup')
    mouseClick(submit)
    mouseClick(reset)

    expect(events.filter((event) => event === 'submit:form')).toHaveLength(2)
    expect(events.filter((event) => event === 'reset:form')).toHaveLength(1)
    expect(input.value).toBe('a')
  })

  it('does not activate disabled or aria-disabled hosts', () => {
    let container = renderApp(
      <div>
        <input type="checkbox" disabled mix={press()} />
        <input type="checkbox" aria-disabled="true" mix={press()} />
      </div>,
    )
    let events = record(container)

    for (let input of container.querySelectorAll('input')) {
      pointer(input, 'pointerdown')
    }

    expect(events).toEqual([])
  })

  it('leaves non-mouse, secondary-button and modifier presses to the native click', () => {
    let container = renderApp(<input type="checkbox" mix={press()} />)
    let input = container.querySelector('input') as HTMLInputElement

    pointer(input, 'pointerdown', { pointerType: 'touch' })
    pointer(input, 'pointerdown', { pointerType: 'pen' })
    pointer(input, 'pointerdown', { button: 2, buttons: 2 })
    pointer(input, 'pointerdown', { shiftKey: true })
    expect(input.checked).toBe(false)

    input.click()
    expect(input.checked).toBe(true)
  })

  it('keeps keyboard activation native', () => {
    let calls = 0
    let container = renderApp(
      <button
        type="button"
        mix={[
          press(),
          on('click', () => {
            calls++
          }),
        ]}
      >
        Go
      </button>,
    )

    ;(container.querySelector('button') as HTMLButtonElement).click()

    expect(calls).toBe(1)
  })
})

describe('press composed with primitives', () => {
  it('activates a tab on press, once', () => {
    let changes: string[] = []
    let container = renderApp(
      <tabs.Context defaultActiveTab="a" onActiveTabChange={(name) => changes.push(name)}>
        <div mix={tabs.root()}>
          <div mix={tabs.list()}>
            <button type="button" mix={[tabs.tab({ name: 'a' }), press()]}>
              A
            </button>
            <button type="button" mix={[tabs.tab({ name: 'b' }), press()]}>
              B
            </button>
          </div>
          <div mix={tabs.panel({ name: 'a' })}>Panel A</div>
          <div mix={tabs.panel({ name: 'b' })}>Panel B</div>
        </div>
      </tabs.Context>,
    )
    let tab = container.querySelectorAll<HTMLElement>('[role="tab"]')[1]

    pointer(tab, 'pointerdown')
    roots[0].flush()
    expect(tab.getAttribute('aria-selected')).toBe('true')

    pointer(tab, 'pointerup')
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(changes).toEqual(['b'])
  })

  it('toggles a native input and a custom host on press, once each', () => {
    let changes: boolean[] = []
    let container = renderApp(
      <div>
        <input
          aria-label="Native"
          mix={[toggle({ onCheckedChange: (c) => changes.push(c) }), press()]}
        />
        <button mix={[toggle({ onCheckedChange: (c) => changes.push(c) }), press()]}>Custom</button>
      </div>,
    )

    for (let host of container.querySelectorAll<HTMLElement>('input, button')) {
      pointer(host, 'pointerdown')
      pointer(host, 'pointerup')
      host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    }

    expect(changes).toEqual([true, true])
  })

  it('selects a listbox option on press, once', () => {
    let selections: string[] = []
    let container = renderApp(
      <listbox.Context
        activeValue={null}
        value={null}
        onHighlight={() => {}}
        onSelect={(value) => selections.push(String(value))}
      >
        <div aria-label="Frameworks" mix={listbox.list()}>
          <div mix={[listbox.option({ label: 'React', value: 'react' }), press()]}>React</div>
        </div>
      </listbox.Context>,
    )
    let option = container.querySelector('[role="option"]') as HTMLElement

    pointer(option, 'pointerdown')
    pointer(option, 'pointerup')
    option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(selections).toEqual(['react'])
  })

  it('checks a control through a plain label of a press() control', () => {
    let container = renderApp(
      <div>
        <label for="composed" mix={press()}>
          Label
        </label>
        <input id="composed" type="checkbox" mix={press()} />
      </div>,
    )
    let label = container.querySelector('label') as HTMLElement
    let input = container.querySelector('input') as HTMLInputElement

    pointer(label, 'pointerdown')
    expect(input.checked).toBe(true)

    pointer(label, 'pointerup')
    label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(input.checked).toBe(true)
  })
})
