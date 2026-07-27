import {
  css,
  type CSSMixinDescriptor,
  type Handle,
  type Props,
  type RemixNode,
} from '@remix-run/ui'
import * as tabs from '@remix-run/ui/tabs/primitives'

export { TabsChangeEvent, onTabsChange } from '@remix-run/ui/tabs/primitives'

export type TabsSize = 'md' | 'lg'

export interface TabsProps extends Omit<Props<'div'>, 'children'> {
  activeTab?: string
  children?: RemixNode
  defaultActiveTab?: string
  disabled?: boolean
  onActiveTabChange?: (activeTab: string) => void
  size?: TabsSize
}

export interface TabListProps extends Omit<Props<'div'>, 'children'> {
  children?: RemixNode
}

export interface TabProps extends Omit<Props<'button'>, 'children' | 'type'> {
  children?: RemixNode
  disabled?: boolean
  name: string
  type?: 'button' | 'submit' | 'reset'
}

export interface TabPanelProps extends Omit<Props<'div'>, 'children'> {
  children?: RemixNode
  name: string
}

const tabSliderBackground =
  'linear-gradient(180deg, rgba(0, 0, 0, 0) 33%, rgba(0, 0, 0, 0.04) 100%), #FFFFFF'
const tabSliderShadow =
  '0 0 0 0.5px rgba(0, 0, 0, 0.06), 0 1px 1px -0.5px rgba(0, 0, 0, 0.12), 0 2px 2px -1px rgba(0, 0, 0, 0.12), 0 4px 4px -2px rgba(0, 0, 0, 0.12), inset 0 0 2px 1px #FFFFFF'

const tabsRootCss: CSSMixinDescriptor = css({
  '--rmx-tabs-height': '32px',
  '--rmx-tabs-track-padding': '2px',
  '--rmx-tabs-tab-padding-inline': '12px',
  '--rmx-tabs-tab-shadow': '0 0 0 0 rgba(0, 0, 0, 0)',
  '--rmx-tabs-tab-font-size': '12px',
  '--rmx-tabs-tab-line-height': '17px',
  '--rmx-tabs-gap': '12px',
  boxSizing: 'border-box',
  display: 'grid',
  gap: 'var(--rmx-tabs-gap)',
  minWidth: 0,
})

const tabsListCss: CSSMixinDescriptor = css({
  boxSizing: 'border-box',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  width: 'max-content',
  maxWidth: '100%',
  minHeight: 'var(--rmx-tabs-height)',
  padding: 'var(--rmx-tabs-track-padding)',
  border: 0,
  borderRadius: '9999px',
  background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.06) 0%, rgba(0, 0, 0, 0) 100%), #EBEBEB',
  boxShadow:
    'inset 0 0 4px 1px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(0, 0, 0, 0.02), inset 0 2px 2px rgba(0, 0, 0, 0.02)',
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': {
    display: 'none',
  },
  '&[aria-disabled="true"]': {
    opacity: 0.55,
  },
})

const tabsTabCss: CSSMixinDescriptor = css({
  '--rmx-tabs-tab-focus-shadow':
    '0 0 0 1px #3573F6, var(--rmx-tabs-tab-shadow), 0 0 0 4px rgba(53, 115, 246, 0.1), 0 6px 32px 4px rgba(53, 115, 246, 0.08), inset 0 0 8px 1px rgba(53, 115, 246, 0.05)',
  appearance: 'none',
  margin: 0,
  boxSizing: 'border-box',
  position: 'relative',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: '4px',
  width: 'max-content',
  maxWidth: '100%',
  minWidth: 0,
  height: 'calc(var(--rmx-tabs-height) - (var(--rmx-tabs-track-padding) * 2))',
  minHeight: 'calc(var(--rmx-tabs-height) - (var(--rmx-tabs-track-padding) * 2))',
  paddingBlock: 0,
  paddingInline: 'var(--rmx-tabs-tab-padding-inline)',
  border: 0,
  borderRadius: '999px',
  background: 'transparent',
  boxShadow: 'var(--rmx-tabs-tab-shadow)',
  color: '#707070',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontStyle: 'normal',
  fontWeight: 500,
  fontSize: 'var(--rmx-tabs-tab-font-size)',
  lineHeight: 'var(--rmx-tabs-tab-line-height)',
  fontFeatureSettings: '"ss01" on, "cv01" on',
  letterSpacing: 0,
  textAlign: 'center',
  textDecoration: 'none',
  textShadow: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
  '&[data-state="inactive"]:hover:not(:disabled):not([aria-disabled="true"])': {
    background: 'rgba(16, 16, 16, 0.05)',
    color: '#101010',
  },
  '&[data-state="inactive"]:active:not(:disabled):not([aria-disabled="true"])': {
    background: 'rgba(16, 16, 16, 0.08)',
  },
  '&[data-state="active"]': {
    background: tabSliderBackground,
    '--rmx-tabs-tab-shadow': tabSliderShadow,
    color: '#101010',
    textShadow: '0 1px 0 #FFFFFF',
  },
  '&[data-state="active"]:hover:not(:disabled):not([aria-disabled="true"])': {
    background: tabSliderBackground,
  },
  '&[data-state="active"]:active:not(:disabled):not([aria-disabled="true"])': {
    background: tabSliderBackground,
  },
  '&:disabled, &[aria-disabled="true"]': {
    cursor: 'not-allowed',
    opacity: 0.55,
  },
  '&:focus-visible': {
    outline: 0,
    boxShadow: 'var(--rmx-tabs-tab-focus-shadow)',
  },
})

const tabsPanelCss: CSSMixinDescriptor = css({
  minWidth: 0,
  color: '#101010',
  fontFamily: '"Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  fontSize: '13px',
  lineHeight: '20px',
  letterSpacing: 0,
  '&[hidden]': {
    display: 'none',
  },
})

const sizeStyles = {
  md: css({}),
  lg: css({
    '--rmx-tabs-height': '36px',
    '--rmx-tabs-tab-padding-inline': '14px',
    '--rmx-tabs-tab-font-size': '13px',
    '--rmx-tabs-tab-line-height': '20px',
    '--rmx-tabs-gap': '14px',
  }),
} as const satisfies Record<TabsSize, CSSMixinDescriptor>

export const rootStyle = tabsRootCss
export const listStyle = tabsListCss
export const tabStyle = tabsTabCss
export const panelStyle = tabsPanelCss

export function Tabs(handle: Handle<TabsProps>): () => RemixNode {
  return () => {
    let {
      activeTab,
      children,
      defaultActiveTab,
      disabled,
      mix,
      onActiveTabChange,
      size = 'md',
      ...divProps
    } = handle.props

    return (
      <tabs.Context
        activeTab={activeTab}
        defaultActiveTab={defaultActiveTab}
        disabled={disabled}
        onActiveTabChange={onActiveTabChange}
      >
        <div {...divProps} mix={[rootStyle, sizeStyles[size], tabs.root(), mix]}>
          {children}
        </div>
      </tabs.Context>
    )
  }
}

export function TabList(handle: Handle<TabListProps>): () => RemixNode {
  return () => {
    let { children, mix, ...divProps } = handle.props

    return (
      <div {...divProps} mix={[listStyle, tabs.list(), mix]}>
        {children}
      </div>
    )
  }
}

export function Tab(handle: Handle<TabProps>): () => RemixNode {
  return () => {
    let { children, disabled, mix, name, type, ...buttonProps } = handle.props

    return (
      <button
        {...buttonProps}
        mix={[tabStyle, tabs.tab({ disabled, name }), mix]}
        type={type ?? 'button'}
      >
        {children}
      </button>
    )
  }
}

export function TabPanel(handle: Handle<TabPanelProps>): () => RemixNode {
  return () => {
    let { children, mix, name, ...divProps } = handle.props

    return (
      <div {...divProps} mix={[panelStyle, tabs.panel({ name }), mix]}>
        {children}
      </div>
    )
  }
}
