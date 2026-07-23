import { run } from 'remix/ui'

let app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let module = await import(moduleUrl)
    let Component = module[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async resolveFrame(src, options) {
    let response = await fetch(src, {
      headers: { accept: 'text/html' },
      method: options?.method,
      body: options?.method?.toLowerCase() === 'get' ? undefined : options?.formData,
      signal: options?.signal,
    })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    if (response.body) return response.body
    return response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})

let root = document.documentElement
let apiNavigation: HTMLElement | null = null
let navToggle: HTMLElement | null = null
let compactSearch: HTMLElement | null = null
let expandedSearch: HTMLElement | null = null
let navCollapsed = false

syncApiNavigation()

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return

  if (event.target.closest('#docs-nav-toggle')) {
    setApiNavigationCollapsed(!navCollapsed)
    return
  }

  let searchTrigger = event.target.closest('#docs-search-button, #docs-search-compact')
  if (searchTrigger instanceof HTMLElement) void openPagefindSearch(searchTrigger)
})
document.addEventListener('keydown', (event) => {
  if (
    event.defaultPrevented ||
    event.key.toLowerCase() !== 'k' ||
    (!event.metaKey && !event.ctrlKey) ||
    event.altKey ||
    event.shiftKey
  ) {
    return
  }

  let activeElement = document.activeElement
  if (
    activeElement instanceof HTMLElement &&
    (activeElement.matches('input, textarea') || activeElement.isContentEditable)
  ) {
    return
  }

  event.preventDefault()
  let trigger =
    navCollapsed && window.matchMedia('(width >= 900px)').matches ? compactSearch : expandedSearch
  void openPagefindSearch(trigger)
})
window.addEventListener('resize', updateScrollableNavigation)
window.navigation.addEventListener('navigatesuccess', syncApiNavigation)

void document.fonts.ready.then(updateScrollableNavigation)

window.navigation.addEventListener('navigate', () => {
  let pagefindModal = document.querySelector('pagefind-modal')
  if (pagefindModal instanceof HTMLElement) {
    let close = Reflect.get(pagefindModal, 'close')
    if (typeof close === 'function') close.call(pagefindModal)
  }

  compactSearch?.blur()
  expandedSearch?.blur()
})

function syncApiNavigation() {
  apiNavigation = document.getElementById('docs-chapters-navigation')
  navToggle = document.getElementById('docs-nav-toggle')
  compactSearch = document.getElementById('docs-search-compact')
  expandedSearch = document.getElementById('docs-search-button')
  setApiNavigationCollapsed(navCollapsed)
  updateScrollableNavigation()
}

async function openPagefindSearch(trigger: HTMLElement | null) {
  if (!trigger) return

  await customElements.whenDefined('pagefind-modal')
  let modal = document.querySelector('pagefind-modal')
  if (!(modal instanceof HTMLElement) || !trigger.isConnected) return

  let open = Reflect.get(modal, 'open')
  if (typeof open !== 'function') return

  let dialog = modal.querySelector('dialog')
  if (dialog?.open) return

  compactSearch?.setAttribute('aria-expanded', 'false')
  expandedSearch?.setAttribute('aria-expanded', 'false')
  if (dialog?.id) trigger.setAttribute('aria-controls', dialog.id)
  trigger.setAttribute('aria-expanded', 'true')
  dialog?.addEventListener(
    'close',
    () => {
      trigger.setAttribute('aria-expanded', 'false')
      if (trigger.isConnected) trigger.focus()
    },
    { once: true },
  )
  open.call(modal)
}

function updateScrollableNavigation() {
  if (!apiNavigation) return
  apiNavigation.toggleAttribute(
    'data-scrollable',
    apiNavigation.scrollHeight > apiNavigation.clientHeight,
  )
}

function setApiNavigationCollapsed(collapsed: boolean) {
  navCollapsed = collapsed
  root.toggleAttribute('data-docs-nav-collapsed', collapsed)
  setHidden(apiNavigation, collapsed)
  setHidden(compactSearch, !collapsed)
  navToggle?.setAttribute('aria-expanded', String(!collapsed))
  navToggle?.setAttribute(
    'aria-label',
    collapsed ? 'Expand API navigation' : 'Collapse API navigation',
  )
}

function setHidden(element: HTMLElement | null, hidden: boolean) {
  element?.toggleAttribute('inert', hidden)
  if (hidden) {
    element?.setAttribute('aria-hidden', 'true')
  } else {
    element?.removeAttribute('aria-hidden')
  }
}
