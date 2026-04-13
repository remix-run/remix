import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, on, type Handle } from '@remix-run/component'

import { onOutsidePress, type OutsidePressEvent } from './outside-press-mixin.ts'

let roots: ReturnType<typeof createRoot>[] = []

function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown',
  init: {
    button?: number
    isPrimary?: boolean
  } = {},
) {
  let event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    button: { configurable: true, value: init.button ?? 0 },
    isPrimary: { configurable: true, value: init.isPrimary ?? true },
  })
  target.dispatchEvent(event)
}

function dispatchClick(
  target: EventTarget,
  init: {
    button?: number
    detail?: number
  } = {},
) {
  target.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      button: init.button ?? 0,
      cancelable: true,
      detail: init.detail ?? 1,
    }),
  )
}

function OutsideCounter(handle: Handle) {
  let outsideEvents: string[] = []
  let outsideClickCount = 0

  function handleOutsidePress(event: OutsidePressEvent) {
    outsideEvents.push(event.type)
    void handle.update()
  }

  return ({ active = true, mixCount = 1 }: { active?: boolean; mixCount?: 0 | 1 | 2 }) => (
    <div>
      <div
        id="host"
        mix={[
          active && mixCount >= 1 ? onOutsidePress(handleOutsidePress) : undefined,
          active && mixCount >= 2 ? onOutsidePress(handleOutsidePress) : undefined,
        ]}
      >
        <button id="inside" type="button">
          Inside
        </button>
      </div>
      <button id="outside" type="button">
        Outside
      </button>
      <button
        id="outside-click"
        type="button"
        mix={on('click', () => {
          outsideClickCount++
          void handle.update()
        })}
      >
        Outside Click
      </button>
      <output id="event-count">{outsideEvents.length}</output>
      <output id="event-types">{outsideEvents.join(',')}</output>
      <output id="click-count">{outsideClickCount}</output>
    </div>
  )
}

function renderCounter(props: { active?: boolean; mixCount?: 0 | 1 | 2 } = {}) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(<OutsideCounter {...props} />)
  root.flush()
  roots.push(root)
  return { container, root }
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('onOutsidePress', () => {
  it('dispatches once from outside pointerdown and suppresses the paired click while mounted', () => {
    let { container, root } = renderCounter()

    let outside = container.querySelector('#outside-click') as HTMLButtonElement
    dispatchPointer(outside, 'pointerdown')
    dispatchClick(outside)
    root.flush()

    let eventCount = container.querySelector('#event-count') as HTMLOutputElement
    let eventTypes = container.querySelector('#event-types') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement

    expect(eventCount.textContent).toBe('1')
    expect(eventTypes.textContent).toBe('pointerdown')
    expect(clickCount.textContent).toBe('0')
  })

  it('suppresses a click outside when the pointer gesture started inside', () => {
    let { container, root } = renderCounter()

    let inside = container.querySelector('#inside') as HTMLButtonElement
    let outside = container.querySelector('#outside-click') as HTMLButtonElement
    dispatchPointer(inside, 'pointerdown')
    dispatchClick(outside)
    root.flush()

    let eventCount = container.querySelector('#event-count') as HTMLOutputElement
    let eventTypes = container.querySelector('#event-types') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement

    expect(eventCount.textContent).toBe('0')
    expect(eventTypes.textContent).toBe('')
    expect(clickCount.textContent).toBe('0')
  })

  it('treats outside click without a prior pointerdown as the virtual path', () => {
    let { container, root } = renderCounter()

    let outside = container.querySelector('#outside-click') as HTMLButtonElement
    dispatchClick(outside)
    root.flush()

    let eventCount = container.querySelector('#event-count') as HTMLOutputElement
    let eventTypes = container.querySelector('#event-types') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement

    expect(eventCount.textContent).toBe('1')
    expect(eventTypes.textContent).toBe('click')
    expect(clickCount.textContent).toBe('1')
  })

  it('stops intercepting events after the mixin is unmounted', () => {
    let { container, root } = renderCounter({ active: false })

    let outside = container.querySelector('#outside-click') as HTMLButtonElement
    dispatchPointer(outside, 'pointerdown')
    dispatchClick(outside)
    root.flush()

    let eventCount = container.querySelector('#event-count') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement

    expect(eventCount.textContent).toBe('0')
    expect(clickCount.textContent).toBe('1')
  })
})
