import { run } from 'remix/ui'
import {
  MOBILE_NAV_MAX_HEIGHT_OFFSET,
  MOBILE_NAV_MAX_VIEWPORT_HEIGHT,
  MOBILE_NAV_MEDIA_QUERY,
} from '../shared/breakpoints.ts'

let app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(moduleUrl)
    let Component = (mod as any)[exportName]
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

// Load Pagefind Component UI (modal trigger + modal)
let link = document.createElement('link')
link.rel = 'stylesheet'
link.href = '/pagefind/pagefind-component-ui.css'
document.head.appendChild(link)

let script = document.createElement('script')
script.type = 'module'
script.src = '/pagefind/pagefind-component-ui.js'
document.head.appendChild(script)

let navToggle = document.getElementById('nav-toggle')
if (navToggle instanceof HTMLInputElement) {
  navToggle.addEventListener('change', () => {
    if (!navToggle.checked || !isMobileNav()) return

    let sidebar = document.getElementById('docs-sidebar')
    let activeLink = sidebar?.querySelector('[data-active-doc="true"]')
    if (!(sidebar instanceof HTMLElement) || !(activeLink instanceof HTMLElement)) return

    let sidebarRect = sidebar.getBoundingClientRect()
    let activeRect = activeLink.getBoundingClientRect()
    let activeOffset = activeRect.top - sidebarRect.top + sidebar.scrollTop
    let expandedHeight = Math.min(
      sidebar.scrollHeight,
      window.innerHeight * MOBILE_NAV_MAX_VIEWPORT_HEIGHT - MOBILE_NAV_MAX_HEIGHT_OFFSET,
    )
    sidebar.scrollTop = activeOffset - expandedHeight / 2 + activeLink.clientHeight / 2
  })
}

window.navigation.addEventListener('navigate', () => {
  if (navToggle instanceof HTMLInputElement) {
    navToggle.checked = false
  }
})

function isMobileNav() {
  return window.matchMedia(MOBILE_NAV_MEDIA_QUERY).matches
}
