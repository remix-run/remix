import { css } from 'remix/ui'

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

export const navigationToggleCss = css({
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
  '&:hover, &:focus-visible': { background: 'var(--docs-nav-hover-background)' },
  '& svg': { display: 'block', width: '16px', height: '16px' },
  ':root[data-docs-nav-collapsed] &': { left: '85px' },
  '@media (width < 900px)': { display: 'none' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

export const navigationCss = css({
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
  },
  '@media (max-height: 715px) and (width >= 900px)': {
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehaviorY: 'auto',
  },
  '@media (width < 900px)': {
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
    boxShadow: '0 12px 32px rgb(0 0 0 / 18%)',
    opacity: 1,
    clipPath: 'inset(0 0 100% 0)',
    pointerEvents: 'none',
    transition:
      'clip-path var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s linear var(--docs-nav-duration)',
    '&[data-scrollable]': {
      width: 'auto',
      maxWidth: 'none',
      marginLeft: 0,
      padding: 'var(--rmx-space-lg)',
    },
    '& > *': {
      transform: 'translateY(calc(-1 * var(--rmx-space-md)))',
      transition: 'transform var(--docs-nav-duration) var(--docs-nav-easing)',
    },
    ':root[data-docs-mobile-panel="navigation"] &': {
      visibility: 'visible',
      clipPath: 'inset(0)',
      pointerEvents: 'auto',
      transition: 'clip-path var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s',
      '& > *': { transform: 'none' },
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '& > *': { transition: 'none' },
  },
})

export const mobileNavigationBarCss = css({
  display: 'none',
  '@media (width < 900px)': {
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
  },
})

export const mobileNavigationButtonCss = css({
  minWidth: 0,
  minHeight: '36px',
  flexShrink: 1,
  paddingInline: 'var(--rmx-space-sm)',
  color: 'var(--docs-nav-link)',
  fontSize: 'var(--rmx-font-size-sm)',
  '&[aria-expanded="true"]': {
    background: 'var(--docs-nav-hover-background)',
  },
  '& svg': {
    display: 'block',
    flex: '0 0 auto',
    width: '16px',
    height: '16px',
    transition: 'transform 150ms ease-in-out',
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
  '@media (prefers-reduced-motion: reduce)': {
    '& svg': {
      transition: 'none',
    },
  },
})

export const mobileNavigationBackdropCss = css({
  display: 'none',
  '@media (width < 900px)': {
    position: 'fixed',
    inset: `${mobileNavigationTop} 0 0`,
    zIndex: 65,
    display: 'block',
    padding: 0,
    visibility: 'hidden',
    border: 0,
    background: 'rgb(0 0 0 / 32%)',
    opacity: 0,
    pointerEvents: 'none',
    transition:
      'opacity var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s linear var(--docs-nav-duration)',
    ':root[data-docs-mobile-panel] &': {
      visibility: 'visible',
      opacity: 1,
      pointerEvents: 'auto',
      transition: 'opacity var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s',
    },
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

export const mainCss = css({
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
    '&::before': { left: 'var(--docs-collapsed-offset)' },
  },
  '@media (width < 900px)': {
    '&, :root[data-docs-nav-collapsed] &': {
      width: '100%',
      margin: 0,
      padding: '24px',
      borderRadius: 0,
    },
    '&::before': { display: 'none' },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&::before': { transition: 'none' },
  },
})

export const sidebarRailCss = css({
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
    ':root[data-docs-nav-collapsed] &': { width: 'var(--docs-collapsed-offset)' },
  },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})

export const secondaryNavigationCss = css({
  display: 'none',
  alignSelf: 'start',
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
  '@media (width < 900px)': {
    position: 'fixed',
    inset: `${mobileNavigationTop} 0 auto`,
    zIndex: 70,
    display: 'block',
    width: 'auto',
    maxWidth: 'none',
    maxHeight: `calc(100dvh - ${mobileNavigationTop})`,
    padding: 'var(--rmx-space-lg)',
    overflowY: 'auto',
    visibility: 'hidden',
    background: 'var(--docs-shell-background)',
    boxShadow: '0 12px 32px rgb(0 0 0 / 18%)',
    clipPath: 'inset(0 0 100% 0)',
    pointerEvents: 'none',
    transition:
      'clip-path var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s linear var(--docs-nav-duration)',
    '& > *': {
      transform: 'translateY(calc(-1 * var(--rmx-space-md)))',
      transition: 'transform var(--docs-nav-duration) var(--docs-nav-easing)',
    },
    ':root[data-docs-mobile-panel="secondary"] &': {
      visibility: 'visible',
      clipPath: 'inset(0)',
      pointerEvents: 'auto',
      transition: 'clip-path var(--docs-nav-duration) var(--docs-nav-easing), visibility 0s',
      '& > *': { transform: 'none' },
    },
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '& > *': { transition: 'none' },
  },
})
