import { expect } from '@remix-run/assert'
import { afterEach, beforeEach, describe, it, mock, type FakeTimers } from '@remix-run/test'

import { createRoot, type RemixNode } from '@remix-run/ui'

import { Menu, MenuItem, onMenuSelect, Submenu, type MenuSelectEvent } from './menu.tsx'

const flashDurationMs = 60
let roots: Array<ReturnType<typeof createRoot>> = []

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  root.flush()
  roots.push(root)
  return { container, root }
}

function renderMenu(
  onSelect: (event: MenuSelectEvent) => void = () => {},
  onAncestorSelect: (event: MenuSelectEvent) => void = () => {},
) {
  return renderApp(
    <div
      mix={onMenuSelect((event) => {
        onAncestorSelect(event)
      })}
    >
      <Menu
        label="View"
        mix={onMenuSelect((event) => {
          onSelect(event)
        })}
      >
        <MenuItem checked={false} name="wordWrap" type="checkbox">
          Word wrap
        </MenuItem>
        <MenuItem disabled name="minimap">
          Minimap
        </MenuItem>

        <Submenu label="Zoom">
          <MenuItem name="zoomIn" value="zoom-in">
            Zoom in
          </MenuItem>
          <MenuItem name="zoomOut" value="zoom-out">
            Zoom out
          </MenuItem>
        </Submenu>
      </Menu>
    </div>,
  )
}

function renderMenuWithSeparator() {
  return renderApp(
    <Menu label="View">
      <MenuItem name="newFile">New File</MenuItem>
      <div role="separator" />
      <MenuItem name="openFile">Open File</MenuItem>
    </Menu>,
  )
}

function renderMenuWithSubmenuSeparator() {
  return renderApp(
    <Menu label="View">
      <div role="separator" />

      <Submenu label="Zoom">
        <MenuItem name="zoomIn" value="zoom-in">
          Zoom in
        </MenuItem>
        <MenuItem name="zoomOut" value="zoom-out">
          Zoom out
        </MenuItem>
      </Submenu>

      <MenuItem name="wordWrap">Word wrap</MenuItem>
    </Menu>,
  )
}

function normalizeText(text: string | null | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function getButtonsByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter(
    (button) => normalizeText(button.textContent) === text,
  )
}

function getButtonByText(container: HTMLElement, text: string) {
  return getButtonsByText(container, text)[0] as HTMLButtonElement
}

function getMenuItemsByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role^="menuitem"]')).filter(
    (item) => normalizeText(item.textContent) === text,
  )
}

function getMenuItemByText(container: HTMLElement, text: string) {
  return getMenuItemsByText(container, text)[0] as HTMLElement
}

function getLists(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="menu"]'))
}

function getSurfaces(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[popover]'))
}

function getSeparator(container: HTMLElement) {
  return container.querySelector('[role="separator"]') as HTMLElement
}

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
}

function key(target: HTMLElement, key: string) {
  let event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key })
  target.dispatchEvent(event)
  return event
}

function pointerMove(target: HTMLElement) {
  target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
}

function pointerLeave(
  target: HTMLElement,
  relatedTarget?: EventTarget | null,
  init: PointerEventInit = {},
) {
  let event = new PointerEvent('pointerleave', init)
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget ?? null })
  target.dispatchEvent(event)
}

function mockRect(target: HTMLElement, left: number, top: number, width: number, height: number) {
  Object.defineProperty(target, 'offsetWidth', {
    configurable: true,
    get: () => width,
  })

  Object.defineProperty(target, 'offsetHeight', {
    configurable: true,
    get: () => height,
  })

  target.getBoundingClientRect = () => new DOMRect(left, top, width, height)
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

let timers!: FakeTimers

async function finishSelectionFlash(root: ReturnType<typeof createRoot>) {
  await timers.advanceAsync(flashDurationMs)
  await settle(root)
}

async function finishDismissal(surface: HTMLElement, root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  surface.dispatchEvent(new TransitionEvent('transitionrun', { propertyName: 'opacity' }))
  surface.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }))
  await settle(root)
}

let scrollIntoViewSpy: ReturnType<typeof mock.method>

beforeEach(() => {
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
})

describe('menu', () => {
  it('opens from click with focus on the list and toggles closed from the trigger', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let [rootSurface] = getSurfaces(container)
    let [rootList] = getLists(container)

    click(trigger)
    await settleFrames(root)

    expect(rootSurface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(rootList)

    click(trigger)
    await settle(root)
    await finishDismissal(rootSurface, root)

    expect(rootSurface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('opens from ArrowDown and skips disabled items during keyboard navigation', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let wordWrap = getMenuItemByText(container, 'Word wrap')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    expect(document.activeElement).toBe(wordWrap)

    key(wordWrap, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(zoom)
    expect(zoom.dataset.highlighted).toBe('true')
  })

  it('does not wrap keyboard navigation at the first or last enabled item', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let wordWrap = getMenuItemByText(container, 'Word wrap')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    expect(document.activeElement).toBe(wordWrap)

    key(wordWrap, 'ArrowUp')
    await settle(root)

    expect(document.activeElement).toBe(wordWrap)
    expect(wordWrap.getAttribute('data-highlighted')).toBe('true')

    key(wordWrap, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(zoom)

    key(zoom, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(zoom)
    expect(zoom.getAttribute('data-highlighted')).toBe('true')
  })

  it('opens submenus with ArrowRight and restores focus with ArrowLeft', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)
    let zoomIn = getMenuItemByText(container, 'Zoom in')

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(zoom)

    key(zoom, 'ArrowRight')
    await settleFrames(root)

    expect(childSurface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(zoomIn)

    key(zoomIn, 'ArrowLeft')
    await settle(root)

    expect(childSurface.getAttribute('data-close-animation')).toBe('none')
    expect(childSurface.matches(':popover-open')).toBe(false)
    expect(zoom.getAttribute('data-submenu-state')).toBe(null)
    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(document.activeElement).toBe(zoom)
  })

  it('does not reopen a submenu after ArrowLeft restores focus to its trigger', async (t) => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)
    let zoomIn = getMenuItemByText(container, 'Zoom in')

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(zoom, 'ArrowRight')
    await settleFrames(root)

    let setTimeoutSpy = t.mock.method(window, 'setTimeout')

    key(zoomIn, 'ArrowLeft')
    await settle(root)

    let submenuDelayCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call.arguments[1] === 'number' && (call.arguments[1] as number) > 0,
    )

    expect(submenuDelayCalls).toHaveLength(0)
    expect(childSurface.matches(':popover-open')).toBe(false)
    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(zoom.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(zoom)
  })

  it('anchors submenus relative to their first item', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)
    let zoomIn = getMenuItemByText(container, 'Zoom in')

    mockRect(zoom, 40, 40, 100, 32)
    mockRect(childSurface, 160, 100, 180, 120)
    mockRect(zoomIn, 160, 104, 128, 32)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(zoom, 'ArrowRight')
    await settleFrames(root)

    expect(childSurface.style.left).toBe('140px')
    expect(childSurface.style.top).toBe('36px')
    expect(childSurface.getAttribute('data-anchor-placement')).toBe('right-start')
  })

  it('opens a submenu immediately when its trigger is clicked without moving focus', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(zoom)

    click(zoom)
    await settle(root)

    expect(childSurface.matches(':popover-open')).toBe(true)
    expect(zoom.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(zoom)
  })

  it('opens submenus after the focus delay without throwing', async (t) => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)
    let setTimeoutSpy = t.mock.method(window, 'setTimeout')

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    expect(document.activeElement).toBe(zoom)

    let submenuDelay = setTimeoutSpy.mock.calls
      .map((call) => call.arguments[1])
      .find((delay): delay is number => typeof delay === 'number' && delay > 0)

    expect(submenuDelay).toBeDefined()

    await new Promise<void>((resolve) => {
      setTimeout(resolve, submenuDelay! + 10)
    })
    await settleFrames(root)

    expect(childSurface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(zoom)
  })

  it('does not reschedule submenu hover-open after focus moves to the trigger', async (t) => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]

    click(trigger)
    await settleFrames(root)

    let setTimeoutSpy = t.mock.method(window, 'setTimeout')

    pointerMove(zoom)
    await settle(root)

    let submenuDelayCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call.arguments[1] === 'number' && (call.arguments[1] as number) > 0,
    )
    expect(submenuDelayCalls).toHaveLength(1)
  })

  it('reopens submenu hover-open when the pointer re-enters a focused trigger from the left', async (t) => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)

    click(trigger)
    await settleFrames(root)

    let setTimeoutSpy = t.mock.method(window, 'setTimeout')

    pointerMove(zoom)
    await settle(root)

    let submenuDelay = setTimeoutSpy.mock.calls
      .map((call) => call.arguments[1])
      .find((delay): delay is number => typeof delay === 'number' && delay > 0)

    expect(submenuDelay).toBeDefined()
    expect(document.activeElement).toBe(zoom)

    pointerLeave(zoom, null, { clientX: 39, clientY: 56 })
    await settle(root)

    expect(zoom.getAttribute('data-highlighted')).toBe(null)
    expect(document.activeElement).toBe(zoom)
    expect(childSurface.matches(':popover-open')).toBe(false)

    pointerMove(zoom)
    await settle(root)

    await new Promise<void>((resolve) => {
      setTimeout(resolve, submenuDelay! + 10)
    })
    await settleFrames(root)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(zoom)
  })

  it('reopens submenu hover-open when the pointer re-enters a focused trigger from a separator', async (t) => {
    let { container, root } = renderMenuWithSubmenuSeparator()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let separator = getSeparator(container)
    let [, childSurface] = getSurfaces(container)

    click(trigger)
    await settleFrames(root)

    let setTimeoutSpy = t.mock.method(window, 'setTimeout')

    pointerMove(zoom)
    await settle(root)

    let submenuDelay = setTimeoutSpy.mock.calls
      .map((call) => call.arguments[1])
      .find((delay): delay is number => typeof delay === 'number' && delay > 0)

    expect(submenuDelay).toBeDefined()
    expect(document.activeElement).toBe(zoom)

    pointerLeave(zoom, separator)
    await settle(root)

    expect(zoom.getAttribute('data-highlighted')).toBe(null)
    expect(document.activeElement).toBe(zoom)
    expect(childSurface.matches(':popover-open')).toBe(false)

    pointerMove(zoom)
    await settle(root)

    await new Promise<void>((resolve) => {
      setTimeout(resolve, submenuDelay! + 10)
    })
    await settleFrames(root)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)
    expect(document.activeElement).toBe(zoom)
  })

  it('clears an open submenu trigger when pointer leaves away from the child surface', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(document.activeElement as HTMLElement, 'ArrowRight')
    await settleFrames(root)

    mockRect(zoom, 40, 40, 100, 32)
    mockRect(childSurface, 160, 40, 120, 120)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)

    pointerLeave(zoom, null, { clientX: 39, clientY: 56 })
    await settle(root)

    expect(zoom.getAttribute('data-highlighted')).toBe(null)
    expect(childSurface.matches(':popover-open')).toBe(false)
  })

  it('keeps an open submenu trigger active when pointer leaves straight into the child surface', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(document.activeElement as HTMLElement, 'ArrowRight')
    await settleFrames(root)

    mockRect(zoom, 40, 40, 100, 32)
    mockRect(childSurface, 140, 40, 120, 120)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)

    pointerLeave(zoom, childSurface, { clientX: 140, clientY: 56 })
    await settle(root)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)
  })

  it('keeps the parent submenu trigger highlighted when ArrowLeft closes a child under the pointer', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)
    let zoomOut = getMenuItemByText(container, 'Zoom out')

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(zoom, 'ArrowRight')
    await settleFrames(root)

    mockRect(zoom, 40, 40, 100, 32)
    mockRect(childSurface, 140, 40, 120, 120)

    pointerLeave(zoom, childSurface, { clientX: 140, clientY: 56 })
    await settle(root)

    pointerMove(zoomOut)
    await settle(root)

    expect(document.activeElement).toBe(zoomOut)

    key(zoomOut, 'ArrowLeft')
    await settle(root)

    expect(childSurface.matches(':popover-open')).toBe(false)
    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(document.activeElement).toBe(zoom)
  })

  it('does not let non-active items clear an open submenu trigger on pointerleave', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let wordWrap = getMenuItemByText(container, 'Word wrap')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let [, childSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(document.activeElement as HTMLElement, 'ArrowRight')
    await settleFrames(root)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)

    pointerLeave(wordWrap, childSurface)
    await settle(root)

    expect(zoom.getAttribute('data-highlighted')).toBe('true')
    expect(childSurface.matches(':popover-open')).toBe(true)
  })

  it('unhighlights items when pointer leaves them for a separator', async () => {
    let { container, root } = renderMenuWithSeparator()
    let trigger = getButtonByText(container, 'View')
    let newFile = getMenuItemByText(container, 'New File')
    let separator = getSeparator(container)

    click(trigger)
    await settleFrames(root)

    pointerMove(newFile)
    await settle(root)

    expect(newFile.getAttribute('data-highlighted')).toBe('true')

    pointerLeave(newFile, separator)
    await settle(root)

    expect(newFile.getAttribute('data-highlighted')).toBe(null)
  })

  it('marks submenu triggers as dismissing while the full menu tree fades out', async () => {
    let { container, root } = renderMenu()
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let zoomIn = getMenuItemByText(container, 'Zoom in')
    let [rootSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(document.activeElement as HTMLElement, 'ArrowRight')
    await settleFrames(root)

    key(zoomIn, 'Escape')
    await settle(root)

    expect(zoom.getAttribute('aria-expanded')).toBe('false')
    expect(zoom.getAttribute('data-submenu-state')).toBe('dismissing')

    await finishDismissal(rootSurface, root)

    expect(zoom.getAttribute('data-submenu-state')).toBe(null)
    expect(rootSurface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('dispatches one bubbled selection event from submenu items and closes the full tree', async (t) => {
    let selections: MenuSelectEvent[] = []
    let { container, root } = renderMenu((event) => {
      selections.push(event)
    })
    let trigger = getButtonByText(container, 'View')
    let zoom = getMenuItemsByText(container, 'Zoom')[0]
    let zoomIn = getMenuItemByText(container, 'Zoom in')
    let [rootSurface, childSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(document.activeElement as HTMLElement, 'ArrowRight')
    await settleFrames(root)

    timers = t.useFakeTimers()

    key(zoomIn, 'Enter')
    await settle(root)

    expect(zoomIn.getAttribute('data-menu-flash')).toBe('true')
    expect(zoomIn.getAttribute('aria-checked')).toBe(null)
    expect(zoomIn.getAttribute('data-menu-selected')).toBe(null)
    expect(zoom.getAttribute('data-menu-flash')).toBe(null)
    expect(zoom.getAttribute('aria-expanded')).toBe('true')

    await finishSelectionFlash(root)

    expect(zoom.getAttribute('aria-expanded')).toBe('false')
    expect(zoom.getAttribute('data-submenu-state')).toBe('selecting')
    expect(zoomIn.getAttribute('data-menu-flash')).toBe(null)
    expect(zoomIn.getAttribute('data-menu-selected')).toBe(null)
    expect(zoomIn.getAttribute('data-highlighted')).toBe('true')
    expect(rootSurface.getAttribute('data-close-animation')).toBe(null)
    expect(childSurface.getAttribute('data-close-animation')).toBe(null)

    await finishDismissal(rootSurface, root)

    expect(selections).toHaveLength(1)
    expect(selections[0]!.item).toMatchObject({
      label: 'Zoom in',
      name: 'zoomIn',
      type: 'item',
      value: 'zoom-in',
    })
    expect(zoom.getAttribute('data-submenu-state')).toBe(null)
    expect(rootSurface.matches(':popover-open')).toBe(false)
    expect(childSurface.matches(':popover-open')).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('re-dispatches one selection event from the button so shared ancestors only see it once', async (t) => {
    let buttonSelections: MenuSelectEvent[] = []
    let ancestorSelections: MenuSelectEvent[] = []
    let { container, root } = renderMenu(
      (event) => {
        buttonSelections.push(event)
      },
      (event) => {
        ancestorSelections.push(event)
      },
    )
    let trigger = getButtonByText(container, 'View')
    let wordWrap = getMenuItemByText(container, 'Word wrap')
    let [rootSurface] = getSurfaces(container)

    click(trigger)
    await settleFrames(root)

    timers = t.useFakeTimers()

    click(wordWrap)
    await settle(root)
    await finishSelectionFlash(root)
    await finishDismissal(rootSurface as HTMLElement, root)

    expect(buttonSelections).toHaveLength(1)
    expect(ancestorSelections).toHaveLength(1)
    expect(buttonSelections[0]!.item).toMatchObject({
      checked: true,
      label: 'Word wrap',
      name: 'wordWrap',
      type: 'checkbox',
      value: null,
    })
    expect(ancestorSelections[0]!.item).toMatchObject({
      checked: true,
      label: 'Word wrap',
      name: 'wordWrap',
      type: 'checkbox',
      value: null,
    })
  })

  it('does not swallow parent item clicks while a child submenu is open', async (t) => {
    let selections: MenuSelectEvent[] = []
    let { container, root } = renderMenu((event) => {
      selections.push(event)
    })
    let trigger = getButtonByText(container, 'View')
    let wordWrap = getMenuItemByText(container, 'Word wrap')
    let [, childSurface] = getSurfaces(container)

    key(trigger, 'ArrowDown')
    await settleFrames(root)

    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    key(document.activeElement as HTMLElement, 'ArrowRight')
    await settleFrames(root)

    timers = t.useFakeTimers()

    click(wordWrap)
    await settle(root)

    expect(childSurface.getAttribute('data-close-animation')).toBe('none')
    expect(childSurface.matches(':popover-open')).toBe(false)
    expect(wordWrap.getAttribute('data-menu-flash')).toBe('true')
    expect(wordWrap.getAttribute('aria-checked')).toBe('true')

    let [rootSurface] = getSurfaces(container)
    await finishSelectionFlash(root)

    expect(wordWrap.getAttribute('data-menu-flash')).toBe(null)
    expect(wordWrap.getAttribute('aria-checked')).toBe('false')
    expect(wordWrap.getAttribute('data-highlighted')).toBe('true')
    expect(rootSurface?.getAttribute('data-close-animation')).toBe(null)

    await finishDismissal(rootSurface as HTMLElement, root)

    expect(selections).toHaveLength(1)
    expect(selections[0]!.item).toMatchObject({
      checked: true,
      label: 'Word wrap',
      name: 'wordWrap',
      type: 'checkbox',
      value: null,
    })
    expect(document.activeElement).toBe(trigger)
  })
})
