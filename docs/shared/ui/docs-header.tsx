import { css, type Handle } from 'remix/ui'

import { Icon } from './icon.tsx'

export interface DocsNavigationLink {
  href: string
  label: string
  current?: 'location' | 'page'
}

export type DocsNavigationLinkId = 'guides' | 'api' | 'blog' | 'jam' | 'store' | 'github'

export function createDocsNavigationLinks(): Map<DocsNavigationLinkId, DocsNavigationLink> {
  return new Map<DocsNavigationLinkId, DocsNavigationLink>()
    .set('guides', { href: 'https://guides.remix.run/', label: 'Guides' })
    .set('api', { href: 'https://api.remix.run', label: 'API' })
    .set('blog', { href: 'https://remix.run/blog', label: 'Blog' })
    .set('jam', { href: 'https://remix.run/jam/2026', label: 'Jam' })
    .set('store', { href: 'https://shop.remix.run', label: 'Store' })
    .set('github', { href: 'https://github.com/remix-run/remix', label: 'GitHub' })
}

export interface DocsHeaderProps {
  brandLabel: string
  navigationToggleLabel: string
  navigationLinks: readonly DocsNavigationLink[]
  compactSearch?: boolean
}

export function DocsHeader(handle: Handle<DocsHeaderProps>) {
  return () => (
    <header mix={docsHeaderCss}>
      <a href="https://remix.run" aria-label={handle.props.brandLabel} mix={brandCss}>
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

      <button
        id="docs-nav-toggle"
        class="docs-nav-toggle"
        type="button"
        aria-controls="docs-chapters-navigation"
        aria-expanded="true"
        aria-label={handle.props.navigationToggleLabel}
      >
        <Icon name="layout-left" />
      </button>

      {handle.props.compactSearch ? (
        <button
          id="docs-search-compact"
          class="docs-search-compact"
          type="button"
          aria-label="Search"
          aria-hidden="true"
          aria-haspopup="dialog"
          aria-expanded="false"
        >
          <Icon name="search" />
        </button>
      ) : null}

      <button
        id="site-menu-toggle"
        type="button"
        popovertarget="site-primary-navigation"
        mix={menuToggleCss}
      >
        <span aria-hidden="true" mix={menuIconCss}>
          <span />
          <span />
          <span />
        </span>
        Menu
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

      <button
        id="docs-search-button"
        class="docs-search-button"
        type="button"
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span class="docs-search-button__label">
          <Icon name="search" />
          <span>Search</span>
        </span>
        <span class="docs-search-button__shortcut" aria-hidden="true">
          <kbd>⌘</kbd>
          <kbd>K</kbd>
        </span>
      </button>
    </header>
  )
}

const docsHeaderCss = css({
  position: 'fixed',
  inset: '0 0 auto',
  zIndex: 50,
  display: 'block',
  height: 'var(--site-header-height)',
  padding: 0,
  border: 0,
  background: 'var(--docs-shell-background)',
})

const brandCss = css({
  position: 'absolute',
  top: '24px',
  left: 'var(--docs-header-brand-inline-start, 24px)',
  display: 'block',
  width: '163px',
  height: '16px',
  color: 'var(--rmx-color-text-primary)',
  textDecoration: 'none',
  ':root[data-docs-nav-collapsed] &': {
    width: '37px',
  },
  '@media (width < 900px)': {
    '&, :root[data-docs-nav-collapsed] &': {
      width: '163px',
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
  transition: 'opacity var(--docs-nav-duration) var(--docs-nav-easing)',
  '@media (prefers-color-scheme: dark)': {
    filter: 'invert(1)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
})

const logoMarkCss = css({
  opacity: 0,
  ':root[data-docs-nav-collapsed] &': {
    opacity: 1,
  },
  '@media (width < 900px)': {
    '&, :root[data-docs-nav-collapsed] &': {
      opacity: 0,
    },
  },
})

const wordmarkCss = css({
  opacity: 1,
  ':root[data-docs-nav-collapsed] &': {
    opacity: 0,
  },
  '@media (width < 900px)': {
    '&, :root[data-docs-nav-collapsed] &': {
      opacity: 1,
    },
  },
})

const menuToggleCss = css({
  display: 'none',
  '@media (width < 640px)': {
    position: 'absolute',
    top: '12px',
    right: '16px',
    alignItems: 'center',
    gap: '8px',
    minWidth: '44px',
    minHeight: '40px',
    padding: '8px 10px',
    border: '1px solid var(--docs-nav-control-border)',
    borderRadius: '8px',
    color: 'var(--docs-nav-link)',
    background: 'transparent',
    fontSize: '14px',
    fontWeight: 'var(--rmx-font-weight-semibold)',
    cursor: 'pointer',
    '&:hover, &:focus-visible': {
      background: 'var(--docs-nav-hover-background)',
    },
    '@supports selector(:popover-open)': {
      display: 'inline-flex',
    },
  },
})

const menuIconCss = css({
  '@media (width < 640px)': {
    display: 'grid',
    width: '16px',
    gap: '3px',
    '& span': {
      display: 'block',
      height: '1.5px',
      borderRadius: 'var(--rmx-radius-full)',
      background: 'currentColor',
      transformOrigin: 'center',
      transition: 'transform 150ms ease, opacity 150ms ease',
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
  },
  '@media (prefers-reduced-motion: reduce)': {
    '& span': {
      transition: 'none',
    },
  },
})

const navigationCss = css({
  position: 'absolute',
  top: 0,
  right: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  width: 'auto',
  height: 'var(--site-header-height)',
  gap: '32px',
  overflow: 'visible',
  fontSize: '16px',
  flexWrap: 'nowrap',
  '@media (width < 900px)': {
    left: '210px',
    right: '24px',
    justifyContent: 'flex-start',
    gap: '20px',
    overflowX: 'auto',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  '@media (width >= 640px) and (width < 900px)': {
    left: 'auto',
    right: '24px',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  '@media (width < 640px)': {
    position: 'fixed',
    inset: '64px 0 auto',
    zIndex: 60,
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    height: 'auto',
    gap: '4px',
    margin: 0,
    padding: '8px 16px 16px',
    overflow: 'visible',
    border: 0,
    borderBottom: '1px solid var(--rmx-color-border-subtle)',
    background: 'var(--docs-shell-background)',
    boxShadow: '0 12px 24px rgb(0 0 0 / 12%)',
  },
})

const desktopNavigationCss = css({
  '@media (width < 640px)': {
    display: 'none',
  },
})

const mobileNavigationCss = css({
  '@media (width >= 640px)': {
    display: 'none',
  },
  '@media (width < 640px)': {
    '@supports selector(:popover-open)': {
      '&:not(:popover-open)': {
        display: 'none',
      },
    },
  },
})

const navigationLinkCss = css({
  color: 'var(--docs-nav-link)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  '&:hover': {
    color: 'var(--docs-nav-link-hover)',
  },
  '@media (width < 640px)': {
    display: 'flex',
    alignItems: 'center',
    minHeight: '44px',
    padding: '8px 12px',
    borderRadius: '8px',
    '&:hover, &:focus-visible': {
      background: 'var(--docs-nav-hover-background)',
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
