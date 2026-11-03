import { expect } from '@remix-run/assert'
import { afterEach, describe, it, mock } from '@remix-run/test'

import { createRoot, on, type Handle, type RemixNode } from '@remix-run/component'

import * as popover from './popover.ts'
import * as menu from './menu.tsx'
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
  return renderApp(<PopoverHarness {...options} />)
}

function isPopoverOpen(element: HTMLElement) {
  return element.matches('[data-open]')
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

function PopoverHarness(handle: Handle<RenderPopoverOptions>) {
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
          handle.props.withHideFocus ? popover.focusOnHide() : null,
          on<HTMLButtonElement>('click', openPopover),
        ]}
      >
        Anchor
      </button>

      <div
        id="surface"
        mix={popover.surface({
          closeOnAnchorClick: handle.props.closeOnAnchorClick,
          open,
          onHide(request) {
            handle.props.onHide?.(request)

            if (handle.props.closeOnHide === false) {
              return
            }

            closePopover()
          },
          restoreFocusOnHide: handle.props.restoreFocusOnHide,
        })}
      >
        {handle.props.withShowFocus ? (
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

function NestedPopovers(handle: Handle<{ onChildHide?(request?: PopoverHideRequest): void }>) {
  let parentOpen = false
  let childOpen = false

  return () => (
    <popover.Context>
      <button id="parent-anchor" mix={popover.anchor({ placement: 'bottom-start' })} />
      <button
        id="open-parent"
        mix={on('click', () => {
          parentOpen = true
          void handle.update()
        })}
      />
      <div
        id="parent-surface"
        mix={popover.surface({
          open: parentOpen,
          onHide() {
            parentOpen = false
            void handle.update()
          },
        })}
      >
        <popover.Context>
          <button
            id="child-anchor"
            mix={[
              popover.anchor({ placement: 'bottom-start' }),
              on('click', () => {
                childOpen = true
                void handle.update()
              }),
            ]}
          />
          <div
            id="child-surface"
            mix={popover.surface({
              open: childOpen,
              onHide(request) {
                handle.props.onChildHide?.(request)
                childOpen = false
                void handle.update()
              },
            })}
          >
            <button id="child-inside">Child</button>
            <button
              id="close-parent"
              mix={on('click', () => {
                parentOpen = false
                void handle.update()
              })}
            >
              Close parent
            </button>
          </div>
        </popover.Context>
      </div>
      <button id="outside">Outside</button>
    </popover.Context>
  )
}

function PopoverInMenu(handle: Handle) {
  let open = false

  return () => (
    <menu.Context label="Actions">
      <button id="menu-trigger" mix={menu.trigger()}>
        Actions
      </button>
      <div id="menu-surface" mix={menu.popover()}>
        <div id="menu-list" mix={menu.list()}>
          <button id="rename-item" mix={menu.item({ name: 'rename', label: 'Rename' })}>
            Rename
          </button>
          <button id="save-item" mix={menu.item({ name: 'save', label: 'Save' })}>
            Save
          </button>
          <popover.Context>
            <button
              id="popover-anchor"
              mix={[
                popover.anchor({ placement: 'bottom-start' }),
                on('click', () => {
                  open = true
                  void handle.update()
                }),
              ]}
            >
              Edit
            </button>
            <div
              id="popover-surface"
              mix={popover.surface({
                open,
                onHide() {
                  open = false
                  void handle.update()
                },
              })}
            >
              <input id="popover-input" />
            </div>
          </popover.Context>
        </div>
      </div>
    </menu.Context>
  )
}

afterEach(() => {
  for (let root of roots) {
    root.render(null)
    root.flush()
  }

  roots = []
  document.body.innerHTML = ''
})

describe('popover', () => {
  it('retains its layer during finite exit motion and ignores a superseded close', async () => {
    let { container, root } = renderPopover({ closeOnAnchorClick: false })
    let anchor = getById(container, 'anchor')
    let surface = getById(container, 'surface')
    click(anchor)
    await settle(root)
    let animation = surface.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 10000 })
    animation.pause()
    click(getById(container, 'inside-close'))
    await settle(root)
    expect(surface.hasAttribute('data-open')).toBe(true)
    expect(surface.getAttribute('data-state')).toBe('closed')
    expect(document.documentElement.style.overflow).toBe('hidden')
    click(anchor)
    await settle(root)
    animation.finish()
    await settle(root)
    expect(surface.hasAttribute('data-open')).toBe(true)
    click(getById(container, 'inside-close'))
    await settle(root)
    expect(surface.hasAttribute('data-open')).toBe(false)
  })

  it('renders without a native popover or top-layer placement', async () => {
    let { container, root } = renderPopover()
    click(getById(container, 'anchor'))
    await settle(root)
    let surface = getById(container, 'surface')
    expect(surface.hasAttribute('popover')).toBe(false)
    expect(surface.matches(':popover-open')).toBe(false)
    expect(surface.getClientRects().length > 0).toBe(true)
  })

  it('responds to controlled open state without calling native popover methods', async (t) => {
    let showPopover = t.mock.method(HTMLElement.prototype, 'showPopover')
    let hidePopover = t.mock.method(HTMLElement.prototype, 'hidePopover')
    let { container, root } = renderPopover()

    let anchor = getById<HTMLButtonElement>(container, 'anchor')
    let insideClose = getById<HTMLButtonElement>(container, 'inside-close')
    let surface = getById<HTMLDivElement>(container, 'surface')

    expect(surface.getAttribute('popover')).toBe(null)
    expect(showPopover).not.toHaveBeenCalled()
    expect(hidePopover).not.toHaveBeenCalled()

    click(anchor)
    await settle(root)

    expect(showPopover).not.toHaveBeenCalled()
    expect(isPopoverOpen(surface)).toBe(true)

    click(insideClose)
    await settle(root)

    expect(hidePopover).not.toHaveBeenCalled()
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
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('')
    expect(document.body.style.overflow).toBe('')

    click(insideClose)
    await settle(root)

    expect(document.documentElement.style.overflow).toBe('')
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
    let onHide = mock.fn<(request?: PopoverHideRequest) => void>()
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
    expect(onHide).toHaveBeenCalledTimes(1)
    expect(onHide).toHaveBeenCalledWith({ reason: 'escape-key' })
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(anchor)
  })

  it('calls onHide on outside click and focuses the registered hide target', async () => {
    let onHide = mock.fn<(request?: PopoverHideRequest) => void>()
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

    expect(onHide).toHaveBeenCalledTimes(1)
    expect(onHide).toHaveBeenCalledWith({ reason: 'outside-click', target: outside })
    expect(isPopoverOpen(surface)).toBe(false)
    expect(document.activeElement).toBe(anchor)
  })

  it('does not close when clicking inside the surface', async () => {
    let onHide = mock.fn()
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
    let onHide = mock.fn()
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

  it('stays open until the parent updates open to false after onHide runs', async (t) => {
    let hidePopover = t.mock.method(HTMLElement.prototype, 'hidePopover')
    let onHide = mock.fn()
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

    expect(onHide).toHaveBeenCalledTimes(1)
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

  it('closes only the nested popover on Escape', async () => {
    let { container, root } = renderApp(<NestedPopovers />)
    let parent = getById<HTMLDivElement>(container, 'parent-surface')
    let child = getById<HTMLDivElement>(container, 'child-surface')

    click(getById(container, 'open-parent'))
    await settle(root)
    click(getById(container, 'child-anchor'))
    await settle(root)

    key(getById(container, 'child-inside'), 'Escape')
    await settle(root)

    expect(isPopoverOpen(child)).toBe(false)
    expect(isPopoverOpen(parent)).toBe(true)

    key(parent, 'Escape')
    await settle(root)
    expect(isPopoverOpen(parent)).toBe(false)
  })

  it('closes only the nested popover on an outside click', async () => {
    let { container, root } = renderApp(<NestedPopovers />)
    let parent = getById<HTMLDivElement>(container, 'parent-surface')
    let child = getById<HTMLDivElement>(container, 'child-surface')

    click(getById(container, 'open-parent'))
    await settle(root)
    click(getById(container, 'child-anchor'))
    await settle(root)

    click(getById(container, 'outside'))
    await settle(root)

    expect(isPopoverOpen(child)).toBe(false)
    expect(isPopoverOpen(parent)).toBe(true)
  })

  it('closes nested popovers when their parent closes and can reopen them', async () => {
    let requests: Array<PopoverHideRequest | undefined> = []
    let { container, root } = renderApp(
      <NestedPopovers onChildHide={(request) => requests.push(request)} />,
    )
    let parent = getById(container, 'parent-surface')
    let child = getById(container, 'child-surface')

    click(getById(container, 'open-parent'))
    await settle(root)
    click(getById(container, 'child-anchor'))
    await settle(root)
    click(getById(container, 'close-parent'))
    await settle(root)

    expect(isPopoverOpen(parent)).toBe(false)
    expect(isPopoverOpen(child)).toBe(false)
    expect(document.documentElement.style.overflow).toBe('')
    expect(requests).toEqual([undefined])

    click(getById(container, 'open-parent'))
    await settle(root)
    expect(isPopoverOpen(parent)).toBe(true)
    expect(isPopoverOpen(child)).toBe(false)
    click(getById(container, 'child-anchor'))
    await settle(root)
    expect(isPopoverOpen(child)).toBe(true)
    click(getById(container, 'close-parent'))
    await settle(root)
    expect(document.documentElement.style.overflow).toBe('')
    expect(requests).toEqual([undefined, undefined])
  })

  it('releases nested popovers when their parent is unmounted', async () => {
    let { container, root } = renderApp(<NestedPopovers />)
    click(getById(container, 'open-parent'))
    await settle(root)
    click(getById(container, 'child-anchor'))
    await settle(root)

    root.render(null)
    root.flush()
    expect(document.documentElement.style.overflow).toBe('')
    expect(key(document.body, 'Escape').defaultPrevented).toBe(false)
  })

  it('does not dismiss a parent menu when tabbing within a nested popover', async () => {
    let { container, root } = renderApp(<PopoverInMenu />)
    click(getById(container, 'menu-trigger'))
    await settle(root)
    click(getById(container, 'popover-anchor'))
    await settle(root)

    key(getById(container, 'popover-input'), 'Tab')
    await settle(root)

    expect(isPopoverOpen(getById(container, 'menu-surface'))).toBe(true)
    expect(isPopoverOpen(getById(container, 'popover-surface'))).toBe(true)
  })

  it('keeps keyboard navigation and typeahead within the nested popover', async () => {
    let { container, root } = renderApp(<PopoverInMenu />)
    click(getById(container, 'menu-trigger'))
    await settle(root)
    click(getById(container, 'popover-anchor'))
    await settle(root)
    let input = getById(container, 'popover-input')
    input.focus()

    key(input, 's')
    await settle(root)
    expect(document.activeElement).toBe(input)
    expect(key(input, 'ArrowDown').defaultPrevented).toBe(false)

    key(input, 'Escape')
    await settle(root)
    key(getById(container, 'menu-list'), 'r')
    await settle(root)

    expect(isPopoverOpen(getById(container, 'menu-surface'))).toBe(true)
    expect(document.activeElement).toBe(getById(container, 'rename-item'))
  })

  it('keeps the popover open when a pointer gesture starts inside and ends outside', async () => {
    let { container, root } = renderPopover()
    click(getById(container, 'anchor'))
    await settle(root)

    getById(container, 'inside').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    getById(container, 'outside').dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    click(getById(container, 'outside'))
    await settle(root)

    expect(isPopoverOpen(getById(container, 'surface'))).toBe(true)
  })

  it('ignores Escape during composition and when a child prevents it', async () => {
    let { container, root } = renderPopover()
    let inside = getById(container, 'inside')
    let surface = getById(container, 'surface')
    click(getById(container, 'anchor'))
    await settle(root)

    inside.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', isComposing: true }),
    )
    await settle(root)
    expect(isPopoverOpen(surface)).toBe(true)

    inside.addEventListener('keydown', (event) => event.preventDefault(), { once: true })
    key(inside, 'Escape')
    await settle(root)
    expect(isPopoverOpen(surface)).toBe(true)
  })

  it('releases dismissal handlers and scroll locking when an open popover is removed', async () => {
    let onHide = mock.fn()
    let { container, root } = renderPopover({ onHide })
    click(getById(container, 'anchor'))
    await settle(root)

    root.render(null)
    root.flush()
    click(document.body)
    key(document.body, 'Escape')

    expect(onHide).not.toHaveBeenCalled()
    expect(document.documentElement.style.overflow).toBe('')
  })
})
