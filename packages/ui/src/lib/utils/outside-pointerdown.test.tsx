// @jsxRuntime classic
// @jsx createElement

import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, createElement, on, type Handle } from '@remix-run/component'

import { onOutsidePointerDown } from './outside-pointerdown.ts'

let roots: ReturnType<typeof createRoot>[] = []

function pointerDown(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, cancelable: true }))
}

function click(target: HTMLElement, detail = 1) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, cancelable: true, detail }))
}

function OutsideCounter(handle: Handle) {
  let outsideCount = 0
  let outsideClickCount = 0

  return ({ active = true }: { active?: boolean }) => (
    <div>
      <div
        id="host"
        mix={active ? onOutsidePointerDown(() => {
          outsideCount++
          void handle.update()
        }) : undefined}
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
      <output id="count">{outsideCount}</output>
      <output id="click-count">{outsideClickCount}</output>
    </div>
  )
}

function createApp(props: { active?: boolean } = {}) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(<OutsideCounter {...props} />)
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

describe('onOutsidePointerDown', () => {
  it('calls the handler when pointerdown happens outside the host', () => {
    let { container, root } = createApp()

    let outside = container.querySelector('#outside') as HTMLElement
    pointerDown(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    expect(count.textContent).toBe('1')
  })

  it('does not call the handler when pointerdown happens inside the host', () => {
    let { container, root } = createApp()

    let inside = container.querySelector('#inside') as HTMLElement
    pointerDown(inside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    expect(count.textContent).toBe('0')
  })

  it('handles repeated outside pointerdowns across updates', () => {
    let { container, root } = createApp()

    let outside = container.querySelector('#outside') as HTMLElement
    pointerDown(outside)
    root.flush()
    pointerDown(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    expect(count.textContent).toBe('2')
  })

  it('suppresses the click that follows an outside pointerdown', () => {
    let { container, root } = createApp()

    let outside = container.querySelector('#outside-click') as HTMLElement
    pointerDown(outside)
    click(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement
    expect(count.textContent).toBe('1')
    expect(clickCount.textContent).toBe('0')
  })

  it('does not suppress clicks when the mixin is not mounted', () => {
    let { container, root } = createApp({ active: false })

    let outside = container.querySelector('#outside-click') as HTMLElement
    pointerDown(outside)
    click(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement
    expect(count.textContent).toBe('0')
    expect(clickCount.textContent).toBe('1')
  })

  it('stops intercepting events after the mixin is unmounted', () => {
    let { container, root } = createApp({ active: true })

    root.render(<OutsideCounter active={false} />)
    root.flush()

    let outside = container.querySelector('#outside-click') as HTMLElement
    pointerDown(outside)
    click(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement
    expect(count.textContent).toBe('0')
    expect(clickCount.textContent).toBe('1')
  })

  it('suppresses the current gesture click even if the mixin unmounts before click', () => {
    let { container, root } = createApp({ active: true })

    let outside = container.querySelector('#outside-click') as HTMLElement
    pointerDown(outside)
    root.render(<OutsideCounter active={false} />)
    root.flush()
    click(outside)
    root.flush()

    let count = container.querySelector('#count') as HTMLOutputElement
    let clickCount = container.querySelector('#click-count') as HTMLOutputElement
    expect(count.textContent).toBe('1')
    expect(clickCount.textContent).toBe('0')
  })
})
