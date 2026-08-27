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
  async resolveFrame(src, options) {
    let response = await fetch(src, {
      headers: { accept: 'text/html' },
      method: options?.method,
      body: getRequestBody(options?.formData, options?.method, options?.encType),
      signal: options?.signal,
    })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    if (response.body) return response.body
    return response.text()
  },
})

function getRequestBody(
  formData?: FormData,
  method?: string,
  encType?: string,
): BodyInit | undefined {
  if (!formData || method?.toLowerCase() === 'get') return
  if (encType !== 'application/x-www-form-urlencoded') return formData

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})

startPagefindSearch()

window.addEventListener('click', (event) => {
  let source = event.composedPath()[0] ?? event.target
  if (source instanceof Element && source.closest('a[href], area[href]')) {
    closePagefindSearch()
  }
})
window.addEventListener('popstate', closePagefindSearch)
