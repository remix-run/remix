import { run } from 'remix/ui'
import { closePagefindSearch, startPagefindSearch } from 'remix-docs-shared/search/browser'

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

startPagefindSearch()

window.navigation.addEventListener('navigate', () => {
  closePagefindSearch()
})
