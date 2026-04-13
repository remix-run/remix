// @jsxRuntime classic
// @jsx createElement
import {
  createElement,
  createMixin,
  keysEvents as keys,
  on,
  ref,
  type ElementProps,
  type Handle,
  type Props,
} from '@remix-run/component'
import { ui } from '../theme/theme.ts'
import { Glyph, type GlyphName } from '../glyph/glyph.tsx'
import { anchor } from '../anchor/anchor.ts'
import { waitForCssTransition } from '../utils/wait-for-css-transition.ts'
import { flashAttribute } from '../utils/flash-attribute.ts'
import { hiddenTypeahead, matchNextItemBySearchText } from '../typeahead/typeahead-mixin.tsx'
import { onOutsidePointerDown } from '../utils/outside-pointerdown.ts'
import { createHoverAim, type HoverAim } from './hover-aim.ts'

const MENU_SELECT_EVENT = 'rmx:select' as const
const NO_ITEM = Symbol('NO_ITEM')
const SUBMENU_OPEN_DELAY = 200
const POINTER_UP_SELECTION_DELAY = 200

declare global {
  interface HTMLElementEventMap {
    [MENU_SELECT_EVENT]: MenuSelectEvent
  }
}

export class MenuSelectEvent extends Event {
  readonly item: { name: string; value: string }
  constructor(item: InternalMenuItem) {
    super(MENU_SELECT_EVENT, { bubbles: true })
    this.item = { name: item.name, value: item.value ?? '' }
  }
}

type OpenStrategy = 'first' | 'last' | 'none'
type OpenOptions = {
  focus?: boolean
}
type HideOptions = {
  animate: boolean
}
type MenuState = 'closed' | 'open' | 'selecting' | 'dismissing'

export interface MenuProps extends Props<'div'> {
  label: string
}

type ActiveItemTarget = InternalMenuItem | typeof NO_ITEM | 'first' | 'last' | 'next' | 'previous'
type ActiveItem = InternalMenuItem | typeof NO_ITEM

function getItemId(item: ActiveItem | undefined) {
  return item !== undefined && item !== NO_ITEM ? item.id : undefined
}

function getItemNode(item: ActiveItem | undefined) {
  return item !== undefined && item !== NO_ITEM ? item.node : undefined
}

interface MenuContext {
  parent: MenuContext | null
  registerItem: (item: InternalMenuItem) => void
  registerTrigger: (trigger: TriggerRef, item?: InternalMenuItem) => void
  registerPopover: (popover: PopoverRef) => void
  registerList: (list: ListRef) => void
  consumeTriggerFocusSuppression: () => boolean
  consumePointerLeaveClearSuppression: () => boolean
  suppressNextPointerLeaveClear: () => void
  armPointerUpSelectionSuppression: () => void
  shouldIgnorePointerUpSelection: () => boolean
  hoverAim: HoverAim
  setActiveItem: (target: ActiveItemTarget) => Promise<void>
  setOpenChildMenu: (nextChild: MenuContext | null) => Promise<void>
  clearOpenChildMenu: (child: MenuContext) => void
  collapseSelf: () => Promise<void>
  collapseBranch: () => Promise<void>
  collapseBranchToTrigger: () => Promise<void>
  dismissTree: () => Promise<void>
  hideSelf: (options: HideOptions) => Promise<void>
  open: (strategy: OpenStrategy, options?: OpenOptions) => Promise<void>
  select: (item?: InternalMenuItem) => Promise<void>
  activeItem: ActiveItem
  openChildMenu: MenuContext | null
  isOpen: boolean
  id: string
  label: string
  popoverId: string
  get list(): ListRef
  get trigger(): TriggerRef
}

interface TriggerRef {
  node: HTMLElement
}

interface PopoverRef {
  node: HTMLElement
}

interface ListRef {
  node: HTMLElement
}

function MenuImpl(handle: Handle<MenuContext>) {
  let trigger: TriggerRef
  let popover: PopoverRef
  let list: ListRef
  let parent: MenuContext | null = null

  let items = new Map<string, InternalMenuItem>()
  let activeItem: ActiveItem = NO_ITEM
  let openChildMenu: MenuContext | null = null
  let triggerItem: InternalMenuItem | null = null

  let state: MenuState = 'closed'
  let suppressNextTriggerFocusOpen = false
  let suppressNextPointerLeaveClear = false
  let ignorePointerUpUntil = 0
  let hoverAim = createHoverAim()
  let cleanupAnchor = () => {}
  let self: MenuContext

  function getItems() {
    return Array.from(items.values())
  }

  function getEnabledItems() {
    return getItems().filter((item) => !item.disabled)
  }

  function isSameMenu(
    currentMenu: MenuContext | null | undefined,
    nextMenu: MenuContext | null | undefined,
  ) {
    return currentMenu?.id === nextMenu?.id
  }

  function isSameItem(currentItem: ActiveItem | undefined, nextItem: ActiveItem | undefined) {
    return currentItem === nextItem || getItemId(currentItem) === getItemId(nextItem)
  }

  function getItemSubmenu(item: ActiveItem | undefined) {
    return item !== undefined && item !== NO_ITEM ? (item.submenu ?? null) : null
  }

  function getRootMenu() {
    let currentMenu = self
    while (currentMenu.parent) {
      currentMenu = currentMenu.parent
    }
    return currentMenu
  }

  function getOpenChain() {
    let branch = [self]
    let currentMenu = self.openChildMenu
    while (currentMenu) {
      branch.push(currentMenu)
      currentMenu = currentMenu.openChildMenu
    }
    return branch
  }

  function armPointerUpSelectionSuppression() {
    if (parent) {
      parent.armPointerUpSelectionSuppression()
      return
    }

    ignorePointerUpUntil = Date.now() + POINTER_UP_SELECTION_DELAY
  }

  function shouldIgnorePointerUpSelection() {
    if (parent) {
      return parent.shouldIgnorePointerUpSelection()
    }

    return Date.now() < ignorePointerUpUntil
  }

  function setPopoverCloseAnimation(animate: boolean) {
    if (animate) {
      delete popover.node.dataset.closeAnimation
    } else {
      popover.node.dataset.closeAnimation = 'none'
    }
  }

  function consumeTriggerFocusSuppression() {
    if (!suppressNextTriggerFocusOpen) {
      return false
    }

    suppressNextTriggerFocusOpen = false
    return true
  }

  function consumePointerLeaveClearSuppression() {
    if (!suppressNextPointerLeaveClear) {
      return false
    }

    suppressNextPointerLeaveClear = false
    return true
  }

  function armPointerLeaveClearSuppression() {
    suppressNextPointerLeaveClear = true
  }

  function resolveActiveItemTarget(target: ActiveItemTarget) {
    if (target === NO_ITEM) {
      return NO_ITEM
    }

    if (typeof target !== 'string') {
      return target.disabled ? undefined : target
    }

    let enabledItems = getEnabledItems()
    if (enabledItems.length === 0) {
      return undefined
    }

    switch (target) {
      case 'first':
        return enabledItems[0]
      case 'last':
        return enabledItems[enabledItems.length - 1]
      case 'next': {
        if (activeItem === NO_ITEM) {
          return enabledItems[0]
        }

        let currentItem = activeItem
        let activeIndex = enabledItems.findIndex((item) => item.id === currentItem.id)
        if (activeIndex === -1) {
          return enabledItems[0]
        }

        return enabledItems[activeIndex + 1]
      }
      case 'previous': {
        if (activeItem === NO_ITEM) {
          return enabledItems[enabledItems.length - 1]
        }

        let currentItem = activeItem
        let activeIndex = enabledItems.findIndex((item) => item.id === currentItem.id)
        if (activeIndex === -1) {
          return enabledItems[enabledItems.length - 1]
        }

        return enabledItems[activeIndex - 1]
      }
    }
  }

  async function setOpenChildMenu(nextChild: MenuContext | null) {
    if (isSameMenu(openChildMenu, nextChild)) {
      return
    }

    let currentChild = openChildMenu
    openChildMenu = nextChild
    if (currentChild) {
      await currentChild.collapseSelf()
    }
  }

  function clearOpenChildMenu(child: MenuContext) {
    if (!isSameMenu(openChildMenu, child)) {
      return
    }

    openChildMenu = null
  }

  async function hideSelf(options: HideOptions) {
    if (state === 'closed') {
      return
    }

    setPopoverCloseAnimation(options.animate)
    if (options.animate) {
      await waitForCssTransition(popover.node, handle.signal, () => {
        popover.node.hidePopover()
      })
    } else {
      popover.node.hidePopover()
    }

    state = 'closed'
    suppressNextTriggerFocusOpen = false
    suppressNextPointerLeaveClear = false
    ignorePointerUpUntil = 0
    activeItem = NO_ITEM
    openChildMenu = null
    cleanupAnchor()
    parent?.clearOpenChildMenu(self)
    await handle.update()
  }

  async function collapseBranch() {
    let childMenu = openChildMenu
    if (!childMenu) {
      return
    }

    openChildMenu = null
    await childMenu.collapseSelf()
  }

  async function collapseSelf() {
    await collapseBranch()
    await hideSelf({ animate: false })
  }

  async function collapseBranchToTrigger() {
    if (!parent || !triggerItem) {
      return
    }

    let parentMenu = parent
    let trigger = triggerItem

    async function focusTriggerItem() {
      if (isSameItem(parentMenu.activeItem, trigger)) {
        trigger.node.focus()
      } else {
        await parentMenu.setActiveItem(trigger)
      }
    }

    parentMenu.suppressNextPointerLeaveClear()
    suppressNextTriggerFocusOpen = true
    await focusTriggerItem()
    await collapseSelf()
    await Promise.resolve()
    await focusTriggerItem()
  }

  async function dismissTree() {
    let rootMenu = getRootMenu()
    if (!isSameMenu(rootMenu, self)) {
      await rootMenu.dismissTree()
      return
    }

    if (state === 'dismissing') {
      return
    }

    let previousState = state
    state = 'dismissing'
    try {
      await Promise.all(getOpenChain().map((menu) => menu.hideSelf({ animate: true })))
      trigger.node.focus()
    } finally {
      if (state === 'dismissing') {
        state = previousState === 'closed' ? 'closed' : 'open'
      }
    }
  }

  async function open(strategy: OpenStrategy, options: OpenOptions = {}) {
    if (state === 'selecting') return

    if (parent) {
      await parent.setOpenChildMenu(self)
    }

    let resolvedTarget = strategy === 'none' ? NO_ITEM : resolveActiveItemTarget(strategy)
    let nextItem = resolvedTarget ?? NO_ITEM
    let shouldUpdate = state === 'closed' || !isSameItem(activeItem, nextItem)

    activeItem = nextItem
    if (state === 'closed') {
      setPopoverCloseAnimation(true)
      popover.node.showPopover()
      cleanupAnchor = anchor(popover.node, trigger.node, {
        placement: parent ? 'right-start' : 'bottom-start',
        offset: parent ? -4 : 6,
      })
      state = 'open'
    }

    if (shouldUpdate) {
      await handle.update()
    }

    if (options.focus === false) {
      return
    }

    if (activeItem === NO_ITEM) {
      list.node.focus()
    } else {
      activeItem.node.focus()
    }
  }

  async function select(item = activeItem) {
    if (state === 'selecting') return
    if (item === NO_ITEM) return
    if (item.disabled) return

    state = 'selecting'
    await flashAttribute(item.node, 'data-flash', 60)
    item.node.dispatchEvent(new MenuSelectEvent(item))
    await dismissTree()
  }

  function registerItem(item: InternalMenuItem) {
    items.set(item.id, item)
  }

  async function collapseChildMenuWithPointerLeaveSuppression(childMenu: MenuContext | null) {
    if (!childMenu) {
      return
    }

    armPointerLeaveClearSuppression()
    await childMenu.collapseSelf()
  }

  async function setActiveItem(target: ActiveItemTarget) {
    if (state === 'selecting') return

    let resolvedTarget = resolveActiveItemTarget(target)
    if (resolvedTarget === undefined) {
      return
    }

    let nextItem = resolvedTarget ?? NO_ITEM
    let nextChildMenu = getItemSubmenu(nextItem)
    let childMenuToCollapse =
      openChildMenu && !isSameMenu(openChildMenu, nextChildMenu) ? openChildMenu : null
    let shouldUpdate = !isSameItem(activeItem, nextItem)
    let focusTarget = nextItem === NO_ITEM ? list.node : nextItem.node
    let shouldFocus =
      nextItem === NO_ITEM ? shouldUpdate : shouldUpdate || document.activeElement !== nextItem.node
    activeItem = nextItem

    if (shouldUpdate) {
      await handle.update()
    }

    if (shouldFocus) {
      focusTarget.focus()
    }

    await collapseChildMenuWithPointerLeaveSuppression(childMenuToCollapse)
  }

  function setMatchingItemActive(text: string) {
    let enabledItems = getEnabledItems()
    let currentIndex = enabledItems.findIndex((item) => item.id === getItemId(activeItem))
    let item = matchNextItemBySearchText(text, enabledItems, {
      fromIndex: currentIndex,
      getSearchValues: (item) => item.searchValue,
    })
    if (item) {
      void setActiveItem(item)
    }
  }

  return (props: MenuProps) => {
    items = new Map()
    parent = handle.context.get(Menu) ?? null
    let { children, label, mix, ...domProps } = props
    let menuId = `${handle.id}-menu`
    let popoverId = `${handle.id}-popover`

    self = {
      get parent() {
        return parent
      },
      registerItem,
      registerTrigger(_trigger, item) {
        trigger = _trigger
        triggerItem = item ?? null
      },
      registerPopover(_popover) {
        popover = _popover
      },
      registerList(_list) {
        list = _list
      },
      consumeTriggerFocusSuppression,
      consumePointerLeaveClearSuppression,
      suppressNextPointerLeaveClear: armPointerLeaveClearSuppression,
      armPointerUpSelectionSuppression,
      shouldIgnorePointerUpSelection,
      hoverAim,
      setActiveItem,
      setOpenChildMenu,
      clearOpenChildMenu,
      collapseSelf,
      collapseBranch,
      collapseBranchToTrigger,
      dismissTree,
      hideSelf,
      open,
      select,
      get activeItem() {
        return activeItem
      },
      get openChildMenu() {
        return openChildMenu
      },
      get isOpen() {
        return state !== 'closed'
      },
      id: menuId,
      label,
      popoverId,
      get list() {
        return list
      },
      get trigger() {
        return trigger
      },
    }
    handle.context.set(self)

    return (
      <div
        {...domProps}
        mix={[
          hiddenTypeahead((text) => {
            if (state === 'closed') return
            setMatchingItemActive(text)
          }),
          on('keydown', (event) => {
            if (parent && event.target instanceof Node && list.node.contains(event.target)) {
              event.stopPropagation()
            }
          }),
          !parent &&
            state !== 'closed' &&
            onOutsidePointerDown((event) => {
              event.preventDefault() // bring focus back to the trigger
              void dismissTree()
            }),
          mix,
        ]}
      >
        {children}
      </div>
    )
  }
}

export const Menu = Object.assign(MenuImpl, {
  select: MENU_SELECT_EVENT,
})

export const menuButtonMixin = createMixin<HTMLElement, [], ElementProps>((handle) => (props) => {
  let menu = handle.context.get(Menu)

  return (
    <handle.element
      {...props}
      aria-controls={menu.id}
      aria-haspopup="menu"
      aria-expanded={menu.isOpen}
      mix={[
        ref((node) => {
          menu.registerTrigger({ node })
        }),
        keys(),
        on(keys.arrowDown, () => {
          void menu.open('first')
        }),
        on(keys.arrowUp, () => {
          void menu.open('last')
        }),
        on(keys.space, () => {
          void menu.open('none')
        }),
        on(keys.enter, () => {
          void menu.open('none')
        }),
        on('pointerdown', (event) => {
          if (event.button !== 0) return
          if (menu.isOpen) {
            void menu.dismissTree()
          } else {
            menu.armPointerUpSelectionSuppression()
            void menu.open('none')
          }
        }),
      ]}
    />
  )
})

export function MenuButton() {
  return (props: Omit<Props<'button'>, 'type'>) => {
    let { children, mix, ...domProps } = props

    return (
      <button {...domProps} type="button" mix={[ui.menu.button, menuButtonMixin(), mix]}>
        <span mix={ui.button.label}>{children}</span>
        <Glyph mix={ui.button.icon} name="chevronDown" />
      </button>
    )
  }
}

type InternalMenuItem = {
  value?: string
  name: string
  id: string
  disabled: boolean
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'option'
  submenu?: MenuContext
  get node(): HTMLElement
  get searchValue(): string | string[]
}

export const menuPopoverMixin = createMixin<HTMLElement>((handle) => (props) => {
  let menu = handle.context.get(Menu)

  return (
    <handle.element
      {...props}
      popover="manual"
      id={menu.popoverId}
      mix={[
        ref((node) => {
          menu.registerPopover({ node })
        }),
      ]}
    />
  )
})

export const menuListMixin = createMixin<HTMLElement>((handle) => (props) => {
  let menu = handle.context.get(Menu)

  return (
    <handle.element
      {...props}
      aria-label={menu.label}
      role="menu"
      id={menu.id}
      tabIndex={-1}
      mix={[
        ref((node) => {
          menu.registerList({ node })
        }),
        keys(),
        on(keys.arrowDown, () => {
          void menu.setActiveItem('next')
        }),
        on(keys.arrowUp, () => {
          void menu.setActiveItem('previous')
        }),
        on(keys.home, () => {
          void menu.setActiveItem('first')
        }),
        on(keys.end, () => {
          void menu.setActiveItem('last')
        }),
        menu.parent
          ? on(keys.arrowLeft, () => {
              void menu.collapseBranchToTrigger()
            })
          : undefined,
        on(keys.escape, () => {
          void menu.dismissTree()
        }),
        on('pointerleave', (event) => {
          let activeElement = document.activeElement
          if (menu.openChildMenu) {
            return
          } else if (menu.consumePointerLeaveClearSuppression()) {
            return
          } else if (
            activeElement !== event.currentTarget &&
            activeElement !== getItemNode(menu.activeItem)
          ) {
            return
          }

          void menu.setActiveItem(NO_ITEM)
        }),
      ]}
    />
  )
})

export function MenuList() {
  return (props: Props<'div'>) => {
    let { children, mix, ...domProps } = props
    return (
      <div mix={[ui.menu.popover, menuPopoverMixin()]}>
        <div {...domProps} mix={[ui.menu.list, menuListMixin(), mix]}>
          {children}
        </div>
      </div>
    )
  }
}

export interface SubmenuTriggerProps extends Props<'div'> {
  glyph?: string
  name?: string
  searchValue?: string | string[]
  disabled?: boolean
}

type SubmenuTriggerMixinOptions = Pick<SubmenuTriggerProps, 'name' | 'searchValue' | 'disabled'>

export const submenuTriggerMixin = createMixin<
  HTMLElement,
  [options: SubmenuTriggerMixinOptions],
  ElementProps
>((handle) => {
  let openTimer = 0
  let node: HTMLElement

  function clearPendingOpen() {
    clearTimeout(openTimer)
  }

  handle.addEventListener('remove', clearPendingOpen)

  return (options, props) => {
    let menu = handle.context.get(Menu)
    let parent = menu.parent
    if (!parent) {
      throw new Error('SubmenuTrigger must be rendered inside a nested Menu')
    }

    let disabled = options.disabled === true
    let item = {
      name: options.name ?? handle.id,
      disabled,
      role: 'menuitem',
      submenu: menu,
      get node() {
        return node
      },
      id: handle.id,
      get searchValue() {
        return options.searchValue ?? node.textContent?.trim() ?? ''
      },
    } satisfies InternalMenuItem

    parent.registerItem(item)

    let isActive = !disabled && getItemId(parent.activeItem) === item.id

    return (
      <handle.element
        {...props}
        aria-controls={menu.id}
        aria-disabled={disabled ? true : undefined}
        aria-expanded={menu.isOpen}
        aria-haspopup="menu"
        data-highlighted={isActive ? 'true' : 'false'}
        id={item.id}
        role="menuitem"
        tabIndex={-1}
        mix={[
          keys(),
          ref((_node) => {
            node = _node
            menu.registerTrigger({ node }, item)
          }),
          on('blur', () => {
            clearPendingOpen()
          }),
          on('focus', () => {
            if (disabled) return
            void parent.setActiveItem(item)

            if (menu.consumeTriggerFocusSuppression()) {
              return
            }

            clearPendingOpen()
            openTimer = window.setTimeout(() => {
              if (document.activeElement !== node) {
                return
              }
              void menu.open('none', { focus: false })
            }, SUBMENU_OPEN_DELAY)
          }),
          on('pointermove', (event) => {
            if (disabled) return
            if (!parent.hoverAim.accepts(event)) {
              return
            }

            void parent.setActiveItem(item)
          }),
          on('pointerleave', (event) => {
            if (!menu.isOpen) {
              return
            }

            parent.hoverAim.start(menu.list.node, event, () => {
              if (getItemId(parent.activeItem) !== item.id) {
                return
              }

              if (parent.openChildMenu?.id !== menu.id) {
                return
              }

              let activeElement = document.activeElement
              if (activeElement !== item.node && activeElement !== parent.list.node) {
                return
              }

              void parent.setActiveItem(NO_ITEM)
            })
          }),
          on(keys.arrowRight, () => {
            if (disabled) return
            clearPendingOpen()
            void menu.open('first')
          }),
        ]}
      />
    )
  }
})

export function SubmenuTrigger() {
  return (props: SubmenuTriggerProps) => {
    let { children, disabled, glyph, mix, name, searchValue, ...domProps } = props

    return (
      <div
        {...domProps}
        mix={[ui.menu.trigger, submenuTriggerMixin({ disabled, name, searchValue }), mix]}
      >
        <span mix={ui.menu.itemLabel}>{children}</span>
        <Glyph mix={ui.menu.triggerGlyph} name={(glyph ?? 'chevronRight') as GlyphName} />
      </div>
    )
  }
}

export interface MenuItemProps extends Props<'div'> {
  searchValue?: string | string[]
  name: string
  value?: string
  disabled?: boolean
  role?: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio' | 'option'
}

type MenuItemMixinOptions = Pick<
  MenuItemProps,
  'disabled' | 'name' | 'role' | 'searchValue' | 'value'
>

export const menuItemMixin = createMixin<
  HTMLElement,
  [options: MenuItemMixinOptions],
  ElementProps
>((handle) => {
  let node: HTMLElement

  return (options, props) => {
    let menu = handle.context.get(Menu)

    let disabled = options.disabled === true
    let role = options.role ?? 'menuitem'

    let item = {
      value: options.value,
      name: options.name,
      disabled,
      role,
      get node() {
        return node
      },
      id: handle.id,
      get searchValue() {
        return options.searchValue ?? node.textContent?.trim() ?? ''
      },
    }

    menu.registerItem(item)

    let isActive = !disabled && getItemId(menu.activeItem) === item.id

    return (
      <handle.element
        {...props}
        aria-disabled={disabled ? true : undefined}
        data-highlighted={isActive ? 'true' : 'false'}
        id={item.id}
        role={role}
        tabIndex={-1}
        mix={[
          keys(),
          ref((_node) => {
            node = _node
          }),
          on('pointermove', (event) => {
            if (disabled) return
            if (!menu.hoverAim.accepts(event)) {
              return
            }

            void menu.setActiveItem(item)
          }),
          on(keys.enter, () => {
            void menu.select()
          }),
          on(keys.space, () => {
            void menu.select()
          }),
          on('pointerup', (event) => {
            if (event.button !== 0) return
            if (menu.shouldIgnorePointerUpSelection()) return
            void menu.select(item)
          }),
          on('click', (event) => {
            if (event.button !== 0) return
            void menu.select(item)
          }),
        ]}
      />
    )
  }
})

export function MenuItem() {
  return (props: MenuItemProps) => {
    let { children, disabled, mix, name, role, searchValue, value, ...domProps } = props

    return (
      <div
        {...domProps}
        mix={[ui.menu.item, menuItemMixin({ disabled, name, role, searchValue, value }), mix]}
      >
        {children}
      </div>
    )
  }
}
