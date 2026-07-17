import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

import { DocsShellBehavior } from './docs-shell.browser.tsx'
import { Icon } from './icon.tsx'

export interface DocsShellProps {
  header: RemixNode
  navigation: RemixNode
  navigationLabel: string
  navigationName: string
  children: RemixNode
  footer?: RemixNode
}

export function DocsShell(handle: Handle<DocsShellProps>) {
  return () => (
    <>
      <a href="#main-content" mix={skipLinkCss}>
        Skip to content
      </a>
      {handle.props.header}
      <button
        id="docs-navigation-toggle"
        type="button"
        aria-controls="docs-navigation"
        aria-expanded="true"
        aria-label={`Collapse ${handle.props.navigationName}`}
        mix={navigationToggleCss}
      >
        <Icon name="layout-left" />
      </button>
      <nav id="docs-navigation" aria-label={handle.props.navigationLabel} mix={navigationCss}>
        {handle.props.navigation}
      </nav>
      <div aria-hidden="true" mix={sidebarRailCss} />
      <main id="main-content" data-docs-main tabIndex={-1} data-pagefind-body mix={mainCss}>
        {handle.props.children}
      </main>
      {handle.props.footer}
      <DocsShellBehavior navigationName={handle.props.navigationName} />
    </>
  )
}

const skipLinkCss = css({
  position: 'fixed',
  top: 'var(--rmx-space-sm)',
  left: 'var(--rmx-space-sm)',
  zIndex: 100,
  padding: 'var(--rmx-space-sm) var(--rmx-space-md)',
  borderRadius: 'var(--rmx-radius-md)',
  background: 'var(--rmx-surface-lvl0)',
  color: 'var(--rmx-color-text-primary)',
  transform: 'translateY(calc(-100% - var(--rmx-space-lg)))',
  '&:focus': {
    transform: 'none',
  },
})

const navigationToggleCss = css({
  position: 'fixed',
  top: '16px',
  left: '232px',
  zIndex: 51,
  display: 'grid',
  width: '32px',
  height: '32px',
  padding: '8px',
  placeItems: 'center',
  border: 0,
  borderRadius: '8px',
  color: 'var(--rmx-color-text-secondary)',
  background: 'transparent',
  cursor: 'pointer',
  transition:
    'left var(--docs-nav-duration) var(--docs-nav-easing), background-color 150ms ease-in-out',
  '&:hover, &:focus-visible': {
    background: 'var(--docs-nav-hover-background)',
  },
  '& svg': {
    display: 'block',
    width: '16px',
    height: '16px',
  },
  ':root[data-docs-nav-collapsed] &': {
    left: '85px',
  },
  '@media (width < 900px)': {
    display: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

const navigationCss = css({
  position: 'fixed',
  top: '108px',
  left: 'var(--docs-sidebar-inline-start)',
  zIndex: 40,
  width: 'var(--docs-sidebar-content-width)',
  maxHeight: 'calc(100dvh - 108px)',
  padding: 0,
  overflow: 'visible',
  transition:
    'transform var(--docs-nav-duration) var(--docs-nav-easing), opacity var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s',
  '&[data-scrollable]': {
    width: '248px',
    marginLeft: '-4px',
    paddingBlockEnd: 'var(--rmx-space-lg)',
    paddingInline: '4px',
    overflowX: 'hidden',
    overflowY: 'auto',
  },
  ':root[data-docs-nav-collapsed] &': {
    visibility: 'hidden',
    opacity: 0,
    transform: 'translateX(calc(-1 * var(--docs-sidebar-offset)))',
    pointerEvents: 'none',
    transition:
      'transform var(--docs-nav-duration) var(--docs-nav-easing), opacity var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s linear var(--docs-nav-duration)',
  },
  '@media (max-height: 715px) and (width >= 900px)': {
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehaviorY: 'auto',
  },
  '@media (width < 900px)': {
    display: 'none',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

const mainCss = css({
  containerName: 'docs-main',
  containerType: 'inline-size',
  width: 'calc(100% - var(--docs-sidebar-offset))',
  minHeight: 'calc(100vh - var(--site-header-height))',
  margin: 'var(--site-header-height) 0 0 var(--docs-sidebar-offset)',
  padding: 'var(--docs-main-padding)',
  borderRadius: '16px 0 0 16px',
  outline: 'none',
  background: 'var(--rmx-surface-lvl0)',
  transition:
    'width var(--docs-nav-duration) var(--docs-nav-easing), margin-left var(--docs-nav-duration) var(--docs-nav-easing), padding-left var(--docs-nav-duration) var(--docs-nav-easing)',
  '&::before': {
    position: 'fixed',
    top: 'var(--site-header-height)',
    left: 'var(--docs-sidebar-offset)',
    zIndex: 49,
    width: '16px',
    height: '16px',
    background:
      'radial-gradient(circle at 100% 100%, transparent 15.5px, var(--docs-shell-background) 16px)',
    content: "''",
    pointerEvents: 'none',
    transition: 'left var(--docs-nav-duration) var(--docs-nav-easing)',
  },
  ':root[data-docs-nav-collapsed] &': {
    width: 'calc(100% - var(--docs-collapsed-offset))',
    marginLeft: 'var(--docs-collapsed-offset)',
    paddingLeft: 'var(--docs-collapsed-content-padding)',
    '&::before': {
      left: 'var(--docs-collapsed-offset)',
    },
  },
  '@media (width < 900px)': {
    '&, :root[data-docs-nav-collapsed] &': {
      width: '100%',
      marginLeft: 0,
      padding: '24px',
      borderRadius: 0,
    },
    '&::before': {
      display: 'none',
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&::before': {
      transition: 'none',
    },
  },
})

const sidebarRailCss = css({
  display: 'none',
  '@media (width >= 900px)': {
    position: 'fixed',
    inset: 'var(--site-header-height) auto 0 0',
    zIndex: 30,
    display: 'block',
    width: 'var(--docs-sidebar-offset)',
    background: 'var(--docs-shell-background)',
    pointerEvents: 'none',
    transition: 'width var(--docs-nav-duration) var(--docs-nav-easing)',
    ':root[data-docs-nav-collapsed] &': {
      width: 'var(--docs-collapsed-offset)',
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})
