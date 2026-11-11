import { expect } from '@remix-run/assert'
import { afterEach, describe, it } from '@remix-run/test'

import { createRoot, on, type Props, type RemixNode } from '@remix-run/component'

import { mouseClick, pointer } from '../test/pointer.ts'
import { Portal } from '../portal.tsx'
import { press } from './press.ts'
import type { PressOptions } from './press.ts'

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

function renderPress(handler: (event: MouseEvent) => void, props: Props<'button'> = {}) {
  let container = renderApp(
    <button type="button" mix={[press(), on<HTMLElement, 'click'>('click', handler)]} {...props}>
      Press
    </button>,
  )
  return container.querySelector('button') as HTMLButtonElement
}

function nextTask() {
  return new Promise<void>((resolve) => setTimeout(resolve))
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('press', () => {
  it('keeps pressed hosts unselectable with a default cursor', () => {
    let container = renderApp(<button type="button" mix={press()} />)
    let style = getComputedStyle(container.querySelector('button') as HTMLElement)
    expect(style.cursor).toBe('default')
    expect(style.userSelect).toBe('none')
  })

  it('keeps the native cursor and selection of text-entry hosts and descendants', () => {
    let container = renderApp(
      <div>
        <input id="bare" type="text" mix={press()} />
        <textarea id="area" mix={press()} />
        <label id="wrap" mix={press()}>
          <span id="text">Name</span>
          <input id="nested" type="search" />
          <textarea id="nested-area" />
          <input id="box" type="checkbox" />
        </label>
      </div>,
    )
    let style = (id: string) => getComputedStyle(container.querySelector(`#${id}`) as HTMLElement)

    for (let id of ['bare', 'area', 'nested', 'nested-area']) {
      expect(style(id).cursor).not.toBe('default')
      expect(style(id).userSelect).not.toBe('none')
    }

    // Descendants inherit the label's `none`; only Chromium reports `auto` as its resolved value.
    expect(style('wrap').cursor).toBe('default')
    expect(style('wrap').userSelect).toBe('none')
  })

  describe('labels', () => {
    function renderLabel(wrapping: boolean) {
      let container = wrapping
        ? renderApp(
            <label mix={press()}>
              <span>Subscribe</span>
              <input type="checkbox" />
            </label>,
          )
        : renderApp(
            <div>
              <label for="subscribe" mix={press()}>
                <span>Subscribe</span>
              </label>
              <input id="subscribe" type="checkbox" />
            </div>,
          )
      let checkbox = container.querySelector('input') as HTMLInputElement
      let changes = 0
      checkbox.addEventListener('change', () => changes++)
      return {
        checkbox,
        text: container.querySelector('span') as HTMLElement,
        get changes() {
          return changes
        },
      }
    }

    it('toggles the control of a wrapping or for= label once, on press', () => {
      for (let wrapping of [true, false]) {
        let view = renderLabel(wrapping)

        mouseClick(view.text)
        expect(view.checkbox.checked).toBe(true)
        expect(view.changes).toBe(1)

        mouseClick(view.text)
        expect(view.checkbox.checked).toBe(false)
        expect(view.changes).toBe(2)
      }
    })

    it('toggles on pointerdown, before the release', () => {
      let view = renderLabel(true)

      pointer(view.text, 'pointerdown')
      expect(view.checkbox.checked).toBe(true)

      pointer(view.text, 'pointerup')
      view.text.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      expect(view.checkbox.checked).toBe(true)
      expect(view.changes).toBe(1)
    })

    it('toggles once when the pressed element is the control inside its own label', () => {
      let view = renderLabel(true)

      mouseClick(view.checkbox)
      expect(view.checkbox.checked).toBe(true)
      expect(view.changes).toBe(1)
    })

    it('focuses the text control of a label on press', () => {
      let container = renderApp(
        <label mix={press()}>
          <span>Name</span>
          <input type="text" />
        </label>,
      )

      pointer(container.querySelector('span') as HTMLElement, 'pointerdown')
      expect(document.activeElement).toBe(container.querySelector('input'))
    })

    it('activates a press control from its plain wrapping or for= label, once', () => {
      for (let wrapping of [true, false]) {
        let container = wrapping
          ? renderApp(
              <label>
                <span>Subscribe</span>
                <input type="checkbox" mix={press()} />
              </label>,
            )
          : renderApp(
              <div>
                <label for="plain">
                  <span>Subscribe</span>
                </label>
                <input id="plain" type="checkbox" mix={press()} />
              </div>,
            )
        let checkbox = container.querySelector('input') as HTMLInputElement
        let text = container.querySelector('span') as HTMLElement
        let changes = 0
        checkbox.addEventListener('change', () => changes++)

        pointer(text, 'pointerdown')
        expect(checkbox.checked).toBe(true)

        pointer(text, 'pointerup')
        text.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        expect(checkbox.checked).toBe(true)
        expect(changes).toBe(1)
      }
    })

    it('does not activate from a label that uses press itself twice', () => {
      let container = renderApp(
        <label mix={press()}>
          <span>Subscribe</span>
          <input type="checkbox" mix={press()} />
        </label>,
      )
      let checkbox = container.querySelector('input') as HTMLInputElement

      mouseClick(container.querySelector('span') as HTMLElement)
      expect(checkbox.checked).toBe(true)
    })

    it('leaves interactive content in a plain label, disabled controls and plain controls alone', () => {
      let container = renderApp(
        <div>
          <label>
            <a href="#top" id="link">
              link
            </a>
            <input id="a" type="checkbox" mix={press()} />
          </label>
          <label>
            <span id="disabled-text">disabled</span>
            <input id="b" type="checkbox" disabled mix={press()} />
          </label>
          <label>
            <span id="plain-text">plain</span>
            <input id="c" type="checkbox" />
          </label>
        </div>,
      )
      let checked = (id: string) => (container.querySelector(`#${id}`) as HTMLInputElement).checked

      pointer(container.querySelector('#link') as HTMLElement, 'pointerdown')
      pointer(container.querySelector('#disabled-text') as HTMLElement, 'pointerdown')
      pointer(container.querySelector('#plain-text') as HTMLElement, 'pointerdown')

      expect([checked('a'), checked('b'), checked('c')]).toEqual([false, false, false])
    })

    it('leaves touch presses and modifier presses to the native click', () => {
      let view = renderLabel(true)

      pointer(view.text, 'pointerdown', { pointerType: 'touch' })
      pointer(view.text, 'pointerdown', { shiftKey: true })
      expect(view.changes).toBe(0)
    })
  })

  it('clicks the host on primary mouse pointerdown, before the release', () => {
    let events: string[] = []
    let button = renderPress((event) => events.push(event.type))

    pointer(button, 'pointerdown')
    expect(events).toEqual(['click'])

    pointer(button, 'pointerup')
    expect(events).toEqual(['click'])
  })

  it('dispatches a click with the position and button of the press', () => {
    let clicks: MouseEvent[] = []
    let button = renderPress((event) => clicks.push(event))

    pointer(button, 'pointerdown', { clientX: 12, clientY: 34, screenX: 56, screenY: 78 })

    expect(clicks).toHaveLength(1)
    let [click] = clicks
    expect(click).toBeInstanceOf(PointerEvent)
    expect(click.isTrusted).toBe(false)
    expect(click.detail).toBe(1)
    expect(click.button).toBe(0)
    expect([click.clientX, click.clientY, click.screenX, click.screenY]).toEqual([12, 34, 56, 78])
    expect((click as PointerEvent).pointerType).toBe('mouse')
  })

  it('keeps the native activation of checkboxes, radios, links, submit and reset buttons', async () => {
    let events: string[] = []
    let container = renderApp(
      <form
        mix={[
          on('submit', (event) => {
            event.preventDefault()
            events.push('submit')
          }),
          on('reset', () => {
            events.push('reset')
          }),
        ]}
      >
        <input
          id="box"
          type="checkbox"
          mix={[
            press(),
            on('change', () => {
              events.push('box')
            }),
          ]}
        />
        <input id="a" type="radio" name="r" value="a" mix={press()} />
        <input id="b" type="radio" name="r" value="b" mix={press()} />
        <a id="link" href="#pressed" mix={press()}>
          Link
        </a>
        <button id="submit" type="submit" mix={press()} />
        <button id="reset" type="reset" mix={press()} />
      </form>,
    )
    let get = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement

    for (let id of ['box', 'b', 'link', 'submit', 'reset']) {
      pointer(get(id), 'pointerdown')
      pointer(get(id), 'pointerup')
    }

    expect(get('box').checked).toBe(false)
    expect(events).toEqual(['box', 'submit', 'reset'])
    expect(get('b').checked).toBe(false)
    // Firefox applies a same-document link navigation asynchronously.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(location.hash).toBe('#pressed')
    location.hash = ''

    pointer(get('box'), 'pointerdown')
    pointer(get('box'), 'pointerup')
    pointer(get('a'), 'pointerdown')
    pointer(get('a'), 'pointerup')
    expect([get('box').checked, get('a').checked, get('b').checked]).toEqual([true, true, false])
  })

  it('leaves the activation to the click with activate: false', () => {
    let clicks = 0
    let container = renderApp(
      <div>
        <button
          id="host"
          type="button"
          mix={[
            press({ activate: false }),
            on('click', () => {
              clicks++
            }),
          ]}
        />
        <label id="label" for="box">
          Label
        </label>
        <input id="box" type="checkbox" mix={press({ activate: false })} />
      </div>,
    )

    pointer(container.querySelector('#host') as HTMLElement, 'pointerdown')
    pointer(container.querySelector('#label') as HTMLElement, 'pointerdown')

    expect(clicks).toBe(0)
    expect((container.querySelector('#box') as HTMLInputElement).checked).toBe(false)

    mouseClick(container.querySelector('#host') as HTMLElement)
    expect(clicks).toBe(1)
  })

  it('hides the trailing click from listeners on and inside the host', () => {
    let seen = 0
    let container = renderApp(
      <button
        type="button"
        mix={[
          press(),
          on('click', () => {
            seen++
          }),
        ]}
      >
        <span>Press</span>
      </button>,
    )
    let span = container.querySelector('span') as HTMLElement

    pointer(span, 'pointerdown')
    pointer(span, 'pointerup')
    let trailing = new MouseEvent('click', { bubbles: true, cancelable: true })
    span.dispatchEvent(trailing)

    expect(seen).toBe(1)
    expect(trailing.defaultPrevented).toBe(true)
  })

  it('handles the next click once the press has ended', async () => {
    let calls = 0
    let button = renderPress(() => calls++)

    mouseClick(button)
    await nextTask()
    button.click()

    expect(calls).toBe(2)
  })

  it('leaves clicks without a press alone, as keyboard and assistive technology produce', () => {
    let calls = 0
    let button = renderPress(() => calls++)

    button.click()

    expect(calls).toBe(1)
  })

  it('waits for the click on touch and pen presses', () => {
    let events: string[] = []
    let button = renderPress((event) => events.push(event.type))

    pointer(button, 'pointerdown', { pointerType: 'touch' })
    pointer(button, 'pointerup', { pointerType: 'touch' })
    expect(events).toEqual([])
    button.click()
    expect(events).toEqual(['click'])

    pointer(button, 'pointerdown', { pointerType: 'pen' })
    pointer(button, 'pointerup', { pointerType: 'pen' })
    expect(events).toEqual(['click'])
    button.click()
    expect(events).toEqual(['click', 'click'])
  })

  it('ignores secondary buttons, modifier presses and presses on disabled hosts', () => {
    let calls = 0
    let button = renderPress(() => calls++)
    let disabled = renderPress(() => calls++, { 'aria-disabled': 'true' })

    pointer(button, 'pointerdown', { button: 2, buttons: 2 })
    for (let modifier of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey']) {
      pointer(button, 'pointerdown', { [modifier]: true })
    }
    pointer(disabled, 'pointerdown')

    expect(calls).toBe(0)
  })
})

function key(
  target: Element,
  type: 'keydown' | 'keyup',
  key: string,
  init: KeyboardEventInit = {},
) {
  let event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

// Renders a host that records its lifecycle and its clicks into one ordered list.
function renderLifecycle(
  { long, ...options }: PressOptions & { long?: boolean } = {},
  { tag = 'button', ...props }: Props<'button'> & { tag?: 'button' | 'div' } = {},
) {
  let log: string[] = []
  let ends: Array<{ cancelled: boolean; clientX: number; clientY: number; pointerType: string }> =
    []
  let starts: Array<{ clientX: number; clientY: number; pointerType: string }> = []
  let Host = tag as 'button'
  let container = renderApp(
    <Host
      type="button"
      mix={[
        press({
          onPressStart(info) {
            log.push('start')
            starts.push(info)
          },
          onPressEnd(info) {
            log.push(info.cancelled ? 'cancel' : 'end')
            ends.push(info)
          },
          onLongPress: long ? () => log.push('long') : undefined,
          ...options,
        }),
        on<HTMLElement, 'click'>('click', () => {
          log.push('click')
        }),
      ]}
      {...props}
    >
      Press
    </Host>,
  )
  return { host: container.firstElementChild as HTMLElement, log, starts, ends }
}

describe('press lifecycle', () => {
  it('reports pointer presses with their coordinates and type', () => {
    let { host, log, starts, ends } = renderLifecycle()

    pointer(host, 'pointerdown', { clientX: 11, clientY: 22 })
    pointer(host, 'pointerup', { clientX: 33, clientY: 44 })

    expect(starts).toEqual([{ clientX: 11, clientY: 22, pointerType: 'mouse' }])
    expect(ends).toEqual([{ clientX: 33, clientY: 44, pointerType: 'mouse', cancelled: false }])
    // The lifecycle starts before the early activation it accompanies.
    expect(log).toEqual(['start', 'click', 'end'])
  })

  it('reports Enter and Space presses at the center of the host', () => {
    for (let name of ['Enter', ' ']) {
      let { host, log, starts, ends } = renderLifecycle({}, { style: 'width: 40px; height: 20px' })
      let rect = host.getBoundingClientRect()
      let center = { clientX: rect.left + 20, clientY: rect.top + 10, pointerType: 'keyboard' }

      key(host, 'keydown', name)
      key(host, 'keyup', name)

      expect(log).toEqual(['start', 'end'])
      expect(starts).toEqual([center])
      expect(ends).toEqual([{ ...center, cancelled: false }])
    }
  })

  it('keeps keyboard activation native', () => {
    let { host, log } = renderLifecycle()
    // Dispatched events have no default action, so activation is the browser's, not the mixin's.
    key(host, 'keydown', 'Enter')
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'end'])
  })

  it('keeps Space from scrolling unless the host activates on it natively', () => {
    let div = renderLifecycle({}, { tag: 'div', tabIndex: 0 })
    expect(key(div.host, 'keydown', ' ').defaultPrevented).toBe(true)
    key(div.host, 'keyup', ' ')
    expect(key(div.host, 'keydown', 'Enter').defaultPrevented).toBe(false)
    key(div.host, 'keyup', 'Enter')

    let button = renderLifecycle()
    expect(key(button.host, 'keydown', ' ').defaultPrevented).toBe(false)
  })

  it('ignores other keys, repeats, duplicate keydowns, key events of descendants, and stray keyups', () => {
    let { host, log } = renderLifecycle()
    let child = host.appendChild(document.createElement('span'))

    key(host, 'keyup', 'Enter')
    key(host, 'keydown', 'a')
    key(child, 'keydown', 'Enter')
    key(host, 'keydown', 'Enter', { repeat: true })
    expect(log).toEqual([])

    key(host, 'keydown', 'Enter')
    key(host, 'keydown', 'Enter')
    key(host, 'keyup', 'Space')
    key(host, 'keyup', 'a')
    expect(log).toEqual(['start'])

    key(host, 'keyup', 'Enter')
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'end'])
  })

  it('ignores non-primary pointers, other buttons, modifier presses, and disabled hosts', () => {
    let { host, log } = renderLifecycle()

    for (let init of [
      { isPrimary: false },
      { button: 1 },
      { button: 2 },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { metaKey: true },
    ]) {
      pointer(host, 'pointerdown', init)
      pointer(host, 'pointerup')
    }
    expect(log).toEqual([])

    for (let props of [{ disabled: true }, { 'aria-disabled': 'true' as const }]) {
      let disabled = renderLifecycle({}, props)
      pointer(disabled.host, 'pointerdown')
      key(disabled.host, 'keydown', 'Enter')
      expect(disabled.log).toEqual([])
    }
  })

  it('cancels a press released outside the host', () => {
    let { host, log } = renderLifecycle()

    pointer(host, 'pointerdown')
    pointer(document.body, 'pointerup')
    expect(log).toEqual(['start', 'click', 'cancel'])

    // The press is over: a later release elsewhere reports nothing.
    pointer(document.body, 'pointerup')
    expect(log).toEqual(['start', 'click', 'cancel'])
  })

  it('treats a release over a descendant of the host as inside', () => {
    let { host, ends } = renderLifecycle()
    let child = host.appendChild(document.createElement('span'))

    pointer(host, 'pointerdown')
    pointer(child, 'pointerup')
    expect(ends.map((end) => end.cancelled)).toEqual([false])
  })

  it('cancels on pointercancel, such as a scroll', () => {
    let { host, log } = renderLifecycle()

    pointer(host, 'pointerdown', { pointerType: 'touch' })
    pointer(host, 'pointercancel', { pointerType: 'touch' })
    expect(log).toEqual(['start', 'cancel'])
  })

  it('reports touch and pen presses without activating early', () => {
    for (let pointerType of ['touch', 'pen']) {
      let { host, log, starts } = renderLifecycle()

      pointer(host, 'pointerdown', { pointerType })
      pointer(host, 'pointerup', { pointerType })
      expect(log).toEqual(['start', 'end'])
      expect(starts[0].pointerType).toBe(pointerType)

      host.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(log).toEqual(['start', 'end', 'click'])
    }
  })

  it('reports presses with activate: false, which leaves the activation to the click', () => {
    let { host, log } = renderLifecycle({ activate: false })

    pointer(host, 'pointerdown')
    expect(log).toEqual(['start'])
    pointer(host, 'pointerup')
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(log).toEqual(['start', 'end', 'click'])
  })

  it('reports presses on hosts that never activate, such as a div', () => {
    let { host, log } = renderLifecycle({}, { tag: 'div', tabIndex: 0 })

    pointer(host, 'pointerdown')
    pointer(host, 'pointerup')
    key(host, 'keydown', 'Enter')
    key(host, 'keyup', 'Enter')
    expect(log.filter((entry) => entry !== 'click')).toEqual(['start', 'end', 'start', 'end'])
  })

  it('cancels a keyboard press on Escape and ignores the keyup', () => {
    let { host, log } = renderLifecycle()

    key(host, 'keydown', 'Enter')
    key(host, 'keydown', 'Escape')
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'cancel'])

    // The next press is unaffected.
    key(host, 'keydown', 'Enter')
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'cancel', 'start', 'end'])
  })

  it('cancels a pointer press on Escape and cancels the click that trails the release', () => {
    let { host, log } = renderLifecycle({}, {})

    pointer(host, 'pointerdown', { pointerType: 'touch' })
    key(document.body, 'keydown', 'Escape')
    pointer(host, 'pointerup', { pointerType: 'touch' })
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(log).toEqual(['start', 'cancel'])
  })

  it('cancels a keyboard press when the host loses focus', () => {
    let { host, log } = renderLifecycle()

    host.focus()
    key(host, 'keydown', 'Enter')
    host.blur()
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'cancel'])
  })

  it('calls onLongPress after the duration and consumes the press', async () => {
    let { host, log, ends } = renderLifecycle({ long: true, longPressDuration: 20 })

    pointer(host, 'pointerdown')
    // A host that can be long pressed activates on release, so the press can still be consumed.
    expect(log).toEqual(['start'])
    await sleep(60)
    expect(log).toEqual(['start', 'long'])

    pointer(host, 'pointerup')
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(log).toEqual(['start', 'long', 'cancel'])
    expect(ends[0].cancelled).toBe(true)

    // The consumed press is over: the next click is handled.
    await nextTask()
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(log).toEqual(['start', 'long', 'cancel', 'click'])
  })

  it('lets a released press that was not long activate on click', async () => {
    let { host, log } = renderLifecycle({ long: true, longPressDuration: 20 })

    mouseClick(host)
    expect(log).toEqual(['start', 'end', 'click'])

    await sleep(60)
    expect(log).toEqual(['start', 'end', 'click'])
  })

  it('defaults the long press duration to 500ms', async () => {
    let { host, log } = renderLifecycle({ long: true })

    pointer(host, 'pointerdown')
    await sleep(400)
    expect(log).toEqual(['start'])
    await sleep(200)
    expect(log).toEqual(['start', 'long'])
    pointer(host, 'pointerup')
  })

  it('consumes a held Enter or Space press as well', async () => {
    let { host, log } = renderLifecycle({ long: true, longPressDuration: 20 })

    key(host, 'keydown', ' ')
    await sleep(60)
    key(host, 'keyup', ' ')
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(log).toEqual(['start', 'long', 'cancel'])
  })

  it('defers Enter on a native host with a long press to its release', () => {
    let { host, log } = renderLifecycle({ long: true })

    expect(key(host, 'keydown', 'Enter').defaultPrevented).toBe(true)
    expect(log).toEqual(['start'])
    // Auto-repeat would click the host again.
    expect(key(host, 'keydown', 'Enter', { repeat: true }).defaultPrevented).toBe(true)
    expect(log).toEqual(['start'])
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'end', 'click'])
  })

  it('clicks like a keyboard activation when Enter is released', () => {
    let { host } = renderLifecycle({ long: true })
    let clicks: MouseEvent[] = []
    host.addEventListener('click', (event) => clicks.push(event))

    key(host, 'keydown', 'Enter')
    key(host, 'keyup', 'Enter')

    expect(clicks.length).toBe(1)
    expect(clicks[0].detail).toBe(0)
    expect(clicks[0].clientX).toBe(0)
    expect(clicks[0].isTrusted).toBe(false)
  })

  it('does not activate a long Enter press', async () => {
    let { host, log } = renderLifecycle({ long: true, longPressDuration: 20 })

    key(host, 'keydown', 'Enter')
    await sleep(60)
    key(host, 'keydown', 'Enter', { repeat: true })
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'long', 'cancel'])
  })

  it('does not activate an Enter press that Escape or blur cancelled', () => {
    let escaped = renderLifecycle({ long: true })
    key(escaped.host, 'keydown', 'Enter')
    key(escaped.host, 'keydown', 'Escape')
    expect(key(escaped.host, 'keydown', 'Enter', { repeat: true }).defaultPrevented).toBe(true)
    key(escaped.host, 'keyup', 'Enter')
    expect(escaped.log).toEqual(['start', 'cancel'])

    let blurred = renderLifecycle({ long: true })
    key(blurred.host, 'keydown', 'Enter')
    blurred.host.dispatchEvent(new FocusEvent('blur'))
    key(blurred.host, 'keyup', 'Enter')
    expect(blurred.log).toEqual(['start', 'cancel'])
  })

  it('does not activate an Enter press on a host that became disabled', () => {
    let { host, log } = renderLifecycle({ long: true })

    key(host, 'keydown', 'Enter')
    host.setAttribute('aria-disabled', 'true')
    key(host, 'keyup', 'Enter')
    expect(log).toEqual(['start', 'end'])
  })

  it('submits a form once, from the pressed submit button, on Enter release', () => {
    let submitters: Array<HTMLElement | null> = []
    let container = renderApp(
      <form
        mix={on('submit', (event) => {
          event.preventDefault()
          submitters.push((event as SubmitEvent).submitter)
        })}
      >
        <button type="submit" id="first">
          First
        </button>
        <button type="submit" id="second" mix={press({ onLongPress() {} })}>
          Second
        </button>
        <input type="submit" id="third" mix={press({ onLongPress() {} })} />
      </form>,
    )
    let second = container.querySelector('#second') as HTMLElement
    let third = container.querySelector('#third') as HTMLElement

    key(second, 'keydown', 'Enter')
    key(second, 'keydown', 'Enter', { repeat: true })
    expect(submitters).toEqual([])
    key(second, 'keyup', 'Enter')
    key(third, 'keydown', 'Enter')
    key(third, 'keyup', 'Enter')
    expect(submitters.map((submitter) => submitter?.id)).toEqual(['second', 'third'])
  })

  it('leaves Enter native without a long press, with a modifier, and where it is not a click', () => {
    let plain = renderLifecycle()
    expect(key(plain.host, 'keydown', 'Enter').defaultPrevented).toBe(false)

    let modified = renderLifecycle({ long: true })
    for (let modifier of ['ctrlKey', 'shiftKey', 'altKey', 'metaKey']) {
      expect(key(modified.host, 'keydown', 'Enter', { [modifier]: true }).defaultPrevented).toBe(
        false,
      )
      key(modified.host, 'keyup', 'Enter')
    }
    expect(modified.log).not.toContain('click')

    let container = renderApp(
      <div>
        <input type="checkbox" id="check" mix={press({ onLongPress() {} })} />
        <div tabIndex={0} id="div" mix={press({ onLongPress() {} })} />
        <input type="text" id="text" mix={press({ onLongPress() {} })} />
      </div>,
    )
    for (let id of ['check', 'div', 'text']) {
      let host = container.querySelector(`#${id}`) as HTMLElement
      expect(key(host, 'keydown', 'Enter').defaultPrevented).toBe(false)
      key(host, 'keyup', 'Enter')
    }
    expect((container.querySelector('#check') as HTMLInputElement).checked).toBe(false)
  })

  it('does not defer Enter from inside the host or for disabled hosts', () => {
    let nested = renderApp(
      <div>
        <button type="button" mix={press({ onLongPress() {} })}>
          <input type="text" id="inner" />
        </button>
        <button type="button" id="off" disabled mix={press({ onLongPress() {} })} />
      </div>,
    )
    for (let id of ['inner', 'off']) {
      let target = nested.querySelector(`#${id}`) as HTMLElement
      expect(key(target, 'keydown', 'Enter').defaultPrevented).toBe(false)
      expect(key(target, 'keydown', 'Enter', { repeat: true }).defaultPrevented).toBe(false)
    }
  })

  it('keeps Space and assistive technology activation as they were', () => {
    let { host, log } = renderLifecycle({ long: true })

    expect(key(host, 'keydown', ' ').defaultPrevented).toBe(false)
    key(host, 'keyup', ' ')
    expect(log).toEqual(['start', 'end'])
    // Without a key press before it, a click is activation as ever.
    host.click()
    expect(log).toEqual(['start', 'end', 'click'])
  })

  it('cancels the press, and its long press, when the pointer leaves the host', async () => {
    let { host, log } = renderLifecycle({ long: true, longPressDuration: 20 })

    pointer(host, 'pointerdown')
    host.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    expect(log).toEqual(['start', 'cancel'])
    await sleep(60)
    pointer(host, 'pointerup')
    host.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(log).toEqual(['start', 'cancel'])
  })

  it('stops the long press timer when the press ends or is cancelled', async () => {
    let { host, log } = renderLifecycle({ long: true, longPressDuration: 20 })

    pointer(host, 'pointerdown')
    pointer(host, 'pointerup')
    key(host, 'keydown', 'Enter')
    key(host, 'keydown', 'Escape')
    key(host, 'keyup', 'Enter')
    await sleep(60)
    expect(log).toEqual(['start', 'end', 'start', 'cancel'])
  })

  it('does nothing once the host is removed', async () => {
    let log: string[] = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    root.render(
      <button
        type="button"
        mix={press({
          longPressDuration: 20,
          onPressStart: () => log.push('start'),
          onPressEnd: () => log.push('end'),
          onLongPress: () => log.push('long'),
        })}
      />,
    )
    root.flush()
    let host = container.querySelector('button') as HTMLButtonElement

    pointer(host, 'pointerdown')
    root.render(null)
    root.flush()
    await sleep(60)
    pointer(document.body, 'pointerup')
    key(document.body, 'keydown', 'Escape')
    expect(log).toEqual(['start'])
  })

  it('uses the callbacks of the latest render', () => {
    let log: string[] = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    let render = (name: string) => {
      root.render(<button type="button" mix={press({ onPressStart: () => log.push(name) })} />)
      root.flush()
    }

    render('first')
    render('second')
    pointer(container.querySelector('button') as HTMLButtonElement, 'pointerdown')
    expect(log).toEqual(['second'])
    roots.push(root)
  })

  it('works with any subset of the callbacks and none', () => {
    let log: string[] = []
    let ended = renderLifecycle({ onPressStart: undefined })
    pointer(ended.host, 'pointerdown')
    pointer(ended.host, 'pointerup')
    expect(ended.log).toEqual(['click', 'end'])

    let bare = renderApp(<button type="button" mix={press()} />).firstElementChild as HTMLElement
    bare.addEventListener('click', () => log.push('click'))
    pointer(bare, 'pointerdown')
    pointer(bare, 'pointerup')
    key(bare, 'keydown', ' ')
    expect(key(bare, 'keydown', ' ').defaultPrevented).toBe(false)
    expect(log).toEqual(['click'])
  })
})
