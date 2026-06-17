import { createElement, css } from '@remix-run/ui'
import type { CSSMixinDescriptor, Handle, Props, RemixNode } from '@remix-run/ui'

import * as tabs from '@remix-run/ui/tabs'
import * as button from '../button/button.tsx'
import { componentStyleValues as styles } from '../shared/style-values.ts'

export interface TabsProps {
  children?: RemixNode
  defaultValue?: string
  onValueChange?: (value: string) => void
  orientation?: tabs.TabsOrientation
  ref?: (ref: tabs.TabsRef) => void
  value?: string
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

const tabsListCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: styles.space.xs,
  minWidth: 0,
  padding: styles.space.xs,
  border: `1px solid ${styles.colors.border.subtle}`,
  borderRadius: styles.radius.xl,
  backgroundColor: styles.surface.lvl2,
})

const tabsTriggerCss: CSSMixinDescriptor = css({
  justifyContent: 'flex-start',
  minHeight: styles.control.height.md,
  paddingInline: styles.space.md,
  border: '1px solid transparent',
  borderRadius: styles.radius.md,
  backgroundColor: 'transparent',
  color: styles.colors.text.secondary,
  fontSize: styles.fontSize.md,
  '&:hover:not(:disabled):not([aria-disabled="true"])': {
    color: styles.colors.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${styles.colors.focus.ring}`,
    outlineOffset: '2px',
    color: styles.colors.text.primary,
  },
  '&[aria-selected="true"], &[aria-selected="true"]:hover, &[aria-selected="true"]:focus-visible': {
    backgroundColor: styles.surface.lvl0,
    borderColor: styles.colors.border.subtle,
    boxShadow: styles.shadow.xs,
    color: styles.colors.text.primary,
  },
  '&:disabled, &[aria-disabled="true"]': {
    opacity: 0.55,
  },
})

export const listStyle = tabsListCss
export const triggerStyle = tabsTriggerCss

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
