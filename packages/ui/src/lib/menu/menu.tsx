// @jsxRuntime classic
// @jsx createElement
import {
  attrs,
  createElement,
  createMixin,
  css,
  on,
  ref,
  type CSSMixinDescriptor,
  type ElementProps,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/component'
import { type AnchorOptions } from '../anchor/anchor.ts'
import * as button from '../button/button.tsx'
import { Glyph } from '../glyph/glyph.tsx'
import * as popover from '../popover/popover.ts'
import { theme } from '../theme/theme.ts'
import {
  hiddenTypeahead,
  matchNextItemBySearchText,
  type SearchValue,
} from '../typeahead/typeahead-mixin.ts'
import { waitForCssTransition } from '../utils/wait-for-css-transition.ts'
import { wait } from '../utils/wait.ts'
import { createHoverAim } from './hover-aim.ts'

const MENU_SELECT_EVENT = 'rmx:menu-select' as const
const MENU_FLASH_DURATION_MS = 60
const SUBMENU_OPEN_DELAY_MS = 300
const SUBMENU_ANCHOR_RELATIVE_TO = '[role="menu"] > [role^="menuitem"]'

type MenuSelectHandler = (event: MenuSelectEvent, signal: AbortSignal) => void | Promise<void>

const menuButtonCss: CSSMixinDescriptor = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  borderRadius: theme.radius.md,
  paddingInlineEnd: theme.space.sm,
  textAlign: 'left',
  '&[aria-expanded="true"], &[aria-expanded="true"]:hover, &[aria-expanded="true"]:focus-visible': {
    backgroundColor: theme.surface.lvl3,
    color: theme.colors.text.primary,
  },
})

const menuPopoverCss: CSSMixinDescriptor = css({
  '&[data-menu-submenu="true"][data-anchor-placement^="right"]': {
    marginLeft: `calc(${theme.space.xs} * -1)`,
  },
  '&[data-menu-submenu="true"][data-anchor-placement^="left"]': {
    marginLeft: theme.space.xs,
  },
  '&[data-close-animation="none"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})

const menuListCss: CSSMixinDescriptor = css({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  paddingBlock: theme.space.xs,
  paddingInline: theme.space.none,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  outline: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  '--rmx-ui-item-inset': `calc(${theme.space.sm} + ${theme.space.xs})`,
  '--rmx-ui-item-indicator-gap': 'var(--rmx-menu-item-slot-gap)',
  '--rmx-ui-item-indicator-width': 'var(--rmx-menu-item-slot-width)',
  '--rmx-menu-item-slot-gap': theme.space.none,
  '--rmx-menu-item-slot-width': theme.space.none,
  '&:has(> [role="menuitemcheckbox"])': {
    '--rmx-menu-item-slot-gap': theme.space.xs,
    '--rmx-menu-item-slot-width': theme.fontSize.md,
  },
  '&:has(> [role="menuitemradio"])': {
    '--rmx-menu-item-slot-gap': theme.space.xs,
    '--rmx-menu-item-slot-width': theme.fontSize.md,
  },
})

const menuItemCss: CSSMixinDescriptor = css({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minWidth: 0,
  minHeight: theme.control.height.md,
  boxSizing: 'border-box',
  position: 'relative',
  isolation: 'isolate',
  paddingInline: `calc(${theme.space.sm} + ${theme.space.xs})`,
  color: theme.colors.text.primary,
  fontFamily: theme.fontFamily.sans,
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.normal,
  lineHeight: theme.lineHeight.normal,
  textAlign: 'left',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  '--rmx-menu-item-indicator-opacity': '0',
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlock: 0,
    insetInline: theme.space.xs,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    zIndex: -1,
  },
  '&:focus': {
    outline: 'none',
  },
  '&[data-highlighted="true"]': {
    color: theme.colors.action.primary.foreground,
  },
  '&[data-highlighted="true"]::before': {
    backgroundColor: theme.colors.action.primary.background,
  },
  '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)': {
    color: theme.colors.text.primary,
  },
  '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)::before': {
    backgroundColor: theme.surface.lvl2,
  },
  '&[data-submenu-state="selecting"], &[data-submenu-state="dismissing"]': {
    color: theme.colors.text.primary,
  },
  '&[data-submenu-state="selecting"]::before, &[data-submenu-state="dismissing"]::before': {
    backgroundColor: theme.surface.lvl2,
  },
  '&[data-menu-flash="true"]': {
    color: theme.colors.text.primary,
  },
  '&[data-menu-flash="true"]::before': {
    backgroundColor: 'transparent',
  },
  '&[aria-disabled="true"]': {
    opacity: 0.5,
  },
  '&[aria-checked="true"], &[aria-selected="true"]': {
    '--rmx-menu-item-indicator-opacity': '1',
  },
})

const menuItemSlotCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 var(--rmx-menu-item-slot-width)',
  width: 'var(--rmx-menu-item-slot-width)',
  minWidth: 0,
  marginInlineEnd: 'var(--rmx-menu-item-slot-gap)',
  overflow: 'hidden',
})

const menuItemLabelCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  flex: '1 1 auto',
  minWidth: 0,
})

const menuItemGlyphCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.fontSize.md,
  height: theme.fontSize.md,
  color: 'currentColor',
  flexShrink: 0,
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  opacity: 'var(--rmx-menu-item-indicator-opacity)',
})

const menuTriggerGlyphCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.fontSize.md,
  height: theme.fontSize.md,
  color: 'currentColor',
  flexShrink: 0,
  marginInlineStart: 'auto',
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
})

export const buttonStyle = menuButtonCss
export const popoverStyle = menuPopoverCss
export const listStyle = menuListCss
export const itemStyle = menuItemCss
export const itemSlotStyle = menuItemSlotCss
export const itemLabelStyle = menuItemLabelCss
export const itemGlyphStyle = menuItemGlyphCss
export const triggerGlyphStyle = menuTriggerGlyphCss

declare global {
  interface HTMLElementEventMap {
    [MENU_SELECT_EVENT]: MenuSelectEvent
  }
}

type MenuItemType = 'item' | 'checkbox' | 'radio'
type CloseAnimation = 'fade' | 'none'
type OpenStrategy = 'first' | 'last' | 'list' | 'none'

enum NavigationStrategy {
  Next = 0,
  Previous = 1,
  First = 2,
  Last = 3,
}

enum State {
  Idle = 'idle',
  Dismissing = 'dismissing',
  Selecting = 'selecting',
}

export interface MenuSelectItem {
  checked?: boolean
  id: string
  label: string
  name: string
  type: MenuItemType
  value: string | null
}

export class MenuSelectEvent extends Event {
  readonly item: MenuSelectItem

  constructor(item: MenuSelectItem) {
    super(MENU_SELECT_EVENT, { bubbles: true })
    this.item = item
  }
}

export interface MenuProviderProps {
  children?: RemixNode
  label?: string
}

export interface MenuTriggerOptions extends AnchorOptions {}

export interface MenuItemOptions {
  checked?: boolean
  disabled?: boolean
  label?: string
  name: string
  searchValue?: SearchValue
  type?: Exclude<MenuItemType, 'item'>
  value?: string
}

export interface SubmenuTriggerOptions {
  disabled?: boolean
  label?: string
  searchValue?: SearchValue
  value?: string
}

type OpenMenuOptions = {
  focus?: boolean
  strategy?: OpenStrategy
}

type CloseBranchOptions = {
  focusTrigger?: boolean
}

type CloseAllOptions = {
  focusRoot?: boolean
}

type CloseSyncOptions = {
  animation?: CloseAnimation
}

type HighlightOptions = {
  focus?: boolean
}

type FlashState = {
  checked?: boolean
  id: string
} | null

interface RegisteredMenuItem {
  checked?: boolean
  disabled?: boolean
  id: string
  searchValue?: SearchValue
  submenu?: MenuContextValue
  type: MenuItemType
  value?: string
  name?: string
  readonly hidden: boolean
  readonly label: string
  readonly node: HTMLElement
}

interface MenuContextValue {
  readonly activeId: string | undefined
  readonly closeAnimation: CloseAnimation
  readonly flashingChecked: boolean | undefined
  readonly flashingId: string | undefined
  readonly isOpen: boolean
  readonly isRoot: boolean
  readonly label: string | undefined
  readonly listId: string
  readonly parent: MenuContextValue | undefined
  readonly root: MenuContextValue
  readonly state: State
  readonly surfaceNode: HTMLElement | undefined
  readonly triggerId: string | undefined
  activateActive: () => Promise<void>
  activateItem: (id: string) => Promise<void>
  allowsPointer: (event: PointerEvent) => boolean
  closeAll: (options?: CloseAllOptions) => Promise<void>
  closeBranch: (options?: CloseBranchOptions) => Promise<void>
  closeSync: (updates: Promise<AbortSignal>[], options?: CloseSyncOptions) => void
  consumePointerLeaveClearSuppression: () => boolean
  finishDismissalSync: (updates: Promise<AbortSignal>[]) => void
  getOpenChild: () => MenuContextValue | undefined
  hasOpenChild: () => boolean
  highlight: (id: string | null, options?: HighlightOptions) => void
  highlightSearchMatch: (text: string) => void
  navigate: (strategy: NavigationStrategy) => void
  openActiveSubmenu: () => Promise<void>
  open: (options?: OpenMenuOptions) => Promise<void>
  registerChild: (menu: MenuContextValue) => void
  registerItem: (item: RegisteredMenuItem) => void
  registerList: (node: HTMLElement) => void
  registerSurface: (node: HTMLElement) => void
  registerTrigger: (node: HTMLElement, id: string) => void
  suppressNextPointerLeaveClear: () => void
  startHoverAim: (
    source: HTMLElement | null,
    target: HTMLElement | null,
    event: PointerEvent,
  ) => boolean
  unregisterList: (node: HTMLElement) => void
  unregisterSurface: (node: HTMLElement) => void
  unregisterTrigger: (node: HTMLElement) => void
}

function isPrintableKey(event: KeyboardEvent) {
  return event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey
}

function normalizeText(text: string | null | undefined) {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

function getItemLabel(node: HTMLElement | undefined, label?: string) {
  return normalizeText(label ?? node?.textContent)
}

function getItemRole(type: MenuItemType) {
  switch (type) {
    case 'checkbox':
      return 'menuitemcheckbox'
    case 'radio':
      return 'menuitemradio'
    default:
      return 'menuitem'
  }
}

function eventBelongsToCurrentMenu(event: Event) {
  if (!(event.target instanceof Element) || !(event.currentTarget instanceof Element)) {
    return false
  }

  return event.target.closest('[role="menu"]') === event.currentTarget
}

function shouldClearHighlightOnPointerLeave(event: PointerEvent) {
  if (!(event.currentTarget instanceof Element)) {
    return false
  }

  if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
    return false
  }

  if (!(event.relatedTarget instanceof Element)) {
    return true
  }

  let currentMenu = event.currentTarget.closest('[role="menu"]')
  let nextItem = event.relatedTarget.closest('[role^="menuitem"]')

  return !currentMenu || !nextItem || nextItem.closest('[role="menu"]') !== currentMenu
}

function focusNode(node: HTMLElement | undefined) {
  if (!node || !node.isConnected || document.activeElement === node) {
    return
  }

  node.focus()

  if ('scrollIntoView' in node) {
    node.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }
}

function MenuProvider(handle: Handle<MenuProviderProps, MenuContextValue>) {
  let parent = handle.context.get(MenuProvider)

  let activeId: string | null = null
  let childMenus: MenuContextValue[] = []
  let closeAnimation: CloseAnimation = 'none'
  let flashState: FlashState = null
  let items: RegisteredMenuItem[] = []
  let listRef: HTMLElement | undefined
  let open = false
  let state = State.Idle
  let suppressNextPointerLeaveClear = false
  let surfaceRef: HTMLElement | undefined
  let triggerId: string | undefined
  let triggerRef: HTMLElement | undefined

  let hoverAim = createHoverAim()

  function getItem(id: string | null | undefined) {
    return items.find((item) => item.id === id)
  }

  function isVisibleItem(item: RegisteredMenuItem | undefined): item is RegisteredMenuItem {
    return !!item?.node?.isConnected && !item.hidden
  }

  function isInteractableItem(item: RegisteredMenuItem | undefined): item is RegisteredMenuItem {
    return isVisibleItem(item) && !item.disabled
  }

  function getInteractableItems() {
    return items.filter(isInteractableItem)
  }

  function getOpenChild() {
    return childMenus.find((menu) => menu.isOpen)
  }

  function closeChildrenSync(
    updates: Promise<AbortSignal>[],
    options: CloseSyncOptions = { animation: 'none' },
  ) {
    for (let child of childMenus) {
      child.closeSync(updates, options)
    }
  }

  function focusOpenStrategy(strategy: OpenStrategy, nextActiveId: string | null) {
    let activeItem = getItem(nextActiveId)

    if (strategy === 'list' || strategy === 'none' || !isInteractableItem(activeItem)) {
      focusNode(listRef)
      return
    }

    focusNode(activeItem.node)
  }

  async function openMenu({
    strategy = 'list',
    focus = strategy !== 'none',
  }: OpenMenuOptions = {}) {
    if (state !== State.Idle) {
      return
    }

    let updates: Promise<AbortSignal>[] = []
    closeChildrenSync(updates, { animation: 'none' })

    let nextActiveId: string | null = null
    let interactableItems = getInteractableItems()

    if (strategy === 'first') {
      nextActiveId = interactableItems[0]?.id ?? null
    } else if (strategy === 'last') {
      nextActiveId = interactableItems[interactableItems.length - 1]?.id ?? null
    }

    let shouldUpdate = !open || activeId !== nextActiveId
    open = true
    activeId = nextActiveId

    if (shouldUpdate) {
      updates.push(handle.update())
    }

    if (updates.length > 0) {
      let signals = await Promise.all(updates)
      if (signals.some((signal) => signal.aborted)) {
        return
      }
    }

    if (focus) {
      focusOpenStrategy(strategy, nextActiveId)
    }
  }

  function closeSync(
    updates: Promise<AbortSignal>[],
    { animation = 'none' }: CloseSyncOptions = {},
  ) {
    let wasOpen = open
    closeAnimation = animation
    closeChildrenSync(updates, { animation })

    if (!open && (animation === 'fade' || activeId === null)) {
      return
    }

    open = false
    if (animation === 'none') {
      activeId = null
      state = State.Idle
    } else if (wasOpen && state === State.Idle) {
      state = State.Dismissing
    }
    updates.push(handle.update())
  }

  function finishDismissalSync(updates: Promise<AbortSignal>[]) {
    for (let child of childMenus) {
      child.finishDismissalSync(updates)
    }

    if (open) {
      return
    }

    let shouldUpdate = false

    if (activeId !== null) {
      activeId = null
      shouldUpdate = true
    }

    if (state !== State.Idle) {
      state = State.Idle
      shouldUpdate = true
    }

    if (closeAnimation !== 'none') {
      closeAnimation = 'none'
      shouldUpdate = true
    }

    if (shouldUpdate) {
      updates.push(handle.update())
    }
  }

  async function closeBranch({ focusTrigger = false }: CloseBranchOptions = {}) {
    let updates: Promise<AbortSignal>[] = []
    closeSync(updates, { animation: 'none' })

    if (updates.length > 0) {
      let signals = await Promise.all(updates)
      if (signals.some((signal) => signal.aborted)) {
        return
      }
    }

    if (focusTrigger) {
      parent?.suppressNextPointerLeaveClear()
      focusNode(triggerRef)
    }
  }

  async function closeAll({ focusRoot = true }: CloseAllOptions = {}) {
    if (parent) {
      await context.root.closeAll({ focusRoot })
      return
    }

    let shouldWaitForTransition = open && !!surfaceRef?.isConnected
    let updates: Promise<AbortSignal>[] = []
    closeSync(updates, { animation: 'fade' })

    if (updates.length > 0) {
      let signals = await Promise.all(updates)
      if (signals.some((signal) => signal.aborted)) {
        return
      }
    }

    if (shouldWaitForTransition && surfaceRef?.isConnected) {
      await waitForCssTransition(surfaceRef, handle.signal)
    }

    updates = []
    finishDismissalSync(updates)

    if (updates.length > 0) {
      let signals = await Promise.all(updates)
      if (signals.some((signal) => signal.aborted)) {
        return
      }
    }

    if (focusRoot) {
      focusNode(triggerRef)
    }
  }

  function highlight(id: string | null, { focus = false }: HighlightOptions = {}) {
    if (state !== State.Idle) {
      return
    }

    let nextItem = id ? getItem(id) : undefined

    if (id && !isInteractableItem(nextItem)) {
      return
    }

    let updates: Promise<AbortSignal>[] = []
    let openChild = getOpenChild()

    if (openChild && nextItem?.submenu !== openChild) {
      openChild.closeSync(updates, { animation: 'none' })
    }

    if (activeId !== id) {
      activeId = id
      updates.push(handle.update())
    }

    if (!focus) {
      return
    }

    let focusTarget = nextItem?.node

    if (updates.length === 0) {
      focusNode(focusTarget)
      return
    }

    void Promise.all(updates).then((signals) => {
      if (signals.some((signal) => signal.aborted)) {
        return
      }

      focusNode(focusTarget)
    })
  }

  function navigate(strategy: NavigationStrategy) {
    if (state !== State.Idle) {
      return
    }

    let interactableItems = getInteractableItems()
    let activeIndex = interactableItems.findIndex((item) => item.id === activeId)
    let nextItem: RegisteredMenuItem | undefined

    switch (strategy) {
      case NavigationStrategy.Next:
        nextItem =
          activeIndex === -1
            ? interactableItems[0]
            : (interactableItems[activeIndex + 1] ?? interactableItems[activeIndex])
        break
      case NavigationStrategy.Previous:
        nextItem =
          activeIndex === -1
            ? interactableItems[interactableItems.length - 1]
            : interactableItems[activeIndex - 1]
        break
      case NavigationStrategy.First:
        nextItem = interactableItems[0]
        break
      case NavigationStrategy.Last:
        nextItem = interactableItems[interactableItems.length - 1]
        break
    }

    if (nextItem) {
      highlight(nextItem.id, { focus: true })
    }
  }

  function highlightSearchMatch(text: string) {
    if (state !== State.Idle) {
      return
    }

    let interactableItems = getInteractableItems()
    let activeIndex = interactableItems.findIndex((item) => item.id === activeId)
    let nextItem = matchNextItemBySearchText(text, interactableItems, {
      fromIndex: activeIndex,
      getSearchValues(item) {
        return item.searchValue ?? item.label
      },
    })

    if (nextItem) {
      highlight(nextItem.id, { focus: true })
    }
  }

  async function activateItem(id: string) {
    if (state !== State.Idle) {
      return
    }

    let item = getItem(id)
    if (!isInteractableItem(item)) {
      return
    }

    if (item.submenu) {
      await item.submenu.open({ strategy: 'first' })
      return
    }

    let committedChecked =
      item.type === 'checkbox' ? !item.checked : item.type === 'radio' ? true : undefined

    state = State.Selecting
    activeId = item.id
    flashState = item.type === 'item' ? { id: item.id } : { checked: committedChecked, id: item.id }
    let signal = await handle.update()
    if (signal.aborted) {
      return
    }

    item.node.dispatchEvent(
      new MenuSelectEvent({
        checked: committedChecked,
        id: item.id,
        label: item.label,
        name: item.name!,
        type: item.type,
        value: item.value ?? null,
      }),
    )

    await wait(MENU_FLASH_DURATION_MS)
    if (handle.signal.aborted) {
      return
    }

    flashState = null
    signal = await handle.update()
    if (signal.aborted) {
      return
    }

    await closeAll()

    state = State.Idle
    signal = await handle.update()
    if (signal.aborted) {
      return
    }
  }

  async function activateActive() {
    if (!activeId) {
      return
    }

    await activateItem(activeId)
  }

  async function openActiveSubmenu() {
    if (state !== State.Idle) {
      return
    }

    if (!activeId) {
      return
    }

    let item = getItem(activeId)
    if (!isInteractableItem(item) || !item.submenu) {
      return
    }

    await item.submenu.open({ strategy: 'first' })
  }

  let context: MenuContextValue = {
    get activeId() {
      return activeId ?? undefined
    },

    get closeAnimation() {
      return closeAnimation
    },

    get flashingChecked() {
      return flashState?.checked
    },

    get flashingId() {
      return flashState?.id
    },

    get isOpen() {
      return open
    },

    get isRoot() {
      return !parent
    },

    get label() {
      return handle.props.label
    },

    get listId() {
      return `${handle.id}-list`
    },

    get parent() {
      return parent
    },

    get root() {
      return parent?.root ?? context
    },

    get state() {
      return state
    },

    get surfaceNode() {
      return surfaceRef
    },

    get triggerId() {
      return triggerId
    },

    activateActive,

    activateItem,

    allowsPointer(event) {
      return hoverAim.accepts(event)
    },

    closeAll,

    closeBranch,

    closeSync,

    consumePointerLeaveClearSuppression() {
      if (!suppressNextPointerLeaveClear) {
        return false
      }

      suppressNextPointerLeaveClear = false
      return true
    },

    finishDismissalSync,

    getOpenChild,

    hasOpenChild() {
      return !!getOpenChild()
    },

    highlight,

    highlightSearchMatch,

    navigate,

    openActiveSubmenu,

    open: openMenu,

    registerChild(menu) {
      childMenus.push(menu)
    },

    registerItem(item) {
      items.push(item)
    },

    registerList(node) {
      listRef = node
    },

    registerSurface(node) {
      surfaceRef = node
    },

    registerTrigger(node, id) {
      triggerRef = node
      triggerId = id
    },

    suppressNextPointerLeaveClear() {
      suppressNextPointerLeaveClear = true
    },

    startHoverAim(source, target, event) {
      if (!source || !target) {
        return false
      }

      return hoverAim.start(source, target, event)
    },

    unregisterList(node) {
      if (listRef === node) {
        listRef = undefined
      }
    },

    unregisterSurface(node) {
      if (surfaceRef === node) {
        surfaceRef = undefined
      }
    },

    unregisterTrigger(node) {
      if (triggerRef === node) {
        triggerRef = undefined
        triggerId = undefined
      }
    },
  }

  handle.context.set(context)

  return () => {
    childMenus = []
    items = []
    parent?.registerChild(context)

    return <popover.Context>{handle.props.children}</popover.Context>
  }
}

const triggerMixin = createMixin<HTMLElement, [options?: MenuTriggerOptions], ElementProps>(
  (handle) => {
    let context = handle.context.get(MenuProvider)

    return (options = {}) => [
      attrs({
        id: handle.id,
        'aria-controls': context.listId,
        'aria-expanded': context.isOpen ? 'true' : 'false',
        'aria-haspopup': 'menu',
      }),
      ref((node: HTMLElement, signal) => {
        context.registerTrigger(node, handle.id)
        signal.addEventListener('abort', () => {
          context.unregisterTrigger(node)
        })
      }),
      popover.anchor({
        placement: 'bottom-start',
        ...options,
      }),
      on('click', () => {
        if (context.isOpen) {
          void context.closeAll()
        } else {
          void context.open({ strategy: 'list' })
        }
      }),
      on('keydown', (event) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault()
            event.stopPropagation()
            void context.open({ strategy: 'first' })
            break
          case 'ArrowUp':
            event.preventDefault()
            event.stopPropagation()
            void context.open({ strategy: 'last' })
            break
          case 'Enter':
          case ' ':
            event.preventDefault()
            event.stopPropagation()
            void context.open({ strategy: 'list' })
        }
      }),
    ]
  },
)

const popoverMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let context = handle.context.get(MenuProvider)

  return () => [
    attrs({
      'data-close-animation': context.closeAnimation === 'none' ? 'none' : undefined,
      'data-menu-submenu': context.isRoot ? undefined : 'true',
    }),
    ref((node: HTMLElement, signal) => {
      context.registerSurface(node)
      signal.addEventListener('abort', () => {
        context.unregisterSurface(node)
      })
    }),
    popover.surface({
      open: context.isOpen,
      onHide(request?: popover.PopoverHideRequest) {
        if (context.isRoot || request?.reason === 'escape-key') {
          void context.closeAll()
          return
        }

        if (
          request?.reason === 'outside-click' &&
          request.target instanceof Node &&
          context.root.surfaceNode?.contains(request.target)
        ) {
          void context.closeBranch()
        }
      },
      closeOnAnchorClick: false,
      restoreFocusOnHide: false,
      stopOutsideClickPropagation: false,
    }),
  ]
})

const listMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let context = handle.context.get(MenuProvider)

  return () => [
    attrs({
      id: context.listId,
      role: 'menu',
      tabIndex: -1,
      'aria-label': context.label,
      'aria-labelledby': context.label ? undefined : context.triggerId,
    }),
    ref((node: HTMLElement, signal) => {
      context.registerList(node)
      signal.addEventListener('abort', () => {
        context.unregisterList(node)
      })
    }),
    on('pointerleave', (event) => {
      if (
        event.relatedTarget instanceof Node &&
        event.currentTarget.contains(event.relatedTarget)
      ) {
        return
      }

      if (!context.hasOpenChild()) {
        if (context.consumePointerLeaveClearSuppression()) {
          return
        }

        context.highlight(null)
      }
    }),
    on('keydown', (event) => {
      if (!eventBelongsToCurrentMenu(event)) {
        return
      }

      let isTypeaheadKey = isPrintableKey(event) || event.key === 'Backspace'
      if (isTypeaheadKey) {
        event.stopPropagation()
        return
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          event.stopPropagation()
          context.navigate(NavigationStrategy.Next)
          return
        case 'ArrowUp':
          event.preventDefault()
          event.stopPropagation()
          context.navigate(NavigationStrategy.Previous)
          return
        case 'Home':
          event.preventDefault()
          event.stopPropagation()
          context.navigate(NavigationStrategy.First)
          return
        case 'End':
          event.preventDefault()
          event.stopPropagation()
          context.navigate(NavigationStrategy.Last)
          return
        case 'Enter':
        case ' ':
          event.preventDefault()
          event.stopPropagation()
          void context.activateActive()
          return
        case 'ArrowRight':
          event.preventDefault()
          event.stopPropagation()
          void context.openActiveSubmenu()
          return
        case 'ArrowLeft':
          if (!context.parent) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          void context.closeBranch({ focusTrigger: true })
          return
        case 'Escape':
          event.preventDefault()
          event.stopPropagation()
          void context.closeAll()
          return
        case 'Tab':
          event.stopPropagation()
          void context.closeAll({ focusRoot: false })
      }
    }),
    hiddenTypeahead((text) => {
      context.highlightSearchMatch(text)
    }),
  ]
})

const itemMixin = createMixin<HTMLElement, [options: MenuItemOptions], ElementProps>((handle) => {
  let itemRef: HTMLElement | undefined

  handle.queueTask((node) => {
    itemRef = node
  })

  return (options) => {
    let context = handle.context.get(MenuProvider)
    let type: MenuItemType = options.type ?? 'item'
    let isFlashing = context.flashingId === handle.id

    context.registerItem({
      checked: options.checked,
      disabled: options.disabled,
      id: handle.id,
      name: options.name,
      searchValue: options.searchValue,
      type,
      value: options.value,
      get hidden() {
        return itemRef?.hidden === true
      },
      get label() {
        return getItemLabel(itemRef, options.label)
      },
      get node() {
        return itemRef as HTMLElement
      },
    })

    return [
      attrs({
        id: handle.id,
        role: getItemRole(type),
        tabIndex: -1,
        'aria-checked':
          type === 'item'
            ? undefined
            : isFlashing
              ? context.flashingChecked
                ? 'true'
                : 'false'
              : options.checked
                ? 'true'
                : 'false',
        'aria-disabled': options.disabled ? 'true' : undefined,
        'data-menu-flash': isFlashing ? 'true' : undefined,
        'data-highlighted': context.activeId === handle.id ? 'true' : undefined,
      }),
      !options.disabled && [
        on('click', () => {
          void context.activateItem(handle.id)
        }),
        on('pointermove', (event) => {
          if (!context.allowsPointer(event)) {
            return
          }

          context.highlight(handle.id, { focus: true })
        }),
        on('pointerleave', (event) => {
          if (context.activeId !== handle.id) {
            return
          }

          if (!shouldClearHighlightOnPointerLeave(event)) {
            return
          }

          context.highlight(null)
        }),
        on('focus', () => {
          context.highlight(handle.id)
        }),
      ],
    ]
  }
})

const submenuTriggerMixin = createMixin<
  HTMLElement,
  [options: SubmenuTriggerOptions],
  ElementProps
>((handle) => {
  let itemRef: HTMLElement | undefined
  let openTimeoutId = 0
  let aborted = false

  let childMenu = handle.context.get(MenuProvider)
  let parentMenu = childMenu.parent
  let signal = handle.signal

  handle.queueTask((node) => {
    itemRef = node
  })

  function clearScheduledOpen() {
    clearTimeout(openTimeoutId)
    openTimeoutId = 0
  }

  signal.addEventListener('abort', () => {
    aborted = true
    clearScheduledOpen()
  })

  return (options) => {
    if (!parentMenu) {
      return []
    }

    let parent = parentMenu

    parent.registerItem({
      disabled: options.disabled,
      id: handle.id,
      searchValue: options.searchValue,
      submenu: childMenu,
      type: 'item',
      value: options.value,
      get hidden() {
        return itemRef?.hidden === true
      },
      get label() {
        return getItemLabel(itemRef, options.label)
      },
      get node() {
        return itemRef as HTMLElement
      },
    })

    function scheduleOpen() {
      clearScheduledOpen()

      if (options.disabled || childMenu.isOpen) {
        return
      }

      openTimeoutId = window.setTimeout(() => {
        if (aborted || parent.activeId !== handle.id) {
          return
        }

        void childMenu.open({ focus: false, strategy: 'none' })
      }, SUBMENU_OPEN_DELAY_MS)
    }

    return [
      attrs({
        id: handle.id,
        role: 'menuitem',
        tabIndex: -1,
        'aria-controls': childMenu.listId,
        'aria-disabled': options.disabled ? 'true' : undefined,
        'aria-expanded': childMenu.isOpen ? 'true' : 'false',
        'aria-haspopup': 'menu',
        'data-submenu-state': childMenu.state === State.Idle ? undefined : childMenu.state,
        'data-highlighted': parent.activeId === handle.id ? 'true' : undefined,
      }),
      ref((node: HTMLElement, signal) => {
        childMenu.registerTrigger(node, handle.id)
        signal.addEventListener('abort', () => {
          childMenu.unregisterTrigger(node)
        })
      }),
      popover.anchor({
        placement: 'right-start',
        relativeTo: SUBMENU_ANCHOR_RELATIVE_TO,
      }),
      !options.disabled && [
        on('click', () => {
          parent.highlight(handle.id, { focus: true })
          void childMenu.open({ focus: false, strategy: 'none' })
        }),
        on('pointermove', (event) => {
          if (!parent.allowsPointer(event)) {
            return
          }

          let shouldScheduleOpen = document.activeElement === itemRef && openTimeoutId === 0
          parent.highlight(handle.id, { focus: true })

          if (shouldScheduleOpen) {
            scheduleOpen()
          }
        }),
        on('pointerleave', (event) => {
          clearScheduledOpen()

          let childSurface = childMenu.surfaceNode
          if (
            childMenu.isOpen &&
            parent.startHoverAim(itemRef ?? null, childSurface ?? null, event)
          ) {
            return
          }

          if (parent.activeId !== handle.id) {
            return
          }

          if (!shouldClearHighlightOnPointerLeave(event)) {
            return
          }

          parent.highlight(null)
        }),
        on('focus', (event) => {
          parent.highlight(handle.id)

          if (
            event.relatedTarget instanceof Element &&
            event.relatedTarget.closest('[role="menu"]')?.id === childMenu.listId
          ) {
            return
          }

          scheduleOpen()
        }),
        on('blur', () => {
          clearScheduledOpen()
        }),
      ],
    ]
  }
})

export interface MenuListProps extends Props<'div'> {}

type MenuListChildProps = Omit<
  JSX.LibraryManagedAttributes<typeof MenuList, MenuListProps>,
  'children'
>

export const Context = MenuProvider
export const item = itemMixin
export const list = listMixin
export { popoverMixin as popover }
export const submenuTrigger = submenuTriggerMixin
export const trigger = triggerMixin

const menu = {
  Context,
  item,
  list,
  popover: popoverMixin,
  submenuTrigger,
  trigger,
} as const

export function onMenuSelect(handler: MenuSelectHandler, captureBoolean?: boolean) {
  return on<HTMLElement, typeof MENU_SELECT_EVENT>(MENU_SELECT_EVENT, handler, captureBoolean)
}

export interface MenuProps extends Omit<Props<'button'>, 'children'> {
  children?: RemixNode
  label: RemixNode
  menuLabel?: string
}

export interface MenuItemProps
  extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'>,
    MenuItemOptions {
  children?: RemixNode
}

export interface SubmenuProps
  extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'>,
    Omit<SubmenuTriggerOptions, 'label'> {
  children?: RemixNode
  label: RemixNode
  listProps?: MenuListChildProps
  menuLabel?: string
}

export function Menu(handle: Handle<MenuProps>) {
  let buttonRef: HTMLButtonElement | undefined

  return () => {
    let { children, label, menuLabel, mix, type, ...buttonProps } = handle.props

    return (
      <menu.Context label={menuLabel}>
        <button
          {...buttonProps}
          type={type ?? 'button'}
          mix={[
            button.baseStyle,
            button.ghostStyle,
            buttonStyle,
            menu.trigger(),
            ref((node: HTMLButtonElement, signal) => {
              buttonRef = node
              signal.addEventListener('abort', () => {
                if (buttonRef === node) {
                  buttonRef = undefined
                }
              })
            }),
            mix,
          ]}
        >
          <span mix={button.labelStyle}>{label}</span>
          <Glyph mix={button.iconStyle} name="chevronDown" />
        </button>
        <MenuList
          mix={onMenuSelect((event) => {
            if (!buttonRef) {
              return
            }

            event.stopPropagation()
            buttonRef.dispatchEvent(new MenuSelectEvent(event.item))
          })}
        >
          {children}
        </MenuList>
      </menu.Context>
    )
  }
}

export function MenuList(handle: Handle<MenuListProps>) {
  return () => {
    let { children, mix, ...divProps } = handle.props

    return (
      <div mix={[popover.surfaceStyle, popoverStyle, menu.popover()]}>
        <div {...divProps} mix={[listStyle, menu.list(), mix]}>
          {children}
        </div>
      </div>
    )
  }
}

export function MenuItem(handle: Handle<MenuItemProps>) {
  return () => {
    let { checked, children, disabled, label, mix, name, searchValue, type, value, ...divProps } =
      handle.props

    return (
      <div
        {...divProps}
        mix={[
          itemStyle,
          menu.item({ checked, disabled, label, name, searchValue, type, value }),
          mix,
        ]}
      >
        <span mix={itemSlotStyle}>
          <Glyph mix={itemGlyphStyle} name="check" />
        </span>
        <span mix={itemLabelStyle}>{children ?? label}</span>
      </div>
    )
  }
}

export function Submenu(handle: Handle<SubmenuProps>) {
  return () => {
    let { children, disabled, label, listProps, menuLabel, mix, searchValue, value, ...divProps } =
      handle.props

    return (
      <menu.Context label={menuLabel}>
        <div
          {...divProps}
          mix={[
            itemStyle,
            menu.submenuTrigger({
              disabled,
              searchValue,
              value,
            }),
            mix,
          ]}
        >
          <span mix={itemSlotStyle}>
            <Glyph mix={itemGlyphStyle} name="check" />
          </span>
          <span mix={itemLabelStyle}>{label}</span>
          <Glyph mix={triggerGlyphStyle} name="chevronRight" />
        </div>
        <MenuList {...listProps}>{children}</MenuList>
      </menu.Context>
    )
  }
}
