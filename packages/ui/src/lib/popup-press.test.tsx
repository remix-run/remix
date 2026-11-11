import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, on, type RemixNode } from '@remix-run/component'

import { pointer } from '../test/pointer.ts'
import { commitOnRelease, openOnPress } from './popup-press.ts'
import { press } from './press.ts'

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

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('openOnPress', () => {
  // A trigger that toggles on click and opens on press, the way select and menu triggers do.
  function renderPopup({ withPress = false, disabled = false } = {}) {
    let log: string[] = []
    let open = false
    let container = renderApp(
      <div>
        <button
          type="button"
          id="trigger"
          aria-controls="list"
          aria-disabled={disabled ? 'true' : undefined}
          mix={[
            openOnPress({
              isOpen: () => open,
              open() {
                open = true
                log.push('open')
              },
            }),
            withPress && press(),
            on('click', () => {
              log.push('click')
              open = !open
            }),
          ]}
        >
          Trigger
        </button>
        <div id="list">
          <div id="inside" role="option">
            Inside
          </div>
          <div id="menu-item" role="menuitemcheckbox">
            Item
          </div>
          <div id="padding" />
        </div>
        <div id="elsewhere" role="option">
          Elsewhere
        </div>
      </div>,
    )
    container.addEventListener('click', (event) => {
      let id = (event.target as HTMLElement).id
      if (id !== 'trigger') log.push(id)
    })

    return {
      log,
      isOpen: () => open,
      trigger: container.querySelector('button') as HTMLButtonElement,
      get(id: string) {
        return container.querySelector(`#${id}`) as HTMLElement
      },
    }
  }

  it('opens on primary mouse pointerdown without a click, and keeps focus where it is', () => {
    let { log, trigger } = renderPopup()

    let event = pointer(trigger, 'pointerdown')

    expect(log).toEqual(['open'])
    expect(event.defaultPrevented).toBe(true)
  })

  it('cancels the click that trails the press, so the popup stays open', () => {
    let { log, isOpen, trigger } = renderPopup()

    pointer(trigger, 'pointerdown')
    pointer(trigger, 'pointerup')
    let click = new MouseEvent('click', { bubbles: true, cancelable: true })
    trigger.dispatchEvent(click)

    expect(log).toEqual(['open'])
    expect(isOpen()).toBe(true)
    expect(click.defaultPrevented).toBe(true)
  })

  it('opens once when press() is composed on the same host', () => {
    let { log, isOpen, trigger } = renderPopup({ withPress: true })

    pointer(trigger, 'pointerdown')
    pointer(trigger, 'pointerup')
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(log).toEqual(['open'])
    expect(isOpen()).toBe(true)
  })

  it('leaves a press on an open popup, and the click after it, to the click handler', async () => {
    let { log, isOpen, trigger } = renderPopup()

    pointer(trigger, 'pointerdown')
    pointer(trigger, 'pointerup')
    await new Promise((resolve) => setTimeout(resolve))

    let event = pointer(trigger, 'pointerdown')
    pointer(trigger, 'pointerup')
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(event.defaultPrevented).toBe(false)
    expect(log).toEqual(['open', 'click'])
    expect(isOpen()).toBe(false)
  })

  it('leaves touch, pen, secondary buttons, modifier presses, and disabled triggers alone', () => {
    let { log, trigger } = renderPopup()
    let disabled = renderPopup({ disabled: true })

    pointer(trigger, 'pointerdown', { pointerType: 'touch' })
    pointer(trigger, 'pointerdown', { pointerType: 'pen' })
    pointer(trigger, 'pointerdown', { button: 2, buttons: 2 })
    pointer(trigger, 'pointerdown', { shiftKey: true })
    pointer(disabled.trigger, 'pointerdown')

    expect(log).toEqual([])
    expect(disabled.log).toEqual([])
  })

  it('clicks the option or menu item the held mouse is released over', () => {
    let { log, trigger, get } = renderPopup()

    pointer(trigger, 'pointerdown', { clientX: 10, clientY: 10 })
    pointer(get('inside'), 'pointerup', { clientX: 10, clientY: 40 })
    expect(log).toEqual(['open', 'inside'])
  })

  it('clicks a menu item the same way', () => {
    let { log, trigger, get } = renderPopup()

    pointer(trigger, 'pointerdown', { clientX: 10, clientY: 10 })
    pointer(get('menu-item'), 'pointerup', { clientX: 40, clientY: 10 })
    expect(log).toEqual(['open', 'menu-item'])
  })

  it('does not commit a release that barely left the press position', () => {
    let { log, trigger, get } = renderPopup()

    pointer(trigger, 'pointerdown', { clientX: 10, clientY: 10 })
    pointer(get('inside'), 'pointerup', { clientX: 13, clientY: 12 })

    expect(log).toEqual(['open'])
  })

  it('does not commit releases on the trigger, popup padding, or items outside aria-controls', async () => {
    let { log, isOpen, trigger, get } = renderPopup()

    for (let target of [trigger, get('padding'), get('elsewhere')]) {
      // The click that trails a release is cancelled until the end of that task.
      await new Promise((resolve) => setTimeout(resolve))
      if (isOpen()) trigger.click()
      log.length = 0
      pointer(trigger, 'pointerdown', { clientX: 10, clientY: 10 })
      pointer(target, 'pointerup', { clientX: 10, clientY: 80 })
      expect(log).toEqual(['open'])
    }
  })

  it('does not commit a cancelled press', () => {
    let { log, trigger, get } = renderPopup()

    pointer(trigger, 'pointerdown', { clientX: 10, clientY: 10 })
    pointer(get('inside'), 'pointercancel', { clientX: 10, clientY: 80 })

    expect(log).toEqual(['open'])
  })
})

describe('commitOnRelease', () => {
  function renderList() {
    let clicks: string[] = []
    let container = renderApp(
      <div>
        <div role="listbox" id="list">
          <div id="a" role="option" mix={commitOnRelease()}>
            A
          </div>
          <div id="b" role="option" mix={commitOnRelease()}>
            B
          </div>
          <div id="off" role="option" aria-disabled="true">
            Off
          </div>
          <div id="padding" />
        </div>
        <div id="elsewhere" role="option">
          Elsewhere
        </div>
      </div>,
    )
    container.addEventListener('click', (event) => {
      clicks.push((event.target as HTMLElement).id)
    })

    return {
      clicks,
      get(id: string) {
        return container.querySelector(`#${id}`) as HTMLElement
      },
    }
  }

  it('commits on release, not on press, the item a press that started on another item ends over', () => {
    let { clicks, get } = renderList()

    pointer(get('a'), 'pointerdown')
    expect(clicks).toEqual([])

    pointer(get('b'), 'pointerup')
    expect(clicks).toEqual(['b'])
  })

  it('leaves a release over the pressed item to its own click', () => {
    let { clicks, get } = renderList()

    pointer(get('a'), 'pointerdown')
    pointer(get('a'), 'pointerup')

    expect(clicks).toEqual([])
  })

  it('commits nothing when released outside the list, over a disabled item, or after a cancel', () => {
    let { clicks, get } = renderList()

    for (let [type, target] of [
      ['pointerup', get('padding')],
      ['pointerup', get('elsewhere')],
      ['pointerup', get('off')],
      ['pointercancel', get('b')],
    ] as const) {
      pointer(get('a'), 'pointerdown')
      pointer(target, type)
    }

    expect(clicks).toEqual([])
  })

  it('ignores touch, pen, secondary buttons, and modifier presses', () => {
    let { clicks, get } = renderList()

    pointer(get('a'), 'pointerdown', { pointerType: 'touch' })
    pointer(get('b'), 'pointerup', { pointerType: 'touch' })
    pointer(get('a'), 'pointerdown', { button: 2, buttons: 2 })
    pointer(get('b'), 'pointerup')
    pointer(get('a'), 'pointerdown', { shiftKey: true })
    pointer(get('b'), 'pointerup')

    expect(clicks).toEqual([])
  })
})
