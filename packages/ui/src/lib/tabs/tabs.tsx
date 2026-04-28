// @jsxRuntime classic
// @jsx createElement
import {
  attrs,
  css,
  createElement,
  createMixin,
  on,
  type CSSMixinDescriptor,
  type ElementProps,
  type Handle,
  type MixinHandle,
  type Props,
  type RemixNode,
} from '@remix-run/ui'
import * as button from '../button/button.tsx'
import { theme } from '../theme/theme.ts'

const TABS_CHANGE_EVENT = 'rmx:tabs-change' as const

type TabsChangeHandler = (event: TabsChangeEvent, signal: AbortSignal) => void | Promise<void>

const tabsListCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space.xs,
  minWidth: 0,
  padding: theme.space.xs,
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.xl,
  backgroundColor: theme.surface.lvl2,
})

const tabsTriggerCss: CSSMixinDescriptor = css({
  justifyContent: 'flex-start',
  minHeight: theme.control.height.md,
  paddingInline: theme.space.md,
  border: '1px solid transparent',
  borderRadius: theme.radius.md,
  backgroundColor: 'transparent',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.md,
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    color: theme.colors.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.colors.focus.ring}`,
    outlineOffset: '2px',
    color: theme.colors.text.primary,
  },
  '&[aria-selected="true"], &[aria-selected="true"]:hover, &[aria-selected="true"]:focus-visible': {
    backgroundColor: theme.surface.lvl0,
    borderColor: theme.colors.border.subtle,
    boxShadow: theme.shadow.xs,
    color: theme.colors.text.primary,
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.55,
  },
})

export const listStyle = tabsListCss
export const triggerStyle = tabsTriggerCss

const panelVisibilityUtility = css({
  '&[hidden]': {
    display: 'none',
  },
})

declare global {
  interface HTMLElementEventMap {
    [TABS_CHANGE_EVENT]: TabsChangeEvent
  }
}

export class TabsChangeEvent extends Event {
  readonly previousValue: string | null
  readonly value: string

  constructor(value: string, previousValue: string | null) {
    super(TABS_CHANGE_EVENT, { bubbles: true })
    this.value = value
    this.previousValue = previousValue
  }
}

export type TabsOrientation = 'horizontal' | 'vertical'

type TabsDirection = 'first' | 'last' | 'next' | 'previous'

type RegisteredTab = {
  disabled: boolean
  getNode(): HTMLElement | null
  value: string
}

export interface TabsRef {
  readonly selectedValue: string | null
  focus: (value?: string) => void
  focusFirst: () => void
  focusLast: () => void
  select: (value: string) => void
}

interface TabsContextValue {
  readonly focusableValue: string | null
  readonly orientation: TabsOrientation
  readonly value: string | null
  getPanelId: (value: string) => string
  getTriggerId: (value: string) => string
  move: (fromValue: string, direction: TabsDirection) => void
  registerTab: (tab: RegisteredTab) => void
  select: (value: string) => void
}

export interface TabsContextProps {
  children?: RemixNode
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: TabsOrientation
  ref?: (ref: TabsRef) => void
  value?: string
}

export interface TabsProps extends TabsContextProps {}

export interface TabsTriggerOptions {
  disabled?: boolean
  value: string
}

export interface TabsPanelOptions {
  value: string
}

export type TabsListProps = Props<'div'>

export type TabProps = Omit<Props<'button'>, 'type'> & {
  children?: RemixNode
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  value: string
}

export type TabsPanelProps = Props<'div'> & {
  children?: RemixNode
  value: string
}

function getTabsContext(handle: Handle | MixinHandle) {
  return handle.context.get(TabsProvider)
}

function toIdFragment(value: string) {
  let fragment = value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return fragment || 'tab'
}

function TabsProvider(handle: Handle<TabsContextProps, TabsContextValue>) {
  let registeredTabs: RegisteredTab[] = []
  let hasInitialized = false
  let uncontrolledValue: string | null = null

  function getValue() {
    return handle.props.value !== undefined ? handle.props.value : uncontrolledValue
  }

  function getOrientation() {
    return handle.props.orientation ?? 'horizontal'
  }

  function isActiveTab(tab: RegisteredTab | undefined): tab is RegisteredTab {
    return !!tab && !tab.disabled && !!tab.getNode()?.isConnected
  }

  function getTab(value: string | null | undefined) {
    if (value == null) {
      return undefined
    }

    return registeredTabs.find((tab) => tab.value === value)
  }

  function getEnabledTabs() {
    return registeredTabs.filter(isActiveTab)
  }

  function getFocusableValue() {
    let currentValue = getValue()
    let currentTab = getTab(currentValue)

    if (isActiveTab(currentTab)) {
      return currentValue
    }

    return getEnabledTabs()[0]?.value ?? null
  }

  function getTargetTab(fromValue: string, direction: TabsDirection) {
    let enabledTabs = getEnabledTabs()
    if (enabledTabs.length === 0) {
      return undefined
    }

    let currentIndex = enabledTabs.findIndex((tab) => tab.value === fromValue)
    let targetIndex = 0

    switch (direction) {
      case 'first':
        targetIndex = 0
        break
      case 'last':
        targetIndex = enabledTabs.length - 1
        break
      case 'next':
        targetIndex =
          currentIndex === -1 || currentIndex === enabledTabs.length - 1 ? 0 : currentIndex + 1
        break
      case 'previous':
        targetIndex = currentIndex <= 0 ? enabledTabs.length - 1 : currentIndex - 1
        break
    }

    return enabledTabs[targetIndex]
  }

  function dispatchChange(value: string, previousValue: string | null) {
    getTab(value)?.getNode()?.dispatchEvent(new TabsChangeEvent(value, previousValue))
  }

  function select(value: string) {
    let nextTab = getTab(value)
    if (!isActiveTab(nextTab)) {
      return
    }

    let previousValue = getValue()
    if (previousValue === value) {
      return
    }

    if (handle.props.value === undefined) {
      uncontrolledValue = value
      void handle.update()
    }

    handle.props.onValueChange?.(value)
    dispatchChange(value, previousValue ?? null)
  }

  let tabsRef: TabsRef = {
    get selectedValue() {
      return getValue()
    },
    focus(value = getFocusableValue() ?? undefined) {
      getTab(value)?.getNode()?.focus()
    },
    focusFirst() {
      getTargetTab(getFocusableValue() ?? '', 'first')
        ?.getNode()
        ?.focus()
    },
    focusLast() {
      getTargetTab(getFocusableValue() ?? '', 'last')
        ?.getNode()
        ?.focus()
    },
    select,
  }

  handle.context.set({
    get focusableValue() {
      return getFocusableValue()
    },
    get orientation() {
      return getOrientation()
    },
    get value() {
      return getValue()
    },
    getPanelId(value) {
      return `${handle.id}-panel-${toIdFragment(value)}`
    },
    getTriggerId(value) {
      return `${handle.id}-trigger-${toIdFragment(value)}`
    },
    move(fromValue, direction) {
      let target = getTargetTab(fromValue, direction)
      if (!target) {
        return
      }

      target.getNode()?.focus()
      select(target.value)
    },
    registerTab(tab) {
      registeredTabs.push(tab)
    },
    select,
  })

  return () => {
    registeredTabs = []

    if (!hasInitialized) {
      uncontrolledValue = handle.props.defaultValue ?? null
      hasInitialized = true
    }

    handle.queueTask(() => {
      handle.props.ref?.(tabsRef)

      if (handle.props.value !== undefined) {
        return
      }

      let nextValue = getFocusableValue()
      if (nextValue === uncontrolledValue) {
        return
      }

      uncontrolledValue = nextValue
      void handle.update()
    })

    return handle.props.children
  }
}

const listMixin = createMixin<HTMLElement, [], ElementProps>((handle) => {
  let context = getTabsContext(handle)

  return () =>
    attrs({
      role: 'tablist',
      'aria-orientation': context.orientation === 'vertical' ? 'vertical' : undefined,
      'data-orientation': context.orientation,
    })
})

const triggerMixin = createMixin<HTMLElement, [options: TabsTriggerOptions], ElementProps>(
  (handle) => {
    let triggerRef: HTMLElement | null = null
    let context = getTabsContext(handle)

    handle.queueTask((node) => {
      triggerRef = node
    })

    return (options, props) => {
      let disabled = options.disabled === true || props.disabled === true
      context.registerTab({
        disabled,
        getNode() {
          return triggerRef
        },
        value: options.value,
      })

      return [
        attrs({
          id: context.getTriggerId(options.value),
          role: 'tab',
          tabIndex: !disabled && context.focusableValue === options.value ? 0 : -1,
          'aria-controls': context.getPanelId(options.value),
          'aria-disabled': disabled ? 'true' : undefined,
          'aria-selected': context.value === options.value ? 'true' : 'false',
          'data-orientation': context.orientation,
          'data-selected': context.value === options.value ? 'true' : 'false',
        }),
        !disabled && [
          on('click', () => {
            context.select(options.value)
          }),
          on('keydown', (event) => {
            switch (event.key) {
              case 'ArrowRight':
                if (context.orientation !== 'horizontal') {
                  return
                }
                event.preventDefault()
                context.move(options.value, 'next')
                break
              case 'ArrowLeft':
                if (context.orientation !== 'horizontal') {
                  return
                }
                event.preventDefault()
                context.move(options.value, 'previous')
                break
              case 'ArrowDown':
                if (context.orientation !== 'vertical') {
                  return
                }
                event.preventDefault()
                context.move(options.value, 'next')
                break
              case 'ArrowUp':
                if (context.orientation !== 'vertical') {
                  return
                }
                event.preventDefault()
                context.move(options.value, 'previous')
                break
              case 'Home':
                event.preventDefault()
                context.move(options.value, 'first')
                break
              case 'End':
                event.preventDefault()
                context.move(options.value, 'last')
                break
            }
          }),
        ],
      ]
    }
  },
)

const panelMixin = createMixin<HTMLElement, [options: TabsPanelOptions], ElementProps>((handle) => {
  let context = getTabsContext(handle)

  return (options) => {
    let isSelected = context.value === options.value

    return [
      attrs({
        id: context.getPanelId(options.value),
        role: 'tabpanel',
        hidden: isSelected ? undefined : true,
        'aria-labelledby': context.getTriggerId(options.value),
        'data-orientation': context.orientation,
        'data-selected': isSelected ? 'true' : 'false',
      }),
      panelVisibilityUtility,
    ]
  }
})

export const Context = TabsProvider
export const list = listMixin
export const panel = panelMixin
export const trigger = triggerMixin

const tabs = { Context, list, panel, trigger } as const

export function onTabsChange(handler: TabsChangeHandler, captureBoolean?: boolean) {
  return on<HTMLElement, typeof TABS_CHANGE_EVENT>(TABS_CHANGE_EVENT, handler, captureBoolean)
}

export function Tabs(handle: Handle<TabsProps>) {
  return () => {
    let { children, ...contextProps } = handle.props
    return <tabs.Context {...contextProps}>{children}</tabs.Context>
  }
}

export function TabsList(handle: Handle<TabsListProps>) {
  return () => {
    let { children, mix, ...divProps } = handle.props

    return (
      <div {...divProps} mix={[listStyle, tabs.list(), mix]}>
        {children}
      </div>
    )
  }
}

export function Tab(handle: Handle<TabProps>) {
  return () => {
    let { children, disabled, mix, type, value, ...buttonProps } = handle.props

    return (
      <button
        {...buttonProps}
        disabled={disabled ? true : undefined}
        mix={[button.baseStyle, triggerStyle, tabs.trigger({ disabled, value }), mix]}
        type={type ?? 'button'}
      >
        {children}
      </button>
    )
  }
}

export function TabsPanel(handle: Handle<TabsPanelProps>) {
  return () => {
    let { children, mix, value, ...divProps } = handle.props

    return (
      <div {...divProps} mix={[tabs.panel({ value }), mix]}>
        {children}
      </div>
    )
  }
}
