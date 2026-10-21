type PanelState = 'before' | 'current' | 'after'

// Where each menu was scrolled, so backing out of a nested menu returns to the same spot.
const scrollTops = new Map<string, number>()

// The server renders one panel per menu down to the current page, and navigations update them
// through the document diff. Back links switch panels in place so the page stays put.
export function startApiNav() {
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    if (!(event.target instanceof Element)) return

    let panel = event.target.closest('[data-api-nav-back]')?.closest<HTMLElement>('.api-nav-panel')
    let parent = panel?.previousElementSibling
    if (!panel || !(parent instanceof HTMLElement)) return

    event.preventDefault()
    setState(panel, 'after')
    setState(parent, 'current')
  })

  document.addEventListener(
    'scroll',
    (event) => {
      if (!(event.target instanceof HTMLElement) || event.target.id !== 'docs-navigation') return
      let current = event.target.querySelector<HTMLElement>('[data-api-nav-panel="current"]')
      if (current) scrollTops.set(getKey(current), event.target.scrollTop)
    },
    { capture: true, passive: true },
  )

  new MutationObserver((records) => {
    for (let record of records) {
      if (record.type === 'attributes' && record.target instanceof HTMLElement) {
        restartFromCurrentPosition(record.target)
        if (isCurrentPanel(record.target)) showPanel(record.target, false)
      }
      for (let node of record.addedNodes) {
        if (isCurrentPanel(node)) showPanel(node, true)
      }
    }
  }).observe(document.body, {
    attributeFilter: ['data-api-nav-panel'],
    childList: true,
    subtree: true,
  })
}

const entranceId = 'api-nav-entrance'

// A panel that changes state mid-slide would fight its new state: the entrance animation overrides
// CSS transitions, and a reversed CSS transition runs shorter than its neighbour's, so panels
// overlap. Restart from where it is so the new slide runs the full duration, in step with the rest.
function restartFromCurrentPosition(panel: HTMLElement) {
  let { transform } = getComputedStyle(panel)
  panel
    .getAnimations()
    .find((animation) => animation.id === entranceId)
    ?.cancel()
  panel.style.transition = 'none'
  panel.style.transform = transform
  panel.getBoundingClientRect()
  panel.style.transition = ''
  panel.style.transform = ''
}

function setState(panel: HTMLElement, state: PanelState) {
  panel.dataset.apiNavPanel = state
  panel.inert = state !== 'current'
}

function getKey(panel: HTMLElement): string {
  return panel.dataset.rmxKey ?? ''
}

function isCurrentPanel(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && node.dataset.apiNavPanel === 'current'
}

// `entered` is true for a menu one level deeper, which opens at the top and slides in from the
// right. Menus the user returns to restore their scroll position and slide back via CSS.
function showPanel(panel: HTMLElement, entered: boolean) {
  let scroller = panel.closest('#docs-navigation')
  let top = entered ? 0 : (scrollTops.get(getKey(panel)) ?? 0)
  scroller?.scrollTo({ top })
  // Coming from a short menu, the sidebar only becomes scrollable once the shell re-measures it
  // (a resize observer, after the next layout), so try again then.
  if (scroller && scroller.scrollTop !== top) {
    requestAnimationFrame(() => requestAnimationFrame(() => scroller.scrollTo({ top })))
  }

  // A new element has no previous state to transition from, so animate it with the same timing
  // the CSS uses. That timing is 0s on mobile and with reduced motion.
  let style = getComputedStyle(panel)
  let duration = parseFloat(style.transitionDuration) * 1000
  if (entered && duration > 0) {
    // Start where waiting panels sit: past the menu's right padding.
    let padEnd = getComputedStyle(panel.parentElement ?? panel).paddingRight
    panel.animate([{ transform: `translateX(calc(100% + ${padEnd}))` }, { transform: 'none' }], {
      id: entranceId,
      duration,
      easing: style.transitionTimingFunction,
    })
  }

  // Keep keyboard focus in the visible panel instead of losing it with the hidden one.
  // Inert panels drop focus to the body, so treat that as focus lost from the nav.
  let focused = document.activeElement
  let nav = panel.parentElement
  if (panel.contains(focused) || (focused !== document.body && !nav?.contains(focused))) return
  let target =
    panel.querySelector<HTMLElement>('a[aria-current]') ?? panel.querySelector<HTMLElement>('a')
  target?.focus({ preventScroll: true })
}
