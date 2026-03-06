import { run } from 'remix/component'

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as any)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src, signal, target) {
    let headers = new Headers()
    headers.set('accept', 'text/html')
    headers.set('x-remix-frame', 'true')
    headers.set('x-remix-top-frame-src', window.location.href)

    if (target) {
      headers.set('x-remix-target', target)
    }

    let res = await fetch(src, { headers, signal })
    if (!res.ok) {
      return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
    }
    if (res.body) return res.body
    return await res.text()
  },
})

app.ready().catch((error: unknown) => console.error(error))
