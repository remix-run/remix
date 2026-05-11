import { run } from 'remix/ui'

const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(moduleUrl)
    let Component = (mod as any)[exportName]
    if (!Component) {
      throw new Error(`Unknown component: ${moduleUrl}#${exportName}`)
    }
    return Component
  },
  async resolveFrame(src, signal) {
    let response = await fetch(src, { headers: { Accept: 'text/html' }, signal })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    // let text = await response.text()
    // console.log(text)
    // return text
    if (response.body) return response.body
    return response.text()
  },
})

app.ready().catch((error: unknown) => {
  console.error('Frame adoption failed:', error)
})
