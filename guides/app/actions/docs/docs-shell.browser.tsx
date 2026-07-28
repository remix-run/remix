import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

export const DocsShellBehavior = clientEntry(
  import.meta.url,
  function DocsShellBehavior(handle: Handle) {
    return () => {
      handle.queueTask(startDocsShellBehavior)
      return null
    }
  },
)

export function startDocsShellBehavior(signal: AbortSignal) {
  let root = document.documentElement
  let chapterNavigation = document.getElementById('docs-chapters-navigation')
  let navToggle = document.getElementById('docs-nav-toggle')

  let navCollapsed = false

  setChapterNavigationCollapsed(false)
  updateScrollableNavigation()

  navToggle?.addEventListener('click', toggleChapterNavigation, { signal })
  window.addEventListener('resize', updateScrollableNavigation, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) updateScrollableNavigation()
  })

  signal.addEventListener('abort', () => {
    setChapterNavigationCollapsed(false)
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
    navToggle?.setAttribute('aria-expanded', String(!collapsed))
    navToggle?.setAttribute(
      'aria-label',
      collapsed ? 'Expand chapter navigation' : 'Collapse chapter navigation',
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
