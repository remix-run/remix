import type { Handle, RemixNode } from 'remix/ui'
import button from 'remix/ui/button'

import { DocsShellBehavior } from './docs-shell.browser.tsx'
import {
  mobileNavigationBackdropCss,
  mobileNavigationBarCss,
  mobileNavigationButtonCss,
  mainCss,
  navigationCss,
  navigationToggleCss,
  secondaryNavigationCss,
  sidebarRailCss,
  skipLinkCss,
} from './docs-shell-styles.ts'
import { Icon } from './icon.tsx'

export interface DocsShellProps {
  header: RemixNode
  navigation: RemixNode
  navigationLabel: string
  mobileNavigationLabel: string
  navigationName: string
  hasSecondaryNavigation?: boolean
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
      <nav
        id="docs-mobile-navigation-bar"
        aria-label="Documentation navigation"
        mix={mobileNavigationBarCss}
      >
        <button
          id="docs-mobile-navigation-toggle"
          type="button"
          aria-controls="docs-navigation"
          aria-expanded="false"
          mix={[button({ tone: 'ghost' }), mobileNavigationButtonCss]}
        >
          <span>{handle.props.mobileNavigationLabel}</span>
          <Icon name="chevron-d" />
        </button>
        {handle.props.hasSecondaryNavigation ? (
          <button
            id="docs-mobile-secondary-navigation-toggle"
            type="button"
            aria-controls="docs-secondary-navigation"
            aria-expanded="false"
            mix={[button({ tone: 'ghost' }), mobileNavigationButtonCss]}
          >
            <span>On this page</span>
            <Icon name="chevron-d" />
          </button>
        ) : null}
      </nav>
      <button
        id="docs-mobile-navigation-backdrop"
        type="button"
        aria-label="Close navigation"
        tabIndex={-1}
        mix={mobileNavigationBackdropCss}
      />
      <main id="main-content" data-docs-main tabIndex={-1} data-pagefind-body mix={mainCss}>
        {handle.props.children}
      </main>
      {handle.props.footer}
      <DocsShellBehavior navigationName={handle.props.navigationName} />
    </>
  )
}

export interface DocsSecondaryNavigationProps {
  children: RemixNode
  pagefindIgnore?: boolean
}

export function DocsSecondaryNavigation(handle: Handle<DocsSecondaryNavigationProps>) {
  return () => (
    <aside
      id="docs-secondary-navigation"
      data-pagefind-ignore={handle.props.pagefindIgnore || undefined}
      mix={secondaryNavigationCss}
    >
      {handle.props.children}
    </aside>
  )
}
