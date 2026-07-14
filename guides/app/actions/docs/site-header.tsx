import { routes } from '../../routes.ts'
import { Icon } from '../../ui/icon.tsx'

export function SiteHeader() {
  return () => (
    <header class="site-header">
      <a href={routes.docs.index.href()} class="site-header__brand" aria-label="Remix Docs">
        <img
          class="site-header__logo-mark"
          src="/remix-logo-light-mode.svg"
          alt=""
          width="37"
          height="16"
        />
        <img
          class="site-header__wordmark"
          src="/remix-wordmark-light-mode.svg"
          alt=""
          width="163"
          height="16"
        />
      </a>

      <button
        id="docs-nav-toggle"
        class="docs-nav-toggle"
        type="button"
        aria-controls="docs-chapters-navigation"
        aria-expanded="true"
        aria-label="Collapse chapter navigation"
      >
        <Icon name="layout-left" />
      </button>

      <button
        id="docs-search-compact"
        class="docs-search-compact"
        type="button"
        aria-label="Search is not available yet"
        aria-hidden="true"
        disabled
      >
        <Icon name="search" />
      </button>

      <button
        id="site-menu-toggle"
        class="site-header__menu-toggle"
        type="button"
        popovertarget="site-primary-navigation"
      >
        <span class="site-header__menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Menu
      </button>

      <nav class="site-header__nav site-header__nav--desktop" aria-label="Primary">
        <PrimaryNavigationLinks />
      </nav>

      <nav
        id="site-primary-navigation"
        class="site-header__nav site-header__nav--mobile"
        aria-label="Primary"
        popover="auto"
      >
        <PrimaryNavigationLinks />
      </nav>

      <button
        id="docs-search-button"
        class="docs-search-button"
        type="button"
        aria-label="Search is not available yet"
        disabled
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

function PrimaryNavigationLinks() {
  return () => (
    <>
      <a href={routes.docs.index.href()} aria-current="location">
        Guides
      </a>
      <a href="https://api.remix.run">API</a>
      <a href="https://remix.run/blog">Blog</a>
      <a href="https://remix.run/jam/2026">Jam</a>
      <a href="https://shop.remix.run">Store</a>
      <a href="https://github.com/remix-run/remix">GitHub</a>
    </>
  )
}
