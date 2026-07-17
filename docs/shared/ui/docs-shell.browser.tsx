import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

interface DocsShellBehaviorProps {
  [key: string]: string
  navigationName: string
}

interface DocsShellBehaviorOptions {
  navigationName: string
}

export const DocsShellBehavior = clientEntry<DocsShellBehaviorProps>(
  import.meta.url,
  function DocsShellBehavior(handle: Handle<DocsShellBehaviorProps>) {
    return () => {
      handle.queueTask((signal) =>
        startDocsShellBehavior(signal, { navigationName: handle.props.navigationName }),
      )
      return null
    }
  },
)

export function startDocsShellBehavior(
  signal: AbortSignal,
  options: DocsShellBehaviorOptions,
): void {
  let root = document.documentElement
  let navigation = document.getElementById('docs-navigation')
  let navigationToggle = document.getElementById('docs-navigation-toggle')
  let collapsedOnlyElements = document.querySelectorAll<HTMLElement>('[data-docs-collapsed-only]')
  let expandedOnlyElements = document.querySelectorAll<HTMLElement>('[data-docs-expanded-only]')
  let navigationCollapsed = root.hasAttribute('data-docs-nav-collapsed')

  updateScrollableNavigation()

  navigationToggle?.addEventListener('click', toggleNavigation, { signal })
  window.addEventListener('resize', updateScrollableNavigation, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) updateScrollableNavigation()
  })

  signal.addEventListener('abort', () => {
    navigation?.removeAttribute('data-scrollable')
  })

  function updateScrollableNavigation() {
    if (navigation) {
      navigation.toggleAttribute(
        'data-scrollable',
        navigation.scrollHeight > navigation.clientHeight,
      )
    }
    setNavigationCollapsed(navigationCollapsed)
  }

  function toggleNavigation() {
    setNavigationCollapsed(!navigationCollapsed)
  }

  function setNavigationCollapsed(collapsed: boolean) {
    navigationCollapsed = collapsed
    let showCollapsedOnly = collapsed && window.matchMedia('(width >= 900px)').matches
    root.toggleAttribute('data-docs-nav-collapsed', collapsed)
    setHidden(navigation, collapsed)
    for (let element of collapsedOnlyElements) setHidden(element, !showCollapsedOnly)
    for (let element of expandedOnlyElements) setHidden(element, showCollapsedOnly)
    navigationToggle?.setAttribute('aria-expanded', String(!collapsed))
    navigationToggle?.setAttribute(
      'aria-label',
      `${collapsed ? 'Expand' : 'Collapse'} ${options.navigationName}`,
    )
  }
}

function setHidden(element: HTMLElement | null, hidden: boolean) {
  element?.toggleAttribute('inert', hidden)
  if (hidden) {
    element?.setAttribute('aria-hidden', 'true')
  } else {
    element?.removeAttribute('aria-hidden')
  }
}
