import { boot } from '@remix-run/dom'

let runtime = boot({
  document,
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as Record<string, unknown>)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a component function`)
    }
    return exp
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, {
      headers: { accept: 'text/html' },
      signal,
    })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    if (response.body) return response.body
    return await response.text()
  },
})

runtime.addEventListener('error', (event) => {
  console.error(event.error)
})

void runtime.ready()
