// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { createRoot, on, type RemixNode } from '@remix-run/component'

import {
  hidePopover,
  isPopoverOpen,
  popoverFadeDuration,
  Popover,
  showPopover,
} from './popover.tsx'
import type { PopoverOpenChangeEvent } from './popover.tsx'

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function mockLayout(element: HTMLElement, rect: { top: number; left: number; width: number; height: number }) {
  Object.defineProperty(element, 'offsetWidth', {
    configurable: true,
    get: () => rect.width,
  })

  Object.defineProperty(element, 'offsetHeight', {
    configurable: true,
    get: () => rect.height,
  })

  element.getBoundingClientRect = () => new DOMRect(rect.left, rect.top, rect.width, rect.height)
}

async function flush() {
  await Promise.resolve()
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Popover', () => {
  it('supports uncontrolled defaultOpen', async () => {
    let { container } = renderApp(
      <>
        <button id="owner" />
        <Popover defaultOpen id="menu" owner="owner">
          Menu
        </Popover>
      </>,
    )

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popover = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popover, { top: 0, left: 0, width: 160, height: 96 })

    await flush()

    expect(isPopoverOpen(popover)).toBe(true)
  })

  it('supports controlled open state', async () => {
    let { container, root } = renderApp(
      <>
        <button id="owner" />
        <Popover id="menu" open owner="owner">
          Menu
        </Popover>
      </>,
    )
    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popover = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popover, { top: 0, left: 0, width: 160, height: 96 })

    await flush()
    root.flush()

    expect(isPopoverOpen(popover)).toBe(true)

    root.render(
      <>
        <button id="owner" />
        <Popover id="menu" open={false} owner="owner">
          Menu
        </Popover>
      </>,
    )
    root.flush()
    await flush()
    await wait(popoverFadeDuration + 20)

    expect(isPopoverOpen(popover)).toBe(false)
  })

  it('anchors itself when opening and dispatches a bubbling open-change event', async () => {
    let captured: PopoverOpenChangeEvent | null = null

    let { container } = renderApp(
      <div
        mix={on(Popover.openChange, (event) => {
          captured = event as PopoverOpenChangeEvent
        })}
      >
        <button id="owner" popovertarget="menu" />
        <Popover id="menu">
          Menu
        </Popover>
      </div>,
    )

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popover = container.querySelector('#menu') as HTMLDivElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popover, { top: 0, left: 0, width: 160, height: 96 })

    showPopover(popover)
    await flush()

    expect(isPopoverOpen(popover)).toBe(true)
    expect(popover.style.top).toBe('68px')
    expect(popover.style.left).toBe('160px')
    expect(captured?.open).toBe(true)

    hidePopover(popover)
    await flush()
    await wait(popoverFadeDuration + 20)

    expect(captured?.open).toBe(false)
  })

  it('closes when focus moves outside the owner and popover', async () => {
    let { container } = renderApp(
      <>
        <button id="owner">Owner</button>
        <Popover defaultOpen id="menu" owner="owner">
          <button id="inside">Inside</button>
        </Popover>
        <button id="outside">Outside</button>
      </>,
    )

    let owner = container.querySelector('#owner') as HTMLButtonElement
    let popover = container.querySelector('#menu') as HTMLDivElement
    let inside = container.querySelector('#inside') as HTMLButtonElement
    let outside = container.querySelector('#outside') as HTMLButtonElement

    mockLayout(owner, { top: 40, left: 200, width: 80, height: 28 })
    mockLayout(popover, { top: 0, left: 0, width: 160, height: 96 })

    await flush()

    expect(isPopoverOpen(popover)).toBe(true)

    inside.focus()
    await flush()
    expect(isPopoverOpen(popover)).toBe(true)

    outside.focus()
    await flush()
    await wait(popoverFadeDuration + 20)
    expect(isPopoverOpen(popover)).toBe(false)
  })
})
