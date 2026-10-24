import { css, type Handle } from 'remix/component'

import { button } from './button.ts'
import { Icon } from './icon.tsx'
import { media } from './media.ts'

export interface DocsNavigationLink {
  href: string
  label: string
  current?: 'location' | 'page'
}

export type DocsNavigationLinkId =
  | 'docs'
  | 'ui'
  | 'github'
  | 'blog'
  | 'newsletter'
  | 'jam'
  | 'store'

export function createDocsNavigationLinks(): Map<DocsNavigationLinkId, DocsNavigationLink> {
  return new Map<DocsNavigationLinkId, DocsNavigationLink>()
    .set('docs', { href: 'https://docs.remix.run', label: 'Docs' })
    .set('github', { href: 'https://github.com/remix-run/remix', label: 'GitHub' })
    .set('blog', { href: 'https://remix.run/blog', label: 'Blog' })
    .set('newsletter', { href: 'https://remix.run/newsletter', label: 'Newsletter' })
    .set('jam', { href: 'https://remix.run/jam/2026', label: 'Jam' })
    .set('store', { href: 'https://shop.remix.run', label: 'Store' })
}

export interface DocsHeaderProps {
  brandLabel: string
  navigationLinks: readonly DocsNavigationLink[]
  compactSearch?: boolean
  searchEnabled?: boolean
}

export function DocsHeader(handle: Handle<DocsHeaderProps>) {
  return () => (
    <header mix={docsHeaderCss}>
      <a
        id="docs-brand"
        href="https://remix.run"
        aria-label={handle.props.brandLabel}
        mix={brandCss}
      >
        <img
          src="/remix-logo-light-mode.svg"
          alt=""
          width="37"
          height="16"
          mix={[brandImageCss, logoMarkCss]}
        />
        <img
          src="/remix-wordmark-light-mode.svg"
          alt=""
          width="163"
          height="16"
          mix={[brandImageCss, wordmarkCss]}
        />
      </a>

      {handle.props.searchEnabled !== false && handle.props.compactSearch ? (
        <button
          id="docs-search-compact"
          type="button"
          aria-label="Search"
          aria-hidden="true"
          aria-haspopup="dialog"
          aria-expanded="false"
          data-docs-collapsed-only
          mix={compactSearchButtonCss}
        >
          <Icon name="search" />
        </button>
      ) : null}

      <button
        id="site-menu-toggle"
        type="button"
        popovertarget="site-primary-navigation"
        mix={[button.ghost, menuToggleCss]}
      >
        <span aria-hidden="true" mix={menuIconCss}>
          <span />
          <span />
          <span />
        </span>
      </button>

      <nav aria-label="Primary" mix={[navigationCss, desktopNavigationCss]}>
        <PrimaryNavigationLinks links={handle.props.navigationLinks} />
      </nav>

      <nav
        id="site-primary-navigation"
        aria-label="Primary"
        popover="auto"
        mix={[navigationCss, mobileNavigationCss]}
      >
        <PrimaryNavigationLinks links={handle.props.navigationLinks} />
      </nav>

      {handle.props.searchEnabled !== false ? (
        <button
          id="docs-search-button"
          type="button"
          aria-label="Search"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-keyshortcuts="Meta+K Control+K"
          data-docs-expanded-only={handle.props.compactSearch || undefined}
          mix={
            handle.props.compactSearch
              ? [searchButtonCss, expandedOnlySearchButtonCss]
              : [searchButtonCss, collapsibleSearchButtonCss]
          }
        >
          <span
            mix={
              handle.props.compactSearch
                ? searchButtonLabelCss
                : [searchButtonLabelCss, collapsibleSearchButtonLabelCss]
            }
          >
            <Icon name="search" />
            <span mix={searchButtonTextCss}>Search</span>
          </span>
          <span aria-hidden="true" mix={searchButtonShortcutCss}>
            <kbd mix={searchShortcutKeyCss}>⌘</kbd>
            <kbd mix={searchShortcutKeyCss}>K</kbd>
          </span>
        </button>
      ) : null}
    </header>
  )
}

const docsHeaderCss = css({
  position: 'relative',
  inset: '0 0 auto',
  zIndex: 50,
  display: 'block',
  height: 'var(--site-header-height)',
  padding: 0,
  border: 0,
  borderBottom: 'var(--rmx-space-px) solid var(--rmx-color-border-subtle)',
  background: 'var(--docs-shell-background)',
  [media.md]: {
    position: 'fixed',
    borderBottom: 0,
  },
})

const compactSearchButtonCss = css({
  position: 'fixed',
  top: 'calc((var(--site-header-height) - 32px) / 2)',
  left: 'calc(var(--docs-sidebar-inline-start) + 97px)',
  zIndex: 51,
  display: 'none',
  width: '32px',
  height: '32px',
  padding: '8px',
  visibility: 'hidden',
  placeItems: 'center',
  border: 0,
  borderRadius: 'var(--rmx-radius-md)',
  color: 'var(--rmx-color-text-secondary)',
  background: 'transparent',
  cursor: 'pointer',
  opacity: 0,
  pointerEvents: 'none',
  '&:hover, &:focus-visible': {
    background: 'var(--docs-nav-hover-background)',
  },
  '& svg': {
    display: 'block',
    width: '16px',
    height: '16px',
  },
  ':root[data-docs-nav-collapsed] &': {
    visibility: 'visible',
    opacity: 1,
    pointerEvents: 'auto',
  },
  [media.md]: {
    display: 'grid',
  },
})

const searchButtonCss = css({
  position: 'absolute',
  top: '16px',
  left: 'min(211px, calc(100% - 125px))',
  zIndex: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: '8px',
  border: 0,
  borderRadius: 'var(--rmx-radius-md)',
  color: 'var(--rmx-color-text-secondary)',
  background: 'transparent',
  fontSize: 'var(--docs-font-size-ui)',
  opacity: 1,
  cursor: 'pointer',
  '&:hover, &:focus-visible': {
    background: 'var(--docs-nav-hover-background)',
  },
  '& svg': {
    display: 'block',
    width: '16px',
    height: '16px',
  },
  [media.md]: {
    position: 'fixed',
    top: 'var(--site-header-height)',
    left: 'var(--docs-sidebar-inline-start)',
    justifyContent: 'space-between',
    // Ends at the collapse icon, which sits 8px inside its button at the column's edge.
    width: 'calc(var(--docs-sidebar-content-width) - 8px)',
    border: '1px solid var(--docs-nav-control-border)',
  },
})

const expandedOnlySearchButtonCss = css({
  [media.md]: {
    ':root[data-docs-nav-collapsed] &': {
      visibility: 'hidden',
      opacity: 0,
      transform: 'translateX(calc(-1 * var(--docs-sidebar-offset)))',
      pointerEvents: 'none',
    },
  },
})

const collapsibleSearchButtonCss = css({
  [media.md]: {
    ':root[data-docs-nav-collapsed] &': {
      top: 'calc((var(--site-header-height) - 32px) / 2)',
      left: 'calc(var(--docs-sidebar-inline-start) + 97px)',
      justifyContent: 'center',
      width: '32px',
      padding: '8px',
      border: 0,
    },
  },
})

const searchButtonLabelCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  [media.md]: {
    gap: '12px',
  },
})

const collapsibleSearchButtonLabelCss = css({
  ':root[data-docs-nav-collapsed] &': {
    gap: 0,
  },
})

const searchButtonTextCss = css({
  display: 'none',
  [media.md]: {
    display: 'inline',
    ':root[data-docs-nav-collapsed] &': {
      display: 'none',
    },
  },
})

const searchButtonShortcutCss = css({
  display: 'none',
  alignItems: 'center',
  gap: '4px',
  [media.md]: {
    display: 'flex',
    ':root[data-docs-nav-collapsed] &': {
      display: 'none',
    },
  },
})

const searchShortcutKeyCss = css({
  display: 'grid',
  width: '16px',
  height: '16px',
  padding: 0,
  placeItems: 'center',
  border: '1px solid var(--docs-key-border)',
  borderRadius: 'var(--rmx-radius-sm)',
  color: 'var(--rmx-color-text-muted)',
  background: 'var(--rmx-surface-lvl0)',
  fontFamily: 'var(--rmx-font-family-mono)',
  fontSize: 'var(--docs-font-size-label)',
  lineHeight: 1,
})

const brandCss = css({
  position: 'absolute',
  top: 'calc((var(--site-header-height) - 16px) / 2)',
  left: '24px',
  display: 'block',
  width: '163px',
  height: '16px',
  color: 'var(--rmx-color-text-primary)',
  textDecoration: 'none',
  [media.md]: {
    left: 'var(--docs-sidebar-inline-start)',
    ':root[data-docs-nav-collapsed] &': {
      width: '37px',
    },
  },
})

const brandImageCss = css({
  position: 'absolute',
  inset: '0 auto auto 0',
  display: 'block',
  width: 'auto',
  height: '16px',
  maxHeight: 'none',
  pointerEvents: 'none',
  '@media (prefers-color-scheme: dark)': {
    filter: 'invert(1)',
  },
})

const logoMarkCss = css({
  opacity: 0,
  [media.md]: {
    opacity: 'var(--docs-nav-collapse)',
  },
})

const wordmarkCss = css({
  opacity: 1,
  [media.md]: {
    opacity: 'calc(1 - var(--docs-nav-collapse))',
  },
})

const menuToggleCss = css({
  position: 'absolute',
  top: '12px',
  right: '16px',
  display: 'none',
  alignItems: 'center',
  gap: '8px',
  minWidth: '44px',
  minHeight: '40px',
  padding: '8px 10px',
  cursor: 'pointer',
  '&:hover, &:focus-visible': {
    background: 'var(--docs-nav-hover-background)',
  },
  '@supports selector(:popover-open)': {
    display: 'inline-flex',
  },
  [media.sm]: {
    display: 'none',
  },
})

const menuIconCss = css({
  display: 'grid',
  width: '16px',
  gap: '3px',
  '& span': {
    display: 'block',
    height: '1.5px',
    borderRadius: 'var(--rmx-radius-full)',
    background: 'currentColor',
    transformOrigin: 'center',
  },
  ':where(header:has(#site-primary-navigation:popover-open)) & span:nth-child(1)': {
    transform: 'translateY(4.5px) rotate(45deg)',
  },
  ':where(header:has(#site-primary-navigation:popover-open)) & span:nth-child(2)': {
    opacity: 0,
  },
  ':where(header:has(#site-primary-navigation:popover-open)) & span:nth-child(3)': {
    transform: 'translateY(-4.5px) rotate(-45deg)',
  },
})

const navigationCss = css({
  position: 'fixed',
  inset: '64px 0 auto',
  zIndex: 60,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  width: '100%',
  height: 'auto',
  gap: 'var(--docs-nav-item-gap)',
  margin: 0,
  padding: '8px 16px 16px',
  overflow: 'visible',
  border: 0,
  borderBottom: '1px solid var(--rmx-color-border-subtle)',
  background: 'var(--docs-shell-background)',
  boxShadow: 'var(--docs-menu-shadow)',
  fontSize: 'var(--rmx-font-size-md)',
  flexWrap: 'nowrap',
  [media.sm]: {
    position: 'absolute',
    inset: '0 24px auto auto',
    zIndex: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 'auto',
    height: 'var(--site-header-height)',
    gap: '20px',
    padding: 0,
    border: 0,
    background: 'none',
    boxShadow: 'none',
  },
  [media.md]: {
    right: 'var(--docs-edge-inset)',
    gap: '24px',
  },
})

const desktopNavigationCss = css({
  display: 'none',
  [media.sm]: {
    display: 'flex',
  },
})

const mobileNavigationCss = css({
  display: 'none',
  '@supports selector(:popover-open)': {
    '&:popover-open': {
      display: 'flex',
    },
  },
  [media.sm]: {
    '&, &:popover-open': {
      display: 'none',
    },
  },
})

const navigationLinkCss = css({
  color: 'var(--docs-header-link)',
  opacity: 0.8,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  minHeight: '44px',
  padding: '8px var(--docs-nav-item-inset)',
  borderRadius: 'var(--rmx-radius-md)',
  '&:hover, &:focus-visible, &[aria-current]': {
    color: 'var(--docs-header-link-active)',
    opacity: 1,
  },
  '&:hover, &:focus-visible': {
    background: 'var(--docs-nav-hover-background)',
  },
  [media.sm]: {
    display: 'inline',
    alignItems: 'normal',
    minHeight: 'auto',
    padding: 0,
    borderRadius: 0,
    '&:hover, &:focus-visible': {
      background: 'none',
    },
  },
})

function PrimaryNavigationLinks(handle: Handle<{ links: readonly DocsNavigationLink[] }>) {
  return () => (
    <>
      {handle.props.links.map((link) => (
        <a
          key={`${link.label}:${link.href}`}
          href={link.href}
          aria-current={link.current}
          mix={navigationLinkCss}
        >
          {link.label}
        </a>
      ))}
    </>
  )
}
