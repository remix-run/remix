import { css } from 'remix/component'

import { media } from './media.ts'

const mobileSubheaderHeight = '48px'
const mobileNavigationTop = `var(--docs-mobile-navigation-top, calc(var(--site-header-height) + ${mobileSubheaderHeight}))`

export const skipLinkCss = css({
  position: 'fixed',
  top: 'var(--rmx-space-sm)',
  left: 'var(--rmx-space-sm)',
  zIndex: 100,
  padding: 'var(--rmx-space-sm) var(--rmx-space-md)',
  borderRadius: 'var(--rmx-radius-md)',
  background: 'var(--rmx-surface-lvl0)',
  color: 'var(--rmx-color-text-primary)',
  transform: 'translateY(calc(-100% - var(--rmx-space-lg)))',
  '&:focus': { transform: 'none' },
})

const navigationToggleExpandedLeft =
  'calc(var(--docs-sidebar-inline-start) + var(--docs-sidebar-content-width) - 32px)'
const navigationToggleCollapsedLeft = 'calc(var(--docs-sidebar-inline-start) + 97px)'

export const navigationToggleCss = css({
  position: 'fixed',
  top: 'calc((var(--site-header-height) - 32px) / 2)',
  left: `calc(${navigationToggleExpandedLeft} + (${navigationToggleCollapsedLeft} - ${navigationToggleExpandedLeft}) * var(--docs-nav-collapse))`,
  zIndex: 51,
  display: 'none',
  width: '32px',
  height: '32px',
  padding: '8px',
  placeItems: 'center',
  border: 0,
  borderRadius: 'var(--rmx-radius-md)',
  color: 'var(--rmx-color-text-secondary)',
  background: 'transparent',
  cursor: 'pointer',
  transition: 'background-color 150ms ease-in-out',
  '&:hover, &:focus-visible': { background: 'var(--docs-nav-hover-background)' },
  '& svg': { display: 'block', width: '16px', height: '16px' },
  [media.md]: { display: 'grid' },
})

export const navigationCss = css({
  position: 'fixed',
  top: mobileNavigationTop,
  right: 0,
  bottom: 'auto',
  left: 0,
  zIndex: 70,
  display: 'block',
  width: 'auto',
  maxWidth: 'none',
  maxHeight: `calc(100dvh - ${mobileNavigationTop})`,
  marginLeft: 0,
  padding: 'var(--rmx-space-lg)',
  overflowX: 'hidden',
  overflowY: 'auto',
  overscrollBehaviorY: 'contain',
  visibility: 'hidden',
  background: 'var(--docs-shell-background)',
  boxShadow: 'var(--docs-panel-shadow)',
  pointerEvents: 'none',
  ':root[data-docs-mobile-panel="navigation"] &': {
    visibility: 'visible',
    pointerEvents: 'auto',
  },
  [media.md]: {
    top: 'calc(var(--site-header-height) + 44px)',
    right: 'auto',
    // Hang the item padding outside the column so nav text lines up with the logo
    left: 'calc(var(--docs-sidebar-inline-start) - var(--docs-nav-item-inset))',
    zIndex: 40,
    width: 'calc(var(--docs-sidebar-content-width) + var(--docs-nav-item-inset))',
    maxHeight: 'calc(100dvh - var(--site-header-height) - 44px)',
    padding: 0,
    overflow: 'visible',
    overscrollBehaviorY: 'auto',
    visibility: 'visible',
    background: 'none',
    boxShadow: 'none',
    opacity: 'calc(1 - var(--docs-nav-collapse))',
    transform: 'translateX(calc(-1 * var(--docs-sidebar-offset) * var(--docs-nav-collapse)))',
    pointerEvents: 'auto',
    '&[data-scrollable]': {
      width:
        'calc(var(--docs-sidebar-content-width) + var(--docs-nav-item-inset) + 8px + var(--docs-navigation-scrollbar-width, 0px))',
      marginLeft: '-4px',
      paddingBlockEnd: 'var(--rmx-space-lg)',
      paddingInline: '4px',
      overflowX: 'hidden',
      overflowY: 'auto',
    },
    ':root[data-docs-nav-collapsed] &': {
      visibility: 'hidden',
      pointerEvents: 'none',
    },
  },
  [media.mdShort]: {
    overflowX: 'hidden',
    overflowY: 'auto',
  },
})

export const mobileNavigationBarCss = css({
  position: 'sticky',
  top: 0,
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: mobileSubheaderHeight,
  padding: '0 var(--rmx-space-md)',
  borderBottom: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
  background: 'var(--docs-shell-background)',
  [media.md]: { display: 'none' },
})

export const mobileNavigationButtonCss = css({
  minWidth: 0,
  minHeight: '36px',
  flexShrink: 1,
  paddingInline: 'var(--rmx-space-sm)',
  color: 'var(--rmx-color-text-link)',
  fontSize: 'var(--rmx-font-size-sm)',
  '&[aria-expanded="true"]': {
    background: 'var(--docs-nav-hover-background)',
  },
  '& svg': {
    display: 'block',
    flex: '0 0 auto',
    width: '16px',
    height: '16px',
  },
  '& > span': {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '&[aria-expanded="true"] svg': {
    transform: 'rotate(180deg)',
  },
})

export const mobileNavigationBackdropCss = css({
  position: 'fixed',
  inset: `${mobileNavigationTop} 0 0`,
  zIndex: 65,
  display: 'block',
  padding: 0,
  visibility: 'hidden',
  border: 0,
  background: 'var(--docs-backdrop)',
  pointerEvents: 'none',
  ':root[data-docs-mobile-panel] &': {
    visibility: 'visible',
    pointerEvents: 'auto',
  },
  [media.md]: { display: 'none' },
})

export const mainCss = css({
  containerName: 'docs-main',
  containerType: 'inline-size',
  width: '100%',
  minHeight: 'calc(100vh - var(--site-header-height))',
  margin: 0,
  padding: '24px',
  outline: 'none',
  background: 'var(--rmx-surface-lvl0)',
  [media.md]: {
    width: 'calc(100% - var(--docs-content-offset))',
    margin: 'var(--site-header-height) 0 0 var(--docs-content-offset)',
    padding: 'var(--docs-main-padding)',
    paddingLeft: 'var(--docs-content-padding-start)',
    borderRadius: '16px 0 0 16px',
    '&::before': {
      position: 'fixed',
      top: 'var(--site-header-height)',
      left: 'var(--docs-content-offset)',
      zIndex: 49,
      width: '16px',
      height: '16px',
      background:
        'radial-gradient(circle at 100% 100%, transparent 15.5px, var(--docs-shell-background) 16px)',
      content: "''",
      pointerEvents: 'none',
    },
  },
})

export const sidebarRailCss = css({
  display: 'none',
  [media.md]: {
    position: 'fixed',
    inset: 'var(--site-header-height) auto 0 0',
    zIndex: 30,
    display: 'block',
    width: 'var(--docs-content-offset)',
    background: 'var(--docs-shell-background)',
    pointerEvents: 'none',
  },
})

export const secondaryNavigationCss = css({
  position: 'fixed',
  inset: `${mobileNavigationTop} 0 auto`,
  zIndex: 70,
  display: 'block',
  alignSelf: 'start',
  width: 'auto',
  maxWidth: 'none',
  maxHeight: `calc(100dvh - ${mobileNavigationTop})`,
  padding: 'var(--rmx-space-lg)',
  overflowY: 'auto',
  visibility: 'hidden',
  background: 'var(--docs-shell-background)',
  boxShadow: 'var(--docs-panel-shadow)',
  pointerEvents: 'none',
  ':root[data-docs-mobile-panel="secondary"] &': {
    visibility: 'visible',
    pointerEvents: 'auto',
  },
  [media.md]: {
    position: 'static',
    inset: 'auto',
    zIndex: 'auto',
    display: 'none',
    maxHeight: 'none',
    padding: 0,
    overflowY: 'visible',
    visibility: 'visible',
    background: 'none',
    boxShadow: 'none',
    pointerEvents: 'auto',
  },
  '@container docs-main (width >= 56rem)': {
    position: 'sticky',
    top: 'calc(var(--site-header-height) + var(--docs-main-padding))',
    display: 'block',
    gridColumn: 2,
    gridRow: 1,
    maxHeight:
      'calc(100dvh - var(--site-header-height) - var(--docs-main-padding) - var(--rmx-space-xl))',
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
  },
})
