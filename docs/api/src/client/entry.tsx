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
  async resolveFrame(src, signal) {
    let response = await fetch(src, { headers: { accept: 'text/html' }, signal })
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

document.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return

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
    document.documentElement.hasAttribute('data-docs-nav-collapsed') &&
    window.matchMedia('(width >= 900px)').matches
      ? document.getElementById('docs-search-compact')
      : document.getElementById('docs-search-button')
  void openPagefindSearch(trigger)
})

window.navigation.addEventListener('navigate', () => {
  let pagefindModal = document.querySelector('pagefind-modal')
  if (pagefindModal instanceof HTMLElement) {
    let close = Reflect.get(pagefindModal, 'close')
    if (typeof close === 'function') close.call(pagefindModal)
  }

  document.getElementById('docs-search-compact')?.blur()
  document.getElementById('docs-search-button')?.blur()
})

async function openPagefindSearch(trigger: HTMLElement | null) {
  if (!trigger) return

  await customElements.whenDefined('pagefind-modal')
  let modal = document.querySelector('pagefind-modal')
  if (!(modal instanceof HTMLElement) || !trigger.isConnected) return

  let open = Reflect.get(modal, 'open')
  if (typeof open !== 'function') return

  let dialog = modal.querySelector('dialog')
  if (dialog?.open) return

  document.getElementById('docs-search-compact')?.setAttribute('aria-expanded', 'false')
  document.getElementById('docs-search-button')?.setAttribute('aria-expanded', 'false')
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
