import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRoot, type Props, type RemixNode } from '@remix-run/component'

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  SubmenuTrigger,
  menuButtonMixin,
  menuItemMixin,
  menuListMixin,
  menuPopoverMixin,
  submenuTriggerMixin,
} from './menu.tsx'
import type { MenuSelectEvent } from './menu.tsx'

const SUBMENU_OPEN_DELAY = 200

type RectInit = {
  height: number
  left: number
  top: number
  width: number
}

function createRect({ top, left, width, height }: RectInit) {
  return new DOMRect(left, top, width, height)
}

function mockLayout(element: HTMLElement, rectInit: RectInit) {
  let rect = createRect(rectInit)
  element.getBoundingClientRect = () => rect
}

function renderApp(node: RemixNode) {
  let container = document.createElement('div')
  document.body.append(container)
  let root = createRoot(container)
  root.render(node)
  return { container, root }
}

function renderNestedMenu() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <Menu label="Color actions">
          <SubmenuTrigger name="colors">Colors</SubmenuTrigger>
          <MenuList>
            <MenuItem name="red" value="red">
              Red
            </MenuItem>
            <MenuItem name="green" value="green">
              Green
            </MenuItem>
          </MenuList>
        </Menu>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem name="delete" value="delete-file">
          Delete
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderDeepNestedMenu() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <Menu label="Color actions">
          <SubmenuTrigger name="colors">Colors</SubmenuTrigger>
          <MenuList>
            <Menu label="More color actions">
              <SubmenuTrigger name="more-colors">More colors</SubmenuTrigger>
              <MenuList>
                <MenuItem name="blue" value="blue">
                  Blue
                </MenuItem>
              </MenuList>
            </Menu>
            <MenuItem name="green" value="green">
              Green
            </MenuItem>
          </MenuList>
        </Menu>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderStandardMenu() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <MenuItem name="new" value="new-file">
          New File
        </MenuItem>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem name="delete" value="delete-file">
          Delete
        </MenuItem>
        <MenuItem disabled name="archive" value="archive-file">
          Archive
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderMenuWithDisabledItem() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem disabled name="archive" value="archive-file">
          Archive
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderMenuWithDisabledSubmenuTrigger() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <Menu label="Color actions">
          <SubmenuTrigger disabled name="colors">
            Colors
          </SubmenuTrigger>
          <MenuList>
            <MenuItem name="red" value="red">
              Red
            </MenuItem>
          </MenuList>
        </Menu>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderMenuWithNoEnabledItems() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <MenuItem disabled name="archive" value="archive-file">
          Archive
        </MenuItem>
        <MenuItem disabled name="delete" value="delete-file">
          Delete
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderMenuWithEmptyValueItem() {
  return (
    <Menu label="File actions">
      <MenuButton>File</MenuButton>
      <MenuList>
        <MenuItem name="close">Close</MenuItem>
      </MenuList>
    </Menu>
  )
}

function renderSearchMenu() {
  return (
    <Menu label="Search actions">
      <MenuButton>Search</MenuButton>
      <MenuList>
        <MenuItem name="save" value="save">
          Save
        </MenuItem>
        <MenuItem name="settings" value="settings">
          Settings
        </MenuItem>
        <MenuItem name="rename" value="rename-file">
          Rename
        </MenuItem>
        <MenuItem name="quit" value="quit" searchValue={['close', 'exit']}>
          Quit
        </MenuItem>
      </MenuList>
    </Menu>
  )
}

type CustomMenuItemProps = Omit<Props<'article'>, 'role'> & {
  searchValue?: string | string[]
  name: string
  value?: string
  disabled?: boolean
  role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'option'
}

interface CustomSubmenuTriggerProps extends Props<'aside'> {
  name?: string
  searchValue?: string | string[]
  disabled?: boolean
}

function CustomMenuButton() {
  return (props: Props<'button'>) => {
    let { children, mix, type, ...domProps } = props

    return (
      <button {...domProps} type={type ?? 'button'} mix={[menuButtonMixin(), mix]}>
        <span>{children}</span>
      </button>
    )
  }
}

function CustomMenuList() {
  return (props: Props<'section'>) => {
    let { children, mix, ...domProps } = props

    return (
      <div data-custom-popover="true" mix={menuPopoverMixin()}>
        <section {...domProps} data-custom-list="true" mix={[menuListMixin(), mix]}>
          {children}
        </section>
      </div>
    )
  }
}

function CustomMenuItem() {
  return (props: CustomMenuItemProps) => {
    let { children, disabled, mix, name, role, searchValue, value, ...domProps } = props

    return (
      <article
        {...domProps}
        mix={[menuItemMixin({ disabled, name, role, searchValue, value }), mix]}
      >
        {children}
      </article>
    )
  }
}

function CustomSubmenuTrigger() {
  return (props: CustomSubmenuTriggerProps) => {
    let { children, disabled, mix, name, searchValue, ...domProps } = props

    return (
      <aside {...domProps} mix={[submenuTriggerMixin({ disabled, name, searchValue }), mix]}>
        <span>{children}</span>
      </aside>
    )
  }
}

function renderCustomComposedMenu() {
  return (
    <Menu label="File actions">
      <CustomMenuButton>File</CustomMenuButton>
      <CustomMenuList>
        <Menu label="Color actions">
          <CustomSubmenuTrigger name="colors">Colors</CustomSubmenuTrigger>
          <CustomMenuList>
            <CustomMenuItem name="red" value="red">
              Red
            </CustomMenuItem>
          </CustomMenuList>
        </Menu>
        <CustomMenuItem name="rename" value="rename-file">
          Rename
        </CustomMenuItem>
      </CustomMenuList>
    </Menu>
  )
}

function getRootTrigger(container: HTMLElement) {
  return container.querySelector('button[aria-haspopup="menu"]') as HTMLElement
}

function getMenuByLabel(container: HTMLElement, label: string) {
  return container.querySelector(`[role="menu"][aria-label="${label}"]`) as HTMLElement
}

function getPopoverForMenu(menu: HTMLElement) {
  return menu.parentElement as HTMLElement
}

function isPopoverOpen(element: HTMLElement) {
  return element.matches(':popover-open')
}

function getMenuItemByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
    (item) => item.textContent?.trim() === text,
  ) as HTMLElement
}

function getHighlightedItem(container: HTMLElement) {
  return container.querySelector('[data-highlighted="true"]') as HTMLElement | null
}

function getRootWrapper(container: HTMLElement) {
  return container.firstElementChild as HTMLElement
}

function pointer(
  target: HTMLElement,
  type: 'click' | 'pointerdown' | 'pointerleave' | 'pointermove' | 'pointerup',
  options: { button?: number; cancelable?: boolean; x?: number; y?: number } = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      button: options.button ?? 0,
      cancelable: options.cancelable,
      clientX: options.x ?? 0,
      clientY: options.y ?? 0,
    }),
  )
}

function key(target: HTMLElement, key: string) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      key,
    }),
  )
}

async function settle(root: ReturnType<typeof createRoot>) {
  await Promise.resolve()
  root.flush()
  await Promise.resolve()
  root.flush()
}

async function advance(root: ReturnType<typeof createRoot>, ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
  await settle(root)
}

async function finishClose(root: ReturnType<typeof createRoot>, ...popovers: HTMLElement[]) {
  for (let popover of popovers) {
    popover.dispatchEvent(new Event('transitionend'))
  }
  await settle(root)
}

async function openRootMenu(root: ReturnType<typeof createRoot>, container: HTMLElement) {
  let trigger = getRootTrigger(container)
  pointer(trigger, 'pointerdown')
  await settle(root)
}

async function openRootMenuWithKey(
  root: ReturnType<typeof createRoot>,
  container: HTMLElement,
  keyValue: string,
) {
  let trigger = getRootTrigger(container)
  trigger.focus()
  key(trigger, keyValue)
  await settle(root)
}

async function openColorSubmenu(root: ReturnType<typeof createRoot>, container: HTMLElement) {
  let colors = getMenuItemByText(container, 'Colors')
  pointer(colors, 'pointermove', { x: 92, y: 70 })
  await settle(root)
  await advance(root, SUBMENU_OPEN_DELAY + 1)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe.skip('submenus and hover aim', () => {
  it('keeps the parent branch open while moving into an open submenu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()

    pointer(rootMenu, 'pointerleave', { x: 100, y: 70 })
    root.flush()

    pointer(red, 'pointermove', { x: 140, y: 70 })
    root.flush()

    expect(colors.dataset.highlighted).toBe('true')
    expect(red.dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(true)
  })

  it('suppresses sibling retargeting while moving toward an open submenu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()

    pointer(rename, 'pointermove', { x: 110, y: 70 })
    root.flush()

    expect(colors.dataset.highlighted).toBe('true')
    expect(rename.dataset.highlighted).toBe('false')
    expect(isPopoverOpen(colorsPopover)).toBe(true)
  })

  it('clears the submenu trigger after hover aim expires outside the parent list', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()

    pointer(rootMenu, 'pointerleave', { x: 92, y: 70 })
    root.flush()
    await advance(root, 121)

    expect(document.activeElement).toBe(rootMenu)
    expect(colors.dataset.highlighted).toBe('false')
    expect(isPopoverOpen(colorsPopover)).toBe(false)
  })

  it('resumes normal retargeting after the pointer leaves the aim corridor', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()

    pointer(rename, 'pointermove', { x: 60, y: 20 })
    root.flush()
    await Promise.resolve()
    root.flush()
    await Promise.resolve()
    root.flush()

    expect(colors.dataset.highlighted).toBe('false')
    expect(rename.dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(false)
  })

  it('selects a sibling item after leaving an open submenu branch', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      let selection = event as MenuSelectEvent
      selections.push(selection.item)
    })

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    root.flush()

    pointer(rename, 'pointermove', { x: 110, y: 70 })
    root.flush()

    pointer(rename, 'pointermove', { x: 60, y: 20 })
    root.flush()

    pointer(rename, 'pointermove', { x: 110, y: 70 })
    root.flush()

    pointer(rename, 'pointerdown', { x: 110, y: 70 })
    root.flush()

    pointer(rename, 'pointerup', { x: 110, y: 70 })
    root.flush()
    await advance(root, 80)

    expect(selections).toEqual([{ name: 'rename', value: 'rename-file' }])
  })

  it('refocuses an open submenu trigger when hovering back from its child menu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(red, 'pointermove', { x: 140, y: 70 })
    root.flush()

    pointer(colors, 'pointermove', { x: 92, y: 70 })
    root.flush()

    expect(document.activeElement).toBe(colors)
  })

  it('keeps focus on the submenu trigger when arrow left collapses a hovered child menu', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(red, 'pointermove', { x: 140, y: 70 })
    root.flush()

    let hidePopover = colorsPopover.hidePopover
    colorsPopover.hidePopover = function () {
      hidePopover.call(this)
      queueMicrotask(() => {
        pointer(rootMenu, 'pointerleave', { x: 140, y: 70 })
      })
    }

    key(red, 'ArrowLeft')
    root.flush()

    expect(document.activeElement).toBe(colors)
    expect(colors.dataset.highlighted).toBe('true')
  })

  it('keeps keyboard focus on the next item when collapsing a submenu under a stationary pointer', async () => {
    let { container, root } = renderApp(renderNestedMenu())

    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)

    key(rootMenu, 'ArrowDown')
    root.flush()
    await advance(root, SUBMENU_OPEN_DELAY + 1)

    let rename = getMenuItemByText(container, 'Rename')

    let hidePopover = colorsPopover.hidePopover
    colorsPopover.hidePopover = function () {
      hidePopover.call(this)
      queueMicrotask(() => {
        pointer(rootMenu, 'pointerleave', { x: 140, y: 70 })
      })
    }

    key(rootMenu, 'ArrowDown')
    root.flush()
    await Promise.resolve()
    root.flush()

    expect(document.activeElement).toBe(rename)
    expect(rename.dataset.highlighted).toBe('true')
  })

  it('hovering or focusing a SubmenuTrigger highlights it and opens the child menu after the configured delay', async () => {
    async function assertSubmenuOpensAfterDelay(
      activate: (
        root: ReturnType<typeof createRoot>,
        rootMenu: HTMLElement,
        container: HTMLElement,
      ) => Promise<void>,
    ) {
      let { container, root } = renderApp(renderNestedMenu())
      let rootMenu = getMenuByLabel(container, 'File actions')
      let colorsMenu = getMenuByLabel(container, 'Color actions')
      let colorsPopover = getPopoverForMenu(colorsMenu)
      mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

      await openRootMenu(root, container)
      await activate(root, rootMenu, container)
      await advance(root, SUBMENU_OPEN_DELAY + 1)

      let colors = getMenuItemByText(container, 'Colors')

      expect(colors.dataset.highlighted).toBe('true')
      expect(isPopoverOpen(colorsPopover)).toBe(true)

      container.remove()
    }

    await assertSubmenuOpensAfterDelay(async (root, _rootMenu, container) => {
      let colors = getMenuItemByText(container, 'Colors')
      pointer(colors, 'pointermove', { x: 92, y: 70 })
      await settle(root)
    })

    await assertSubmenuOpensAfterDelay(async (root, rootMenu) => {
      key(rootMenu, 'ArrowDown')
      await settle(root)
    })
  })

  it('blurring a SubmenuTrigger before the delay expires cancels the pending open', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)

    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowDown')
    await settle(root)
    await advance(root, SUBMENU_OPEN_DELAY + 1)

    let rename = getMenuItemByText(container, 'Rename')

    expect(rename.dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(false)
  })

  it('ArrowRight on an enabled submenu trigger opens the child immediately and focuses its first enabled item', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)

    await openRootMenu(root, container)
    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowRight')
    await settle(root)

    let red = getMenuItemByText(container, 'Red')

    expect(isPopoverOpen(colorsPopover)).toBe(true)
    expect(red.dataset.highlighted).toBe('true')
    expect(document.activeElement).toBe(red)
  })

  it('ArrowRight on a disabled submenu trigger does nothing', async () => {
    let { container, root } = renderApp(renderMenuWithDisabledSubmenuTrigger())
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)

    await openRootMenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowRight')
    await settle(root)

    expect(colors.getAttribute('aria-expanded')).toBe('false')
    expect(isPopoverOpen(colorsPopover)).toBe(false)
    expect(getHighlightedItem(container)).toBe(null)
  })

  it('ArrowLeft from a child submenu collapses only that branch and restores focus/highlight to the parent trigger without immediately reopening', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)

    await openRootMenu(root, container)
    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowRight')
    await settle(root)

    let red = getMenuItemByText(container, 'Red')
    key(red, 'ArrowLeft')
    await settle(root)

    expect(document.activeElement).toBe(colors)
    expect(colors.dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(false)

    await advance(root, SUBMENU_OPEN_DELAY + 1)

    expect(isPopoverOpen(colorsPopover)).toBe(false)
    expect(document.activeElement).toBe(colors)
  })

  it('Escape from any nested submenu closes the entire tree and returns focus to the root trigger', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let trigger = getRootTrigger(container)
    let rootMenu = getMenuByLabel(container, 'File actions')
    let rootPopover = getPopoverForMenu(rootMenu)
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)

    await openRootMenu(root, container)
    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowRight')
    await settle(root)

    let red = getMenuItemByText(container, 'Red')
    key(red, 'Escape')
    await settle(root)
    await finishClose(root, colorsPopover, rootPopover)

    expect(isPopoverOpen(colorsPopover)).toBe(false)
    expect(isPopoverOpen(rootPopover)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('selecting a nested item bubbles one Menu.select event to a root listener and closes every open menu in the chain', async () => {
    let { container, root } = renderApp(renderDeepNestedMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    let trigger = getRootTrigger(container)
    let rootMenu = getMenuByLabel(container, 'File actions')
    let rootPopover = getPopoverForMenu(rootMenu)
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    let moreColorsMenu = getMenuByLabel(container, 'More color actions')
    let moreColorsPopover = getPopoverForMenu(moreColorsMenu)

    await openRootMenu(root, container)
    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowRight')
    await settle(root)

    let moreColors = getMenuItemByText(container, 'More colors')
    key(moreColors, 'ArrowRight')
    await settle(root)

    let blue = getMenuItemByText(container, 'Blue')
    key(blue, 'Enter')
    await settle(root)
    await advance(root, 80)
    await finishClose(root, moreColorsPopover, colorsPopover, rootPopover)

    expect(selections).toEqual([{ name: 'blue', value: 'blue' }])
    expect(isPopoverOpen(moreColorsPopover)).toBe(false)
    expect(isPopoverOpen(colorsPopover)).toBe(false)
    expect(isPopoverOpen(rootPopover)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('keyboard events in a child menu do not also move the parent menu', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let rootMenu = getMenuByLabel(container, 'File actions')

    await openRootMenu(root, container)
    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    key(colors, 'ArrowRight')
    await settle(root)

    let red = getMenuItemByText(container, 'Red')
    key(red, 'ArrowDown')
    await settle(root)

    let green = getMenuItemByText(container, 'Green')
    let rename = getMenuItemByText(container, 'Rename')

    expect(green.dataset.highlighted).toBe('true')
    expect(colors.dataset.highlighted).toBe('true')
    expect(rename.dataset.highlighted).toBe('false')
  })

  it('moving the pointer from an open submenu trigger toward its child keeps the parent branch open and suppresses sibling retargeting until the pointer leaves the aim corridor or stalls', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')
    let red = getMenuItemByText(container, 'Red')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    await settle(root)
    pointer(rename, 'pointermove', { x: 110, y: 70 })
    await settle(root)
    pointer(red, 'pointermove', { x: 140, y: 70 })
    await settle(root)

    expect(colors.dataset.highlighted).toBe('true')
    expect(rename.dataset.highlighted).toBe('false')
    expect(red.dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(true)
  })

  it('leaving the aim corridor resumes normal sibling retargeting and collapses the old child submenu', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(colors, 'pointerleave', { x: 92, y: 70 })
    await settle(root)
    pointer(rename, 'pointermove', { x: 60, y: 20 })
    await settle(root)

    expect(colors.dataset.highlighted).toBe('false')
    expect(rename.dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(false)
  })

  it('returning the pointer from a child menu to its trigger re-focuses and highlights the trigger', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    await openColorSubmenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let red = getMenuItemByText(container, 'Red')

    pointer(red, 'pointermove', { x: 140, y: 70 })
    await settle(root)
    pointer(colors, 'pointermove', { x: 92, y: 70 })
    await settle(root)

    expect(document.activeElement).toBe(colors)
    expect(colors.dataset.highlighted).toBe('true')
  })

  it('leaving a menu with no open child clears the active highlight', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let rootMenu = getMenuByLabel(container, 'File actions')
    let rename = getMenuItemByText(container, 'Rename')

    await openRootMenu(root, container)
    pointer(rename, 'pointermove', { x: 40, y: 40 })
    await settle(root)
    pointer(rootMenu, 'pointerleave', { x: 40, y: 40 })
    await settle(root)

    expect(getHighlightedItem(container)).toBe(null)
  })
})

describe.skip('trigger and root menu', () => {
  it('left pointerdown on MenuButton opens the root menu, updates aria-expanded, and focuses the list', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let trigger = getRootTrigger(container)
    let menu = getMenuByLabel(container, 'File actions')
    let popover = getPopoverForMenu(menu)

    pointer(trigger, 'pointerdown')
    await settle(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(isPopoverOpen(popover)).toBe(true)
    expect(document.activeElement).toBe(menu)
    expect(getHighlightedItem(container)).toBe(null)
  })

  it('left pointerdown on an already open trigger closes the whole tree and restores focus to the trigger', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let trigger = getRootTrigger(container)
    let menu = getMenuByLabel(container, 'File actions')
    let popover = getPopoverForMenu(menu)

    await openRootMenu(root, container)
    pointer(trigger, 'pointerdown')
    await settle(root)
    await finishClose(root, popover)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isPopoverOpen(popover)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('non-left click on the trigger does nothing', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let trigger = getRootTrigger(container)
    let menu = getMenuByLabel(container, 'File actions')
    let popover = getPopoverForMenu(menu)

    pointer(trigger, 'pointerdown', { button: 1 })
    await settle(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isPopoverOpen(popover)).toBe(false)
    expect(document.activeElement).not.toBe(menu)
    expect(getHighlightedItem(container)).toBe(null)
  })

  it('ArrowDown on the trigger opens and focuses the first enabled item', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenuWithKey(root, container, 'ArrowDown')

    let trigger = getRootTrigger(container)
    let firstItem = getMenuItemByText(container, 'New File')

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(firstItem.dataset.highlighted).toBe('true')
    expect(document.activeElement).toBe(firstItem)
  })

  it('ArrowUp on the trigger opens and focuses the last enabled item', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenuWithKey(root, container, 'ArrowUp')

    let lastItem = getMenuItemByText(container, 'Delete')

    expect(lastItem.dataset.highlighted).toBe('true')
    expect(document.activeElement).toBe(lastItem)
  })

  it('Enter and Space on the trigger open with no active item and leave focus on the list', async () => {
    async function assertOpenWithoutActiveItem(keyValue: string) {
      let { container, root } = renderApp(renderStandardMenu())

      await openRootMenuWithKey(root, container, keyValue)

      let trigger = getRootTrigger(container)
      let menu = getMenuByLabel(container, 'File actions')

      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(document.activeElement).toBe(menu)
      expect(getHighlightedItem(container)).toBe(null)
    }

    await assertOpenWithoutActiveItem('Enter')
    await assertOpenWithoutActiveItem(' ')
  })

  it('reopening after close resets any prior active item and open submenu state', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let trigger = getRootTrigger(container)
    let rootMenu = getMenuByLabel(container, 'File actions')
    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    mockLayout(colorsMenu, { top: 40, left: 120, width: 120, height: 100 })

    await openRootMenu(root, container)
    key(rootMenu, 'ArrowDown')
    await settle(root)
    await advance(root, SUBMENU_OPEN_DELAY + 1)

    expect(getMenuItemByText(container, 'Colors').dataset.highlighted).toBe('true')
    expect(isPopoverOpen(colorsPopover)).toBe(true)

    key(rootMenu, 'Escape')
    await settle(root)
    await finishClose(root, colorsPopover, getPopoverForMenu(rootMenu))

    pointer(trigger, 'pointerdown')
    await settle(root)

    expect(getHighlightedItem(container)).toBe(null)
    expect(isPopoverOpen(colorsPopover)).toBe(false)
    expect(document.activeElement).toBe(rootMenu)
  })

  it('Escape closes the root menu and returns focus to the trigger', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let trigger = getRootTrigger(container)
    let menu = getMenuByLabel(container, 'File actions')
    let popover = getPopoverForMenu(menu)

    await openRootMenu(root, container)
    key(menu, 'Escape')
    await settle(root)
    await finishClose(root, popover)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(isPopoverOpen(popover)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('outside pointerdown closes the whole tree and returns focus to the trigger', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let trigger = getRootTrigger(container)
    let outside = document.createElement('button')
    document.body.append(outside)

    await openRootMenu(root, container)

    let event = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    })
    outside.dispatchEvent(event)
    await settle(root)
    await finishClose(root, getPopoverForMenu(getMenuByLabel(container, 'File actions')))

    expect(event.defaultPrevented).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('inside pointerdown while open does not dismiss the menu', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let trigger = getRootTrigger(container)
    let menu = getMenuByLabel(container, 'File actions')
    let popover = getPopoverForMenu(menu)

    await openRootMenu(root, container)
    pointer(menu, 'pointerdown')
    await settle(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(isPopoverOpen(popover)).toBe(true)
  })

  it('accessibility wiring is correct for the trigger, root list, and submenu triggers', async () => {
    let { container, root } = renderApp(renderNestedMenu())
    let trigger = getRootTrigger(container)
    let rootMenu = getMenuByLabel(container, 'File actions')

    await openRootMenu(root, container)

    let colors = getMenuItemByText(container, 'Colors')
    let colorsMenu = getMenuByLabel(container, 'Color actions')

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-controls')).toBe(rootMenu.id)
    expect(rootMenu.getAttribute('role')).toBe('menu')
    expect(rootMenu.getAttribute('aria-label')).toBe('File actions')
    expect(colors.getAttribute('aria-haspopup')).toBe('menu')
    expect(colors.getAttribute('aria-controls')).toBe(colorsMenu.id)
    expect(colors.getAttribute('aria-expanded')).toBe('false')
    expect(colorsMenu.getAttribute('role')).toBe('menu')
    expect(colorsMenu.getAttribute('aria-label')).toBe('Color actions')
  })

  it('supports custom wrappers composed from the exported menu mixins', async () => {
    let { container, root } = renderApp(renderCustomComposedMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    await openRootMenu(root, container)

    let rootMenu = getMenuByLabel(container, 'File actions')
    expect(rootMenu.tagName).toBe('SECTION')
    expect(getPopoverForMenu(rootMenu).dataset.customPopover).toBe('true')

    key(rootMenu, 'ArrowDown')
    await settle(root)

    let colors = getMenuItemByText(container, 'Colors')
    expect(colors.tagName).toBe('ASIDE')

    key(colors, 'ArrowRight')
    await settle(root)

    let colorsMenu = getMenuByLabel(container, 'Color actions')
    let colorsPopover = getPopoverForMenu(colorsMenu)
    let red = getMenuItemByText(container, 'Red')

    expect(isPopoverOpen(colorsPopover)).toBe(true)
    expect(red.tagName).toBe('ARTICLE')

    key(red, 'Enter')
    await settle(root)
    await advance(root, 80)
    await finishClose(root, colorsPopover, getPopoverForMenu(rootMenu))

    expect(selections).toEqual([{ name: 'red', value: 'red' }])
  })
})

describe.skip('items and selection', () => {
  it('hovering an enabled item highlights it and moves focus to it', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenu(root, container)

    let rename = getMenuItemByText(container, 'Rename')
    pointer(rename, 'pointermove', { x: 40, y: 40 })
    await settle(root)

    expect(rename.dataset.highlighted).toBe('true')
    expect(document.activeElement).toBe(rename)
  })

  it('ArrowDown and ArrowUp move through enabled items and clamp at the ends', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenuWithKey(root, container, 'Enter')

    let menu = getMenuByLabel(container, 'File actions')

    key(menu, 'ArrowDown')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('New File')

    key(menu, 'ArrowDown')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Rename')

    key(menu, 'ArrowDown')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')

    key(menu, 'ArrowDown')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')

    key(menu, 'ArrowUp')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Rename')

    key(menu, 'ArrowUp')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('New File')

    key(menu, 'ArrowUp')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('New File')
  })

  it('Home and End jump to the first and last enabled items', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenuWithKey(root, container, 'Enter')

    let menu = getMenuByLabel(container, 'File actions')

    key(menu, 'End')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')

    key(menu, 'Home')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('New File')
  })

  it('disabled items are skipped by open strategies, arrow navigation, Home and End, and typeahead', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenuWithKey(root, container, 'ArrowUp')
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')

    let menu = getMenuByLabel(container, 'File actions')

    key(menu, 'ArrowDown')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')

    key(menu, 'Home')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('New File')

    key(menu, 'End')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')

    key(menu, 'a')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')
  })

  it('Enter on an active item dispatches exactly one bubbling Menu.select event with name and value, closes the full tree, and restores focus to the root trigger', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    await openRootMenuWithKey(root, container, 'Enter')

    let menu = getMenuByLabel(container, 'File actions')
    let trigger = getRootTrigger(container)
    let popover = getPopoverForMenu(menu)

    key(menu, 'ArrowDown')
    await settle(root)
    key(document.activeElement as HTMLElement, 'ArrowDown')
    await settle(root)

    let rename = getMenuItemByText(container, 'Rename')
    expect(document.activeElement).toBe(rename)
    key(rename, 'Enter')
    await settle(root)
    await advance(root, 80)
    await finishClose(root, popover)

    expect(selections).toEqual([{ name: 'rename', value: 'rename-file' }])
    expect(isPopoverOpen(popover)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('Space on an active item dispatches exactly one bubbling Menu.select event with name and value, closes the full tree, and restores focus to the root trigger', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    await openRootMenuWithKey(root, container, 'ArrowUp')

    let menu = getMenuByLabel(container, 'File actions')
    let trigger = getRootTrigger(container)
    let popover = getPopoverForMenu(menu)
    let deleteItem = getMenuItemByText(container, 'Delete')

    expect(document.activeElement).toBe(deleteItem)
    key(deleteItem, ' ')
    await settle(root)
    await advance(root, 80)
    await finishClose(root, popover)

    expect(selections).toEqual([{ name: 'delete', value: 'delete-file' }])
    expect(isPopoverOpen(popover)).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('pointer activation dispatches only one select event even though both pointerup and click handlers exist', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    await openRootMenu(root, container)

    let menu = getMenuByLabel(container, 'File actions')
    let rename = getMenuItemByText(container, 'Rename')

    pointer(rename, 'pointermove', { x: 40, y: 40 })
    await settle(root)
    pointer(rename, 'pointerdown', { x: 40, y: 40 })
    pointer(rename, 'pointerup', { x: 40, y: 40 })
    pointer(rename, 'click', { x: 40, y: 40 })
    await settle(root)
    await advance(root, 120)

    expect(selections).toEqual([{ name: 'rename', value: 'rename-file' }])
    expect(isPopoverOpen(getPopoverForMenu(menu))).toBe(false)
  })

  it('non-left click on an item does nothing', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    await openRootMenu(root, container)

    let menu = getMenuByLabel(container, 'File actions')
    let rename = getMenuItemByText(container, 'Rename')
    let popover = getPopoverForMenu(menu)

    pointer(rename, 'pointermove', { x: 40, y: 40 })
    await settle(root)
    pointer(rename, 'pointerup', { button: 1, x: 40, y: 40 })
    pointer(rename, 'click', { button: 1, x: 40, y: 40 })
    await settle(root)

    expect(selections).toEqual([])
    expect(isPopoverOpen(popover)).toBe(true)
    expect(rename.dataset.highlighted).toBe('true')
  })

  it('clicking or releasing on a disabled item does nothing and never selects the previously active item', async () => {
    async function assertDisabledItemActivationDoesNothing(type: 'click' | 'pointerup') {
      let { container, root } = renderApp(renderMenuWithDisabledItem())
      let selections: Array<{ name: string; value: string }> = []
      container.addEventListener(Menu.select, (event) => {
        let selection = event as MenuSelectEvent
        selections.push(selection.item)
      })

      await openRootMenu(root, container)

      let rootMenu = getMenuByLabel(container, 'File actions')
      let rootPopover = getPopoverForMenu(rootMenu)
      let rename = getMenuItemByText(container, 'Rename')
      let archive = getMenuItemByText(container, 'Archive')

      pointer(rename, 'pointermove', { x: 40, y: 40 })
      root.flush()

      expect(rename.dataset.highlighted).toBe('true')
      expect(archive.dataset.highlighted).toBe('false')

      pointer(archive, type, { x: 40, y: 80 })
      root.flush()
      await advance(root, 80)

      expect(selections).toEqual([])
      expect(rename.dataset.highlighted).toBe('true')
      expect(archive.dataset.highlighted).toBe('false')
      expect(isPopoverOpen(rootPopover)).toBe(true)
    }

    await assertDisabledItemActivationDoesNothing('pointerup')
    await assertDisabledItemActivationDoesNothing('click')
  })

  it('selecting an item with no value emits an empty string value', async () => {
    let { container, root } = renderApp(renderMenuWithEmptyValueItem())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    await openRootMenuWithKey(root, container, 'ArrowDown')

    let close = getMenuItemByText(container, 'Close')
    key(close, 'Enter')
    await settle(root)
    await advance(root, 120)

    expect(selections).toEqual([{ name: 'close', value: '' }])
  })

  it('a menu with no enabled items still opens, keeps focus on the list, and selection keys do nothing', async () => {
    let { container, root } = renderApp(renderMenuWithNoEnabledItems())

    await openRootMenuWithKey(root, container, 'ArrowDown')

    let menu = getMenuByLabel(container, 'File actions')

    expect(document.activeElement).toBe(menu)
    expect(getHighlightedItem(container)).toBe(null)

    key(menu, 'ArrowDown')
    await settle(root)
    key(menu, 'Home')
    await settle(root)
    key(menu, 'End')
    await settle(root)

    expect(document.activeElement).toBe(menu)
    expect(getHighlightedItem(container)).toBe(null)
  })
})

describe.skip('typeahead and interaction contracts', () => {
  it('typeahead matches by visible text when the menu is open', async () => {
    let { container, root } = renderApp(renderStandardMenu())

    await openRootMenuWithKey(root, container, 'Enter')

    let menu = getMenuByLabel(container, 'File actions')
    key(menu, 'd')
    await settle(root)

    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Delete')
  })

  it('searchValue overrides and alias arrays participate in matching', async () => {
    let { container, root } = renderApp(renderSearchMenu())

    await openRootMenuWithKey(root, container, 'Enter')

    let menu = getMenuByLabel(container, 'Search actions')

    key(menu, 'c')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Quit')

    await advance(root, 751)

    key(menu, 'e')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Quit')
  })

  it('repeated typing builds a multi-character query', async () => {
    let { container, root } = renderApp(renderSearchMenu())

    await openRootMenuWithKey(root, container, 'Enter')

    let menu = getMenuByLabel(container, 'Search actions')

    key(menu, 's')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Save')

    key(menu, 'e')
    await settle(root)
    expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Settings')
  })

  it('Backspace edits the query, Escape clears it, and the timeout resets it after inactivity', async () => {
    {
      let { container, root } = renderApp(renderSearchMenu())

      await openRootMenuWithKey(root, container, 'Enter')

      let menu = getMenuByLabel(container, 'Search actions')
      let wrapper = getRootWrapper(container)

      key(menu, 's')
      await settle(root)
      key(menu, 'e')
      await settle(root)
      expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Settings')

      key(menu, 'Backspace')
      await settle(root)
      expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Save')

      key(wrapper, 'Escape')
      await settle(root)
      key(menu, 'r')
      await settle(root)
      expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Rename')
    }

    {
      let { container, root } = renderApp(renderSearchMenu())

      await openRootMenuWithKey(root, container, 'Enter')

      let menu = getMenuByLabel(container, 'Search actions')

      key(menu, 's')
      await settle(root)
      await advance(root, 751)
      key(menu, 'r')
      await settle(root)

      expect(getHighlightedItem(container)?.textContent?.trim()).toBe('Rename')
    }
  })

  it('typing while the menu is closed does nothing', async () => {
    let { container, root } = renderApp(renderSearchMenu())
    let trigger = getRootTrigger(container)

    key(getRootWrapper(container), 's')
    await settle(root)

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(getHighlightedItem(container)).toBe(null)
  })

  it('releasing the same pointer gesture that opened the menu over an item follows the intended press-drag contract', async () => {
    let { container, root } = renderApp(renderStandardMenu())
    let selections: Array<{ name: string; value: string }> = []
    container.addEventListener(Menu.select, (event) => {
      selections.push((event as MenuSelectEvent).item)
    })

    let trigger = getRootTrigger(container)
    let menu = getMenuByLabel(container, 'File actions')
    let deleteItem = getMenuItemByText(container, 'Delete')

    pointer(trigger, 'pointerdown')
    await settle(root)
    pointer(deleteItem, 'pointerup')
    await settle(root)

    expect(selections).toEqual([])
    expect(isPopoverOpen(getPopoverForMenu(menu))).toBe(true)
    expect(container.querySelector('[data-flash="true"]')).toBe(null)
  })
})
