import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    let mod = await import(moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src: string, signal?: AbortSignal) {
    let res = await fetch(src, { headers: { accept: 'text/html' }, signal })
    if (!res.ok) {
      return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
    }
    if (res.body) return res.body
    return await res.text()
  },
})

app.ready().catch((error: unknown) => console.error(error))
