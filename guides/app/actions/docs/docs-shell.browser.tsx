import { clientEntry } from 'remix/ui'

export const DocsShellBehavior = clientEntry(import.meta.url, function DocsShellBehavior(handle) {
  handle.queueTask(startDocsShellBehavior)
  return () => null
})

export function startDocsShellBehavior(signal: AbortSignal) {
  let root = document.documentElement
  let chapterNavigation = document.getElementById('docs-chapters-navigation')
  let navToggle = document.getElementById('docs-nav-toggle')
  let compactSearch = document.getElementById('docs-search-compact')
  let expandedSearch = document.getElementById('docs-search-button')
  let menuToggle = document.getElementById('site-menu-toggle')
  let primaryNavigation = document.getElementById('site-primary-navigation')
  let mobileViewport = window.matchMedia('(width < 640px)')

  let navCollapsed = false
  let mobileMenuOpen = false

  setChapterNavigationCollapsed(false)
  setMobileMenuOpen(false)
  root.toggleAttribute('data-mobile-menu-ready', true)
  updateScrollableNavigation()

  navToggle?.addEventListener('click', toggleChapterNavigation, { signal })
  menuToggle?.addEventListener('click', toggleMobileMenu, { signal })
  primaryNavigation?.addEventListener('click', closeMobileMenu, { signal })
  mobileViewport.addEventListener('change', handleMobileViewportChange, { signal })
  window.addEventListener('resize', updateScrollableNavigation, { signal })
  document.addEventListener('keydown', handleKeyDown, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) updateScrollableNavigation()
  })

  signal.addEventListener('abort', () => {
    setChapterNavigationCollapsed(false)
    setMobileMenuOpen(false)
    root.removeAttribute('data-mobile-menu-ready')
    chapterNavigation?.removeAttribute('data-scrollable')
  })

  function updateScrollableNavigation() {
    if (!chapterNavigation) return
    chapterNavigation.toggleAttribute(
      'data-scrollable',
      chapterNavigation.scrollHeight > chapterNavigation.clientHeight,
    )
  }

  function toggleChapterNavigation() {
    setChapterNavigationCollapsed(!navCollapsed)
  }

  function setChapterNavigationCollapsed(collapsed: boolean) {
    navCollapsed = collapsed
    root.toggleAttribute('data-docs-nav-collapsed', collapsed)
    chapterNavigation?.toggleAttribute('inert', collapsed)
    setAriaHidden(chapterNavigation, collapsed)
    setAriaHidden(compactSearch, !collapsed)
    setAriaHidden(expandedSearch, collapsed)
    navToggle?.setAttribute('aria-expanded', String(!collapsed))
    navToggle?.setAttribute(
      'aria-label',
      collapsed ? 'Expand chapter navigation' : 'Collapse chapter navigation',
    )
  }

  function toggleMobileMenu() {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  function handleMobileViewportChange(event: MediaQueryListEvent) {
    if (!event.matches) {
      setMobileMenuOpen(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && mobileMenuOpen) {
      setMobileMenuOpen(false)
      menuToggle?.focus()
    }
  }

  function setMobileMenuOpen(open: boolean) {
    mobileMenuOpen = open
    root.toggleAttribute('data-mobile-menu-open', open)
    menuToggle?.setAttribute('aria-expanded', String(open))
    menuToggle?.setAttribute(
      'aria-label',
      open ? 'Close primary navigation' : 'Open primary navigation',
    )
  }
}

function setAriaHidden(element: HTMLElement | null, hidden: boolean) {
  if (hidden) {
    element?.setAttribute('aria-hidden', 'true')
  } else {
    element?.removeAttribute('aria-hidden')
  }
}
