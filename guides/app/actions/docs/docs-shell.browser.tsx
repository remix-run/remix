import { clientEntry } from 'remix/ui'

export const DocsShellBehavior = clientEntry(import.meta.url, function DocsShellBehavior(handle) {
  handle.queueTask((signal) => {
    let root = document.documentElement
    let chapterNavigation = document.getElementById('docs-chapters-navigation')
    let navToggle = document.getElementById('docs-nav-toggle')
    let menuToggle = document.getElementById('site-menu-toggle')
    let primaryNavigation = document.getElementById('site-primary-navigation')
    let mobileViewport = window.matchMedia('(width < 640px)')

    let navCollapsed = false
    let mobileMenuOpen = false

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
      root.removeAttribute('data-docs-nav-collapsed')
      root.removeAttribute('data-mobile-menu-open')
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
      navCollapsed = !navCollapsed
      root.toggleAttribute('data-docs-nav-collapsed', navCollapsed)
      navToggle?.setAttribute('aria-expanded', String(!navCollapsed))
      navToggle?.setAttribute(
        'aria-label',
        navCollapsed ? 'Expand chapter navigation' : 'Collapse chapter navigation',
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
  })

  return () => null
})
