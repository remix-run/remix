import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import * as popover from './popover.ts'
import type { PopoverHideRequest } from './popover.ts'

let roots: ReturnType<typeof createRoot>[] = []

type RenderPopoverOptions = {
  closeOnAnchorClick?: boolean
  closeOnHide?: boolean
  onHide?: (request?: PopoverHideRequest) => void
  restoreFocusOnHide?: boolean
  withHideFocus?: boolean
  withShowFocus?: boolean
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

function renderPopover(options: RenderPopoverOptions = {}) {
  return renderApp(<PopoverHarness setup={options} />)
}

function isPopoverOpen(element: HTMLElement) {
  return element.matches(':popover-open')
}

function mockLayout(
  element: HTMLElement,
  rect: { top: number; left: number; width: number; height: number },
) {
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

function getById<elementType extends HTMLElement>(container: HTMLElement, id: string) {
  return container.querySelector(`#${id}`) as elementType
}

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
}

function key(target: HTMLElement, keyValue: string) {
  let event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: keyValue,
  })
  target.dispatchEvent(event)
  return event
}

async function settle(root: ReturnType<typeof createRoot>) {
  root.flush()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve()
      })
    })
  })
  await Promise.resolve()
  root.flush()
}

function PopoverHarness(handle: Handle, setup: RenderPopoverOptions) {
  let open = false

  function openPopover() {
    open = true
    void handle.update()
  }

  function closePopover() {
    open = false
    void handle.update()
  }

  return () => (
    <popover.Context>
      <button
        id="anchor"
        mix={[
          popover.anchor({ placement: 'bottom-start' }),
          setup.withHideFocus ? popover.focusOnHide() : null,
          on<HTMLButtonElement>('click', openPopover),
        ]}
      >
        Anchor
      </button>

      <div
        id="surface"
        mix={popover.surface({
          closeOnAnchorClick: setup.closeOnAnchorClick,
          open,
          onHide(request) {
            setup.onHide?.(request)

            if (setup.closeOnHide === false) {
              return
            }

            closePopover()
          },
          restoreFocusOnHide: setup.restoreFocusOnHide,
        })}
      >
        {setup.withShowFocus ? (
          <button id="show-focus" mix={popover.focusOnShow()}>
            Focus on show
          </button>
        ) : null}

        <button id="inside-close" mix={on('click', closePopover)}>
          Close from inside
        </button>

        <button id="inside">Inside</button>
      </div>

      <button id="outside">Outside</button>
    </popover.Context>
  )
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('popover', () => {
  it('renders a manual popover surface and responds to controlled open state changes', async () => {
    let showPopover = vi.spyOn(HTMLElement.prototype, 'showPopover')
    let hidePopover = vi.spyOn(HTMLElement.prototype, 'hidePopover')
    let { container, root } = renderPopover()

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let insideClose = getById<HTMLButtonElement>(container, 'inside-close')
    let surface = getById<HTMLDivElement>(container, 'surface')

    expect(surface.getAttribute('popover')).toBe('manual')
    expect(showPopover).not.toHaveBeenCalled()
    expect(hidePopover).not.toHaveBeenCalled()

    click(anchor)
    await settle(root)

    expect(showPopover).toHaveBeenCalledOnce()
    expect(isPopoverOpen(surface)).toBe(true)

    click(insideClose)
    await settle(root)

    expect(hidePopover).toHaveBeenCalledOnce()
    expect(isPopoverOpen(surface)).toBe(false)
  })

  it('anchors on open and releases scroll locking on close', async () => {
    let { container, root } = renderPopover()

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let insideClose = getById<HTMLButtonElement>(container, 'inside-close')
    let surface = getById<HTMLDivElement>(container, 'surface')

    mockLayout(anchor, { top: 40, left: 100, width: 80, height: 30 })
    mockLayout(surface, { top: 0, left: 0, width: 160, height: 96 })

    click(anchor)
    await settle(root)

    expect(surface.style.position).toBe('fixed')
    expect(surface.style.top).toBe('70px')
    expect(surface.style.left).toBe('100px')
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.overflow).toBe('hidden')

    click(insideClose)
    await settle(root)

    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('')
  })

  it('moves focus to the registered show target when opening', async () => {
    let { container, root } = renderPopover({ withShowFocus: true })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let showFocus = getById<HTMLButtonElement>(container, 'show-focus')

    anchor.focus()
    click(anchor)
    await settle(root)

    expect(document.activeElement).toBe(showFocus)
  })

  it('calls onHide on Escape and focuses the registered hide target after closing', async () => {
    let onHide = vi.fn<(request?: PopoverHideRequest) => void>()
    let { container, root } = renderPopover({
      onHide,
      withHideFocus: true,
      withShowFocus: true,
    })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let inside = getById<HTMLButtonElement>(container, 'inside')
    let surface = getById<HTMLDivElement>(container, 'surface')

    click(anchor)
    await settle(root)
    inside.focus()

    let event = key(inside, 'Escape')
    await settle(root)

    expect(event.defaultPrevented).toBe(true)
    expect(onHide).toHaveBeenCalledOnce()
    expect(onHide).toHaveBeenCalledWith({ reason: 'escape-key' })
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(anchor)
  })

  it('calls onHide on outside click and focuses the registered hide target', async () => {
    let onHide = vi.fn<(request?: PopoverHideRequest) => void>()
    let { container, root } = renderPopover({
      onHide,
      withHideFocus: true,
      withShowFocus: true,
    })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let outside = getById<HTMLButtonElement>(container, 'outside')
    let surface = getById<HTMLDivElement>(container, 'surface')

    click(anchor)
    await settle(root)

    click(outside)
    await settle(root)

    expect(onHide).toHaveBeenCalledOnce()
    expect(onHide).toHaveBeenCalledWith({ reason: 'outside-click', target: outside })
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(anchor)
  })

  it('does not close when clicking inside the surface', async () => {
    let onHide = vi.fn()
    let { container, root } = renderPopover({ onHide })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let inside = getById<HTMLButtonElement>(container, 'inside')
    let surface = getById<HTMLDivElement>(container, 'surface')

    click(anchor)
    await settle(root)

    click(inside)
    await settle(root)

    expect(onHide).not.toHaveBeenCalled()
    expect(isPopoverOpen(surface)).toBe(true)
  })

  it('can ignore anchor clicks while open when closeOnAnchorClick is false', async () => {
    let onHide = vi.fn()
    let { container, root } = renderPopover({
      closeOnAnchorClick: false,
      onHide,
    })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let surface = getById<HTMLDivElement>(container, 'surface')

    click(anchor)
    await settle(root)
    click(anchor)
    await settle(root)

    expect(onHide).not.toHaveBeenCalled()
    expect(isPopoverOpen(surface)).toBe(true)
  })

  it('stays open until the parent updates open to false after onHide runs', async () => {
    let hidePopover = vi.spyOn(HTMLElement.prototype, 'hidePopover')
    let onHide = vi.fn()
    let { container, root } = renderPopover({
      closeOnHide: false,
      onHide,
      withShowFocus: true,
    })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let inside = getById<HTMLButtonElement>(container, 'inside')
    let surface = getById<HTMLDivElement>(container, 'surface')

    click(anchor)
    await settle(root)
    inside.focus()

    key(inside, 'Escape')
    await settle(root)

    expect(onHide).toHaveBeenCalledOnce()
    expect(hidePopover).not.toHaveBeenCalled()
    expect(isPopoverOpen(surface)).toBe(true)
  })

  it('focuses the registered hide target immediately when closing without a hide transition', async () => {
    let { container, root } = renderPopover({
      withHideFocus: true,
      withShowFocus: true,
    })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let inside = getById<HTMLButtonElement>(container, 'inside')
    let insideClose = getById<HTMLButtonElement>(container, 'inside-close')

    click(anchor)
    await settle(root)
    inside.focus()

    click(insideClose)
    await settle(root)

    expect(document.activeElement).toBe(anchor)
  })

  it('can skip restoring focus on hide', async () => {
    let { container, root } = renderPopover({
      restoreFocusOnHide: false,
      withHideFocus: true,
      withShowFocus: true,
    })

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let inside = getById<HTMLButtonElement>(container, 'inside')
    let insideClose = getById<HTMLButtonElement>(container, 'inside-close')

    click(anchor)
    await settle(root)
    inside.focus()

    click(insideClose)
    await settle(root)

    expect(document.activeElement).not.toBe(anchor)
  })
})
