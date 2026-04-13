import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on } from '@remix-run/component'

import { press, type PressEvent } from './press-mixin.ts'

function renderButton(node: JSX.Element) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()

  return {
    button: container.querySelector('button') as HTMLButtonElement,
    root,
  }
}

function dispatchPointer(
  target: EventTarget,
  type: 'pointercancel' | 'pointerdown' | 'pointerleave' | 'pointerup',
  init: {
    altKey?: boolean
    button?: number
    buttons?: number
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    detail?: number
    height?: number
    isPrimary?: boolean
    metaKey?: boolean
    pressure?: number
    pointerType?: string
    shiftKey?: boolean
    width?: number
  } = {},
) {
  let event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    altKey: { configurable: true, value: init.altKey ?? false },
    button: { configurable: true, value: init.button ?? 0 },
    buttons: { configurable: true, value: init.buttons ?? (type === 'pointerdown' ? 1 : 0) },
    clientX: { configurable: true, value: init.clientX ?? 0 },
    clientY: { configurable: true, value: init.clientY ?? 0 },
    ctrlKey: { configurable: true, value: init.ctrlKey ?? false },
    detail: { configurable: true, value: init.detail ?? 0 },
    height: { configurable: true, value: init.height ?? 1 },
    isPrimary: { configurable: true, value: init.isPrimary ?? true },
    metaKey: { configurable: true, value: init.metaKey ?? false },
    pressure: {
      configurable: true,
      value: init.pressure ?? (type === 'pointerdown' ? 0.5 : 0),
    },
    pointerType: { configurable: true, value: init.pointerType ?? 'mouse' },
    shiftKey: { configurable: true, value: init.shiftKey ?? false },
    width: { configurable: true, value: init.width ?? 1 },
  })
  target.dispatchEvent(event)
  return event
}

function dispatchClick(
  target: EventTarget,
  init: {
    altKey?: boolean
    button?: number
    buttons?: number
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    detail?: number
    metaKey?: boolean
    pointerType?: string
    shiftKey?: boolean
  } = {},
) {
  let event = new MouseEvent('click', {
      altKey: init.altKey ?? false,
      bubbles: true,
      button: init.button ?? 0,
      cancelable: true,
      clientX: init.clientX ?? 0,
      clientY: init.clientY ?? 0,
      ctrlKey: init.ctrlKey ?? false,
      detail: init.detail ?? 0,
      metaKey: init.metaKey ?? false,
      shiftKey: init.shiftKey ?? false,
    })

  Object.defineProperties(event, {
    buttons: { configurable: true, value: init.buttons ?? 0 },
    pointerType: { configurable: true, value: init.pointerType },
  })

  target.dispatchEvent(event)
  return event
}

function dispatchMouse(
  target: EventTarget,
  type: 'mousedown' | 'mouseup',
  init: {
    altKey?: boolean
    button?: number
    buttons?: number
    clientX?: number
    clientY?: number
    ctrlKey?: boolean
    detail?: number
    metaKey?: boolean
    shiftKey?: boolean
  } = {},
) {
  let event = new MouseEvent(type, {
    altKey: init.altKey ?? false,
    bubbles: true,
    button: init.button ?? 0,
    buttons: init.buttons ?? (type === 'mousedown' ? 1 : 0),
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    ctrlKey: init.ctrlKey ?? false,
    detail: init.detail ?? 1,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
  })
  target.dispatchEvent(event)
  return event
}

function dispatchKey(
  target: EventTarget,
  type: 'keydown' | 'keyup',
  key: ' ' | 'Enter' | 'Escape',
  init: {
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
    repeat?: boolean
    shiftKey?: boolean
  } = {},
) {
  let event = new KeyboardEvent(type, {
    altKey: init.altKey ?? false,
    bubbles: true,
    cancelable: true,
    ctrlKey: init.ctrlKey ?? false,
    key,
    metaKey: init.metaKey ?? false,
    repeat: init.repeat ?? false,
    shiftKey: init.shiftKey ?? false,
  })
  target.dispatchEvent(event)
  return event
}

async function settleClick() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('press', () => {
  it('exposes press.start as an alias of press.down', () => {
    expect(press.start).toBe(press.down)
  })

  it('dispatches pointer lifecycle events on the pressed host', () => {
    let events: Array<{ clientX: number; clientY: number; pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'down',
            })
          }),
          on(press.up, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'up',
            })
          }),
          on(press.end, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'end',
            })
          }),
          on(press.press, (event) => {
            events.push({
              clientX: event.clientX,
              clientY: event.clientY,
              pointerType: event.pointerType,
              type: 'press',
            })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown', { clientX: 11, clientY: 22, shiftKey: true })
    dispatchPointer(button, 'pointerup', { clientX: 33, clientY: 44, shiftKey: true })
    root.flush()

    expect(events).toEqual([
      { clientX: 11, clientY: 22, pointerType: 'mouse', type: 'down' },
      { clientX: 33, clientY: 44, pointerType: 'mouse', type: 'up' },
      { clientX: 33, clientY: 44, pointerType: 'mouse', type: 'end' },
      { clientX: 33, clientY: 44, pointerType: 'mouse', type: 'press' },
    ])
  })

  it('propagates prevented press.down to the original pointerdown event', () => {
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            event.preventDefault()
          }),
        ]}
      >
        Press me
      </button>,
    )

    let pointerDown = dispatchPointer(button, 'pointerdown')

    expect(pointerDown.defaultPrevented).toBe(true)

    dispatchPointer(button, 'pointerup')
    root.flush()
  })

  it('dispatches keyboard lifecycle events and suppresses the native follow-up click', () => {
    let events: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push({ pointerType: event.pointerType, type: 'down' })
          }),
          on(press.up, (event) => {
            events.push({ pointerType: event.pointerType, type: 'up' })
          }),
          on(press.end, (event) => {
            events.push({ pointerType: event.pointerType, type: 'end' })
          }),
          on(press.press, (event) => {
            events.push({ pointerType: event.pointerType, type: 'press' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchKey(button, 'keydown', 'Enter')
    dispatchKey(button, 'keyup', 'Enter')
    dispatchClick(button)
    root.flush()

    expect(events).toEqual([
      { pointerType: 'keyboard', type: 'down' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
  })

  it('does not treat text input keyboard entry as a press', () => {
    let presses = 0
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    root.render(
      <input
        type="text"
        mix={[
          press(),
          on(press.press, () => {
            presses++
          }),
        ]}
      />,
    )
    root.flush()

    let input = container.querySelector('input') as HTMLInputElement
    let spaceKeyDown = dispatchKey(input, 'keydown', ' ')
    dispatchKey(input, 'keyup', ' ')
    let enterKeyDown = dispatchKey(input, 'keydown', 'Enter')
    dispatchKey(input, 'keyup', 'Enter')
    root.flush()

    expect(spaceKeyDown.defaultPrevented).toBe(false)
    expect(enterKeyDown.defaultPrevented).toBe(false)
    expect(presses).toBe(0)
  })

  it('ignores repeated keydown events during a keyboard press', () => {
    let events: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push({ pointerType: event.pointerType, type: 'down' })
          }),
          on(press.up, (event) => {
            events.push({ pointerType: event.pointerType, type: 'up' })
          }),
          on(press.end, (event) => {
            events.push({ pointerType: event.pointerType, type: 'end' })
          }),
          on(press.press, (event) => {
            events.push({ pointerType: event.pointerType, type: 'press' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchKey(button, 'keydown', 'Enter')
    dispatchKey(button, 'keydown', 'Enter', { repeat: true })
    dispatchKey(button, 'keydown', 'Enter', { repeat: true })
    dispatchKey(button, 'keyup', 'Enter')
    dispatchClick(button)
    root.flush()

    expect(events).toEqual([
      { pointerType: 'keyboard', type: 'down' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
  })

  it('commits a keyboard press when focus moves before keyup', () => {
    let events: Array<{ pointerType: string; type: string }> = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    root.render(
      <div>
        <button
          id="first"
          type="button"
          mix={[
            press(),
            on(press.down, (event) => {
              events.push({ pointerType: event.pointerType, type: 'down' })
              let second = container.querySelector('#second') as HTMLButtonElement
              second.focus()
            }),
            on(press.up, (event) => {
              events.push({ pointerType: event.pointerType, type: 'up' })
            }),
            on(press.end, (event) => {
              events.push({ pointerType: event.pointerType, type: 'end' })
            }),
            on(press.press, (event) => {
              events.push({ pointerType: event.pointerType, type: 'press' })
            }),
          ]}
        >
          First
        </button>
        <button id="second" type="button">
          Second
        </button>
      </div>,
    )
    root.flush()

    let first = container.querySelector('#first') as HTMLButtonElement
    let second = container.querySelector('#second') as HTMLButtonElement

    dispatchKey(first, 'keydown', 'Enter')
    dispatchKey(second, 'keyup', 'Enter')
    dispatchClick(first)
    root.flush()

    expect(events).toEqual([
      { pointerType: 'keyboard', type: 'down' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
  })

  it('normalizes Enter and Space to the same keyboard path without leaking native clicks', () => {
    let enterEvents: Array<{ pointerType: string; type: string }> = []
    let spaceEvents: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'down' })
          }),
          on(press.up, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'up' })
          }),
          on(press.end, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'end' })
          }),
          on(press.press, (event) => {
            let targetEvents = event.currentTarget.dataset.sequence === 'space' ? spaceEvents : enterEvents
            targetEvents.push({ pointerType: event.pointerType, type: 'press' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    button.dataset.sequence = 'enter'
    let enterKeyDown = dispatchKey(button, 'keydown', 'Enter')
    dispatchKey(button, 'keyup', 'Enter')
    root.flush()

    button.dataset.sequence = 'space'
    let spaceKeyDown = dispatchKey(button, 'keydown', ' ')
    dispatchKey(button, 'keyup', ' ')
    root.flush()

    expect(enterKeyDown.defaultPrevented).toBe(true)
    expect(spaceKeyDown.defaultPrevented).toBe(true)
    expect(enterEvents).toEqual([
      { pointerType: 'keyboard', type: 'down' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
    expect(spaceEvents).toEqual([
      { pointerType: 'keyboard', type: 'down' },
      { pointerType: 'keyboard', type: 'up' },
      { pointerType: 'keyboard', type: 'end' },
      { pointerType: 'keyboard', type: 'press' },
    ])
  })

  it('treats click without a prior pointer sequence as a virtual press', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchClick(button, { clientX: 8, clientY: 13 })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'virtual')).toBe(true)
    expect(events[0]?.isVirtual).toBe(true)
    expect(events[3]?.clientX).toBe(8)
    expect(events[3]?.clientY).toBe(13)
  })

  it('treats zero-size pointer sequences followed by click as a virtual press', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown', {
      clientX: 8,
      clientY: 13,
      height: 0,
      pointerType: 'mouse',
      pressure: 0,
      width: 0,
    })
    dispatchPointer(button, 'pointerup', {
      clientX: 8,
      clientY: 13,
      height: 0,
      pointerType: 'mouse',
      pressure: 0,
      width: 0,
    })
    dispatchClick(button, { clientX: 8, clientY: 13, detail: 0 })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'virtual')).toBe(true)
  })

  it('treats zero-size pointer sequences followed by a mouse-like click as a virtual press', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown', {
      clientX: 8,
      clientY: 13,
      height: 0,
      pointerType: 'mouse',
      pressure: 0,
      width: 0,
    })
    dispatchPointer(button, 'pointerup', {
      clientX: 8,
      clientY: 13,
      height: 0,
      pointerType: 'mouse',
      pressure: 0,
      width: 0,
    })
    dispatchClick(button, {
      clientX: 8,
      clientY: 13,
      detail: 1,
      pointerType: 'mouse',
    })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'virtual')).toBe(true)
  })

  it('treats TalkBack-style clicks as virtual presses on Android', () => {
    let userAgent = vi.spyOn(window.navigator, 'userAgent', 'get')
    userAgent.mockReturnValue('Mozilla/5.0 (Linux; Android 14)')

    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchClick(button, {
      buttons: 1,
      clientX: 8,
      clientY: 13,
      detail: 1,
      pointerType: 'mouse',
    })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'virtual')).toBe(true)
  })

  it('keeps non-virtual click-only presses as mouse presses', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchClick(button, { clientX: 8, clientY: 13, detail: 1 })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'mouse')).toBe(true)
  })

  it('treats focused pointer-only mouse press commits as virtual presses', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    button.focus()
    dispatchPointer(button, 'pointerdown', { clientX: 8, clientY: 13, pointerType: 'mouse' })
    dispatchPointer(button, 'pointerup', { clientX: 8, clientY: 13, pointerType: 'mouse' })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events[0]?.pointerType).toBe('mouse')
    expect(events.slice(1).every((event) => event.pointerType === 'virtual')).toBe(true)
  })

  it('keeps focused pointer presses with a real mousedown as mouse presses', () => {
    let events: PressEvent[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push(event)
          }),
          on(press.up, (event) => {
            events.push(event)
          }),
          on(press.end, (event) => {
            events.push(event)
          }),
          on(press.press, (event) => {
            events.push(event)
          }),
        ]}
      >
        Press me
      </button>,
    )

    button.focus()
    dispatchPointer(button, 'pointerdown', { clientX: 8, clientY: 13, pointerType: 'mouse' })
    dispatchMouse(button, 'mousedown', { clientX: 8, clientY: 13 })
    dispatchPointer(button, 'pointerup', { clientX: 8, clientY: 13, pointerType: 'mouse' })
    root.flush()

    expect(events.map((event) => event.type)).toEqual([
      press.down,
      press.up,
      press.end,
      press.press,
    ])
    expect(events.every((event) => event.pointerType === 'mouse')).toBe(true)
  })

  it('suppresses the click that follows a completed pointer press', async () => {
    let presses = 0
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.press, () => {
            presses++
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    dispatchPointer(button, 'pointerup')
    await settleClick()
    dispatchClick(button, { detail: 1 })
    root.flush()

    expect(presses).toBe(1)
  })

  it('dispatches up and press on the release target when pointerup lands on a different pressable', () => {
    let events: Array<{ target: string; type: string }> = []
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    function PressButton() {
      return (props: { id: string }) => (
        <button
          id={props.id}
          type="button"
          mix={[
            press(),
            on(press.down, (event) => {
              events.push({ target: (event.currentTarget as HTMLElement).id, type: 'down' })
            }),
            on(press.up, (event) => {
              events.push({ target: (event.currentTarget as HTMLElement).id, type: 'up' })
            }),
            on(press.end, (event) => {
              events.push({ target: (event.currentTarget as HTMLElement).id, type: 'end' })
            }),
            on(press.press, (event) => {
              events.push({ target: (event.currentTarget as HTMLElement).id, type: 'press' })
            }),
          ]}
        >
          {props.id}
        </button>
      )
    }

    root.render(
      <div>
        <PressButton id="first" />
        <PressButton id="second" />
      </div>,
    )
    root.flush()

    let first = container.querySelector('#first') as HTMLButtonElement
    let second = container.querySelector('#second') as HTMLButtonElement

    dispatchPointer(first, 'pointerdown')
    dispatchPointer(second, 'pointerup')
    dispatchClick(second, { detail: 1 })
    root.flush()

    expect(events).toEqual([
      { target: 'first', type: 'down' },
      { target: 'second', type: 'up' },
      { target: 'first', type: 'end' },
      { target: 'second', type: 'press' },
    ])
  })

  it('treats duplicate press mixins as one shared handle capability', () => {
    let presses = 0
    let container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)

    function render(pressCount: 0 | 1 | 2) {
      root.render(
        <button
          type="button"
          mix={[
            pressCount >= 1 ? press() : undefined,
            pressCount >= 2 ? press() : undefined,
            on(press.press, () => {
              presses++
            }),
          ]}
        >
          Press me
        </button>,
      )
      root.flush()
      return container.querySelector('button') as HTMLButtonElement
    }

    let button = render(2)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(1)

    button = render(1)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(2)

    button = render(0)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(2)

    button = render(1)
    dispatchClick(button)
    root.flush()
    expect(presses).toBe(3)
  })

  it('dispatches cancel and end when pointerup happens outside the host', () => {
    let events: Array<{ pointerType: string; type: string }> = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.down, (event) => {
            events.push({ pointerType: event.pointerType, type: 'down' })
          }),
          on(press.cancel, (event) => {
            events.push({ pointerType: event.pointerType, type: 'cancel' })
          }),
          on(press.end, (event) => {
            events.push({ pointerType: event.pointerType, type: 'end' })
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    dispatchPointer(button.ownerDocument, 'pointerup', { clientX: 40, clientY: 50 })
    root.flush()

    expect(events).toEqual([
      { pointerType: 'mouse', type: 'down' },
      { pointerType: 'mouse', type: 'cancel' },
      { pointerType: 'mouse', type: 'end' },
    ])
  })

  it('suppresses press after a prevented long press but still dispatches up and end', () => {
    vi.useFakeTimers()

    let events: string[] = []
    let { button, root } = renderButton(
      <button
        type="button"
        mix={[
          press(),
          on(press.long, (event) => {
            events.push('long')
            event.preventDefault()
          }),
          on(press.up, () => {
            events.push('up')
          }),
          on(press.end, () => {
            events.push('end')
          }),
          on(press.press, () => {
            events.push('press')
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(button, 'pointerdown')
    vi.advanceTimersByTime(501)
    dispatchPointer(button, 'pointerup')
    root.flush()

    expect(events).toEqual(['long', 'up', 'end'])
  })

  it('ignores press interactions for disabled hosts', () => {
    let disabledCount = 0
    let ariaDisabledCount = 0
    let disabledApp = renderButton(
      <button
        disabled
        type="button"
        mix={[
          press(),
          on(press.press, () => {
            disabledCount++
          }),
        ]}
      >
        Press me
      </button>,
    )
    let ariaDisabledApp = renderButton(
      <button
        aria-disabled="true"
        type="button"
        mix={[
          press(),
          on(press.press, () => {
            ariaDisabledCount++
          }),
        ]}
      >
        Press me
      </button>,
    )

    dispatchPointer(disabledApp.button, 'pointerdown')
    dispatchPointer(disabledApp.button, 'pointerup')
    dispatchClick(disabledApp.button)
    dispatchKey(disabledApp.button, 'keydown', 'Enter')
    dispatchKey(disabledApp.button, 'keyup', 'Enter')
    disabledApp.root.flush()

    dispatchPointer(ariaDisabledApp.button, 'pointerdown')
    dispatchPointer(ariaDisabledApp.button, 'pointerup')
    dispatchClick(ariaDisabledApp.button)
    dispatchKey(ariaDisabledApp.button, 'keydown', 'Enter')
    dispatchKey(ariaDisabledApp.button, 'keyup', 'Enter')
    ariaDisabledApp.root.flush()

    expect(disabledCount).toBe(0)
    expect(ariaDisabledCount).toBe(0)
  })
})
