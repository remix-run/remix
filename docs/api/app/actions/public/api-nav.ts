// Where the package list was scrolled, so "All packages" returns to the same spot.
let rootScrollTop = 0

// The server renders the panel for the current page, and navigations update it through the
// document diff. "All packages" switches panels in place so the page stays put.
export function startApiNav() {
  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }
    if (!(event.target instanceof Element)) return

    let nav = event.target.closest('[data-api-nav-back]')?.closest<HTMLElement>('.api-nav')
    if (!nav) return

    event.preventDefault()
    nav.dataset.apiNavView = 'root'
    for (let panel of nav.querySelectorAll<HTMLElement>('[data-api-nav-panel]')) {
      panel.inert = panel.dataset.apiNavPanel !== 'root'
    }
  })

  document.addEventListener(
    'scroll',
    (event) => {
      if (!(event.target instanceof HTMLElement) || event.target.id !== 'docs-navigation') return
      let nav = event.target.querySelector<HTMLElement>('.api-nav')
      if (nav?.dataset.apiNavView === 'root') rootScrollTop = event.target.scrollTop
    },
    { capture: true, passive: true },
  )

  new MutationObserver((records) => {
    for (let record of records) {
      if (record.target instanceof HTMLElement) onViewChange(record.target)
    }
  }).observe(document.body, {
    attributeFilter: ['data-api-nav-view'],
    subtree: true,
  })
}

function onViewChange(nav: HTMLElement) {
  let scroller = nav.closest('#docs-navigation')
  let top = nav.dataset.apiNavView === 'root' ? rootScrollTop : 0
  scroller?.scrollTo({ top })
  // Coming from a short menu, the sidebar only becomes scrollable once the shell re-measures it
  // (a resize observer, after the next layout), so try again then.
  if (scroller && scroller.scrollTop !== top) {
    requestAnimationFrame(() => requestAnimationFrame(() => scroller.scrollTo({ top })))
  }

  // Keep keyboard focus in the visible panel instead of losing it with the hidden one.
  // Inert panels drop focus to the body, so treat that as focus lost from the nav.
  let panel = nav.querySelector<HTMLElement>(`[data-api-nav-panel="${nav.dataset.apiNavView}"]`)
  let focused = document.activeElement
  if (!panel || panel.contains(focused) || (focused !== document.body && !nav.contains(focused))) {
    return
  }
  let target =
    panel.querySelector<HTMLElement>('a[aria-current]') ?? panel.querySelector<HTMLElement>('a')
  target?.focus({ preventScroll: true })
}
