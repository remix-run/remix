import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

interface DocsShellBehaviorProps {
  [key: string]: string
  navigationName: string
}

interface DocsShellBehaviorOptions {
  navigationName: string
}

type MobilePanel = 'navigation' | 'secondary'

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
  let mobileNavigationToggle = document.getElementById('docs-mobile-navigation-toggle')
  let mobileNavigationBar = document.getElementById('docs-mobile-navigation-bar')
  let mobileSecondaryNavigationToggle = document.getElementById(
    'docs-mobile-secondary-navigation-toggle',
  )
  let secondaryNavigation = document.getElementById('docs-secondary-navigation')
  let mobileNavigationBackdrop = document.getElementById('docs-mobile-navigation-backdrop')
  let collapsedOnlyElements = document.querySelectorAll<HTMLElement>('[data-docs-collapsed-only]')
  let expandedOnlyElements = document.querySelectorAll<HTMLElement>('[data-docs-expanded-only]')
  let navigationCollapsed = root.hasAttribute('data-docs-nav-collapsed')
  let mobilePanel = readMobilePanel(root.getAttribute('data-docs-mobile-panel'))
  let mobilePanelTrigger: HTMLElement | null = null
  let bodyOverflow = document.body.style.overflow
  let mobileNavigationTop = root.style.getPropertyValue('--docs-mobile-navigation-top')

  updateShellState()

  navigationToggle?.addEventListener('click', toggleNavigation, { signal })
  mobileNavigationToggle?.addEventListener('click', toggleMobileNavigation, { signal })
  mobileSecondaryNavigationToggle?.addEventListener('click', toggleMobileSecondaryNavigation, {
    signal,
  })
  mobileNavigationBackdrop?.addEventListener('click', closeMobileNavigation, { signal })
  navigation?.addEventListener('click', closeMobileNavigationFromLink, { signal })
  secondaryNavigation?.addEventListener('click', closeMobileNavigationFromLink, { signal })
  window.addEventListener('keydown', closeMobileNavigationFromKeyboard, { signal })
  window.addEventListener('scroll', updateMobileNavigationTop, { signal })
  window.addEventListener('resize', updateShellState, { signal })

  void document.fonts.ready.then(() => {
    if (!signal.aborted) updateShellState()
  })

  signal.addEventListener('abort', () => {
    navigation?.removeAttribute('data-scrollable')
    root.removeAttribute('data-docs-mobile-panel')
    if (mobileNavigationTop) {
      root.style.setProperty('--docs-mobile-navigation-top', mobileNavigationTop)
    } else {
      root.style.removeProperty('--docs-mobile-navigation-top')
    }
    document.body.style.overflow = bodyOverflow
  })

  function updateShellState() {
    if (navigation) {
      navigation.toggleAttribute(
        'data-scrollable',
        navigation.scrollHeight > navigation.clientHeight,
      )
    }
    setNavigationCollapsed(navigationCollapsed)
    updateMobileNavigationTop()
    syncMobileNavigation()
  }

  function toggleNavigation() {
    setNavigationCollapsed(!navigationCollapsed)
  }

  function setNavigationCollapsed(collapsed: boolean) {
    navigationCollapsed = collapsed
    let desktop = !isMobile()
    let showCollapsedOnly = collapsed && desktop
    root.toggleAttribute('data-docs-nav-collapsed', collapsed)
    if (desktop) setHidden(navigation, collapsed)
    for (let element of collapsedOnlyElements) setHidden(element, !showCollapsedOnly)
    for (let element of expandedOnlyElements) setHidden(element, showCollapsedOnly)
    navigationToggle?.setAttribute('aria-expanded', String(!collapsed))
    navigationToggle?.setAttribute(
      'aria-label',
      `${collapsed ? 'Expand' : 'Collapse'} ${options.navigationName}`,
    )
  }

  function toggleMobileNavigation() {
    setMobilePanel(mobilePanel === 'navigation' ? null : 'navigation', mobileNavigationToggle)
  }

  function toggleMobileSecondaryNavigation() {
    setMobilePanel(
      mobilePanel === 'secondary' ? null : 'secondary',
      mobileSecondaryNavigationToggle,
    )
  }

  function closeMobileNavigation() {
    setMobilePanel(null, mobilePanelTrigger, true)
  }

  function closeMobileNavigationFromLink(event: MouseEvent) {
    if (event.target instanceof Element && event.target.closest('a')) {
      setMobilePanel(null)
    }
  }

  function closeMobileNavigationFromKeyboard(event: KeyboardEvent) {
    if (event.key === 'Escape' && mobilePanel) {
      event.preventDefault()
      closeMobileNavigation()
    }
  }

  function setMobilePanel(
    panel: MobilePanel | null,
    trigger: HTMLElement | null = null,
    restoreFocus = false,
  ) {
    let previousTrigger = mobilePanelTrigger
    mobilePanel = panel
    mobilePanelTrigger = panel ? trigger : null
    if (panel) {
      root.setAttribute('data-docs-mobile-panel', panel)
    } else {
      root.removeAttribute('data-docs-mobile-panel')
    }
    syncMobileNavigation()

    if (panel) {
      let panelElement = panel === 'navigation' ? navigation : secondaryNavigation
      panelElement?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus()
    } else if (restoreFocus) {
      previousTrigger?.focus()
    }
  }

  function syncMobileNavigation() {
    let mobile = isMobile()
    if (!mobile && mobilePanel) {
      mobilePanel = null
      mobilePanelTrigger = null
      root.removeAttribute('data-docs-mobile-panel')
    }

    setHidden(navigation, mobile ? mobilePanel !== 'navigation' : navigationCollapsed)
    setHidden(secondaryNavigation, mobile && mobilePanel !== 'secondary')
    setHidden(mobileNavigationBackdrop, !mobile || mobilePanel === null)
    mobileNavigationToggle?.setAttribute(
      'aria-expanded',
      String(mobile && mobilePanel === 'navigation'),
    )
    mobileSecondaryNavigationToggle?.setAttribute(
      'aria-expanded',
      String(mobile && mobilePanel === 'secondary'),
    )
    document.body.style.overflow = mobile && mobilePanel ? 'hidden' : bodyOverflow
  }

  function updateMobileNavigationTop() {
    if (isMobile() && mobileNavigationBar) {
      root.style.setProperty(
        '--docs-mobile-navigation-top',
        `${mobileNavigationBar.getBoundingClientRect().bottom}px`,
      )
    } else if (mobileNavigationTop) {
      root.style.setProperty('--docs-mobile-navigation-top', mobileNavigationTop)
    } else {
      root.style.removeProperty('--docs-mobile-navigation-top')
    }
  }
}

function readMobilePanel(value: string | null): MobilePanel | null {
  return value === 'navigation' || value === 'secondary' ? value : null
}

function isMobile(): boolean {
  return window.matchMedia('(width < 900px)').matches
}

function setHidden(element: HTMLElement | null, hidden: boolean) {
  element?.toggleAttribute('inert', hidden)
  if (hidden) {
    element?.setAttribute('aria-hidden', 'true')
  } else {
    element?.removeAttribute('aria-hidden')
  }
}
